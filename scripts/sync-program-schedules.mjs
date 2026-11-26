// Proposes changes to src/content/program-schedules.json from HubEasy, where staff keep program times.
//
// Only Simon publishes the site (decision D6), so this script never commits anything. It fetches HubEasy's public
// programs feed, checks it, maps it to the rows the pages read, and compares it with the current file. When something
// changed it writes the new file and a plain-English list of the changes (sync-report.md); the workflow
// .github/workflows/sync-program-schedules.yml turns that into one pull request for Simon to merge or close.
// When a guard trips it writes nothing except sync-guard.md, which the workflow posts as one (edited) comment.
//
// Usage:
//   node scripts/sync-program-schedules.mjs                 # reads the HubEasy feed (HUBEASY_PROGRAMS_FEED_URL, or the default below)
//   node scripts/sync-program-schedules.mjs --from <file>   # reads a saved feed document instead (for testing)
//   add --check to report what would change, without writing anything
//
// Outcomes (also written to $GITHUB_OUTPUT as outcome=...): changed, unchanged, guard. All three exit 0, so a feed
// that is down or wrong produces one guard comment rather than a red run every 30 minutes. Exit 1 means a bug here.
//
// See docs/program-schedule-sync.md for the feed contract, the wording table and the guards.
import { readFile, writeFile, appendFile, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { formatTime, sortRows } from '../src/lib/schedule.ts';

export const FEED_URL = 'https://oakdene.hubeasy.com.au/api/public-programs.php';

// Section keys in file order, with the name each one has in a report line.
export const SECTIONS = { 'life-choices': 'Life Choices', aa: 'AA', ga: 'GA', dbt: 'DBT' };

// Wording table. These strings are what the public pages show; do not add new ones without Simon's decision.
export const MODE_WORDING = { face_to_face: 'In-person', zoom: 'Online / Zoom Only', hybrid: 'In-person or Zoom' };
export const FREQUENCY_WORDING = { weekly: '', fortnightly: 'Fortnightly', monthly: 'Monthly', adhoc: null }; // null = held back

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const FIELDS = ['day', 'start', 'end', 'format', 'audience', 'notes'];

/** A guard: the feed cannot be used. Nothing is written and the message is reported once. */
export class GuardError extends Error {
  constructor(title, problems = []) {
    super(problems.length ? `${title}: ${problems.join('; ')}` : title);
    this.title = title;
    this.problems = problems;
  }
}

const label = section => SECTIONS[section] ?? section;
const slot = row => `${row.day} ${formatTime(row.start)} to ${formatTime(row.end)}`;
const sameSlot = (a, b) => a.day === b.day && a.start === b.start && a.end === b.end;
const canon = row => JSON.stringify(FIELDS.map(f => row[f]));
const where = (section, i, row) => `${label(section)} row ${i + 1}${row && typeof row.program === 'string' ? ` (${row.program})` : ''}`;

/** Parses the feed text. Throws a GuardError for anything that is not a feed document. */
export function parseFeed(text) {
  let doc;
  try { doc = JSON.parse(text); } catch { throw new GuardError('the feed is not JSON', [`it starts: ${JSON.stringify(String(text).slice(0, 80))}`]); }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc) || !doc.sections || typeof doc.sections !== 'object' || Array.isArray(doc.sections)) {
    throw new GuardError('the feed has no "sections" object');
  }
  return doc;
}

/** Checks every row. Shape problems (bad day, time, missing fields) and unknown values are separate guards. */
export function validateFeed(doc) {
  const malformed = [];
  const unknown = [];
  for (const key of Object.keys(doc.sections)) if (!(key in SECTIONS)) unknown.push(`unknown section "${key}"`);
  for (const [section, rows] of Object.entries(doc.sections)) {
    if (!(section in SECTIONS)) continue;
    if (!Array.isArray(rows)) { malformed.push(`${label(section)} is not a list`); continue; }
    rows.forEach((row, i) => {
      const at = where(section, i, row);
      if (!row || typeof row !== 'object' || Array.isArray(row)) { malformed.push(`${at} is not an object`); return; }
      if (!WEEKDAYS.includes(row.day)) malformed.push(`${at}: day ${JSON.stringify(row.day)} is not a weekday name`);
      for (const f of ['start', 'end']) if (!TIME.test(row[f] ?? '')) malformed.push(`${at}: ${f} ${JSON.stringify(row[f])} is not 24-hour HH:MM`);
      if (TIME.test(row.start ?? '') && TIME.test(row.end ?? '') && row.start >= row.end) malformed.push(`${at}: ends at or before it starts`);
      if (row.public_note != null && typeof row.public_note !== 'string') malformed.push(`${at}: public_note is not text`);
      if (!Object.hasOwn(MODE_WORDING, row.mode)) unknown.push(`${at}: unknown mode ${JSON.stringify(row.mode)}`);
      if (!Object.hasOwn(FREQUENCY_WORDING, row.frequency)) unknown.push(`${at}: unknown frequency ${JSON.stringify(row.frequency)}`);
    });
  }
  if (malformed.length) throw new GuardError('the feed is malformed', malformed);
  if (unknown.length) throw new GuardError('the feed has a value this sync does not know how to word', unknown);
}

/** Maps one feed row to the W2 row shape for its section. Returns null for a row that is held back (adhoc). */
export function mapRow(section, row) {
  const often = FREQUENCY_WORDING[row.frequency];
  if (often === null) return null;
  const note = (row.public_note ?? '').trim();
  if (section === 'life-choices') {
    return { day: row.day, start: row.start, end: row.end, format: MODE_WORDING[row.mode], audience: note, notes: often };
  }
  return { day: row.day, start: row.start, end: row.end, format: '', audience: '', notes: [note, often].filter(Boolean).join(', ') };
}

/** Feed document -> { sections, heldBack }. Sections are in file order and each is sorted Monday-first. */
export function mapFeed(doc) {
  const sections = {};
  const heldBack = [];
  for (const section of Object.keys(SECTIONS)) {
    const rows = [];
    for (const row of doc.sections[section] ?? []) {
      const mapped = mapRow(section, row);
      if (mapped) rows.push(mapped);
      else heldBack.push({ section, program: row.program || label(section), row });
    }
    sections[section] = sortRows(rows);
  }
  return { sections, heldBack };
}

const total = sections => Object.values(sections).reduce((n, rows) => n + rows.length, 0);

/** Guards that compare the proposed rows with the current file. */
export function checkProposal(proposed, current) {
  const empty = Object.keys(SECTIONS).filter(s => proposed[s].length === 0);
  if (empty.length) {
    throw new GuardError('a section would have no rows', empty.map(s => `${label(s)} would be empty (its page would show an empty table)`));
  }
  const before = total(current);
  const after = total(proposed);
  if (after < before / 2) {
    throw new GuardError('the feed has fewer than half the current rows', [`${after} rows proposed, ${before} on the site now`]);
  }
}

function fieldChanges(section, from, to) {
  const out = [];
  for (const f of ['format', 'audience', 'notes']) {
    if (from[f] !== to[f]) out.push(`${f} ${from[f] ? `"${from[f]}"` : '(blank)'} changed to ${to[f] ? `"${to[f]}"` : '(blank)'}`);
  }
  return out;
}

function shownAs(section, row) {
  const parts = section === 'life-choices' ? [row.format, row.audience, row.notes] : [row.notes];
  const text = parts.filter(Boolean).join(', ');
  return text ? ` (${text})` : '';
}

/** Current vs proposed sections -> plain-English lines, one per change. */
export function describeChanges(current, proposed) {
  const removed = [];
  const added = [];
  for (const section of Object.keys(SECTIONS)) {
    const pool = new Map();
    for (const row of current[section] ?? []) { const k = canon(row); pool.set(k, [...(pool.get(k) || []), row]); }
    for (const row of proposed[section] ?? []) {
      const hit = pool.get(canon(row));
      if (hit && hit.length) hit.shift(); else added.push({ section, row });
    }
    for (const rows of pool.values()) for (const row of rows) removed.push({ section, row });
  }
  const lines = [];
  const take = (list, match) => { const i = list.findIndex(match); return i === -1 ? null : list.splice(i, 1)[0]; };
  // 1. The same session now in another table (the 26 November mix-up).
  for (const r of [...removed]) {
    const a = take(added, x => x.section !== r.section && sameSlot(x.row, r.row));
    if (!a) continue;
    removed.splice(removed.indexOf(r), 1);
    lines.push(`${label(r.section)}: ${slot(r.row)} moved to ${label(a.section)}${shownAs(a.section, a.row)}`);
  }
  // 2. Same table, same day and times, different wording.
  for (const r of [...removed]) {
    const a = take(added, x => x.section === r.section && sameSlot(x.row, r.row));
    if (!a) continue;
    removed.splice(removed.indexOf(r), 1);
    lines.push(`${label(r.section)}: ${slot(r.row)} ${fieldChanges(r.section, r.row, a.row).join(', ')}`);
  }
  // 3. Same table and day, new times.
  for (const r of [...removed]) {
    const a = take(added, x => x.section === r.section && x.row.day === r.row.day);
    if (!a) continue;
    removed.splice(removed.indexOf(r), 1);
    const extra = fieldChanges(r.section, r.row, a.row);
    lines.push(`${label(r.section)}: ${slot(r.row)} now ${formatTime(a.row.start)} to ${formatTime(a.row.end)}${extra.length ? `, ${extra.join(', ')}` : ''}`);
  }
  for (const a of added) lines.push(`${label(a.section)}: new session ${slot(a.row)}${shownAs(a.section, a.row)}`);
  for (const r of removed) lines.push(`${label(r.section)}: ${slot(r.row)} removed`);
  return lines;
}

/** The pull request body: what merging would change on the site, in plain English. */
export function renderReport({ lines, heldBack, generatedAt }) {
  const out = ['## Program times: changes from HubEasy', ''];
  out.push(`HubEasy's program times differ from the website in ${lines.length} place${lines.length === 1 ? '' : 's'}. Merging this pull request publishes them; closing it leaves the site as it is.`, '');
  for (const line of lines) out.push(`- ${line}`);
  if (heldBack.length) {
    out.push('', '### Held back (ad hoc, not put on the site)', '');
    for (const h of heldBack) out.push(`- ${label(h.section)}: ${h.program}, ${slot(h.row)}`);
  }
  out.push('', `Feed generated ${generatedAt || '(no time given)'}. If a line looks wrong, fix it in HubEasy and this pull request updates itself at the next half-hour run.`);
  return out.join('\n') + '\n';
}

/** The guard comment body. The marker lets the workflow find and edit the same comment every run. */
export const GUARD_MARKER = '<!-- program-schedule-sync-guard -->';
export function renderGuard(err) {
  const out = [GUARD_MARKER, `**Program schedule sync stopped: ${err.title}.**`, '', 'Nothing was changed. The website keeps its current times until the feed is fixed.'];
  if (err.problems.length) { out.push(''); for (const p of err.problems) out.push(`- ${p}`); }
  return out.join('\n') + '\n';
}

/** Serialises the file in the same layout as the hand-written original: one row per line. */
export function serialise(sections) {
  const row = r => `{ ${FIELDS.map(f => `${JSON.stringify(f)}: ${JSON.stringify(r[f])}`).join(', ')} }`;
  const blocks = Object.keys(SECTIONS).map(s => `    ${JSON.stringify(s)}: [\n${sections[s].map(r => `      ${row(r)}`).join(',\n')}\n    ]`);
  return `{\n  "sections": {\n${blocks.join(',\n')}\n  }\n}\n`;
}

/**
 * The whole sync, without touching the network or disk: feed text + current file text -> outcome.
 * Returns { outcome: 'unchanged' } | { outcome: 'changed', file, report, lines, heldBack } | { outcome: 'guard', error, comment }.
 */
export function sync(feedText, currentText) {
  try {
    const doc = parseFeed(feedText);
    validateFeed(doc);
    const { sections, heldBack } = mapFeed(doc);
    const current = JSON.parse(currentText).sections;
    checkProposal(sections, current);
    const sortedCurrent = Object.fromEntries(Object.keys(SECTIONS).map(s => [s, sortRows(current[s] ?? [])]));
    const lines = describeChanges(sortedCurrent, sections);
    if (!lines.length) return { outcome: 'unchanged', heldBack };
    return { outcome: 'changed', file: serialise(sections), report: renderReport({ lines, heldBack, generatedAt: doc.generatedAt }), lines, heldBack };
  } catch (error) {
    if (!(error instanceof GuardError)) throw error;
    return { outcome: 'guard', error, comment: renderGuard(error) };
  }
}

async function fetchFeed(url) {
  let r;
  try {
    r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'oakdene-website-program-sync' } });
  } catch (e) {
    throw new GuardError('the HubEasy programs feed could not be reached', [`${url}: ${e.cause?.code || e.message}`]);
  }
  if (!r.ok) throw new GuardError('the HubEasy programs feed could not be reached', [`${url} answered ${r.status}`]);
  return r.text();
}

async function main() {
  // PROGRAM_SYNC_ROOT lets the tests run the real command against a scratch copy of the repo's files.
  const root = process.env.PROGRAM_SYNC_ROOT ? pathToFileURL(process.env.PROGRAM_SYNC_ROOT.replace(/\/?$/, '/')) : new URL('..', import.meta.url);
  const args = process.argv.slice(2);
  const fromFile = args.includes('--from') ? args[args.indexOf('--from') + 1] : null;
  const checkOnly = args.includes('--check');
  const file = new URL('src/content/program-schedules.json', root);
  const reportFile = new URL('sync-report.md', root);
  const guardFile = new URL('sync-guard.md', root);
  const url = process.env.HUBEASY_PROGRAMS_FEED_URL || FEED_URL;

  let result;
  try {
    const feedText = fromFile ? await readFile(fromFile, 'utf8') : await fetchFeed(url);
    result = sync(feedText, await readFile(file, 'utf8'));
  } catch (error) {
    if (!(error instanceof GuardError)) throw error;
    result = { outcome: 'guard', error, comment: renderGuard(error) };
  }

  await rm(reportFile, { force: true });
  await rm(guardFile, { force: true });
  let summary;
  if (result.outcome === 'unchanged') {
    summary = 'No change: HubEasy matches the website.\n';
    console.log(summary.trim());
  } else if (result.outcome === 'changed') {
    summary = result.report;
    console.log(`${result.lines.length} change(s):\n${result.lines.map(l => `  ${l}`).join('\n')}`);
    if (!checkOnly) {
      await writeFile(file, result.file);
      await writeFile(reportFile, result.report);
    }
  } else {
    summary = result.comment.replace(GUARD_MARKER + '\n', '');
    console.log(`::warning::Program schedule sync stopped: ${result.error.message}`);
    if (!checkOnly) await writeFile(guardFile, result.comment);
  }
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary + '\n');
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `outcome=${result.outcome}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(e => { console.error('Program schedule sync failed (a bug in the script, not the feed):', e); process.exit(1); });
}
