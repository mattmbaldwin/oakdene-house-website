// Run with: node --test scripts/*.test.mjs   (Node 22.18+, which loads src/lib/schedule.ts directly)
//
// Each test names what it protects, the wrong result it fails on, and what passing does not prove (issue #11).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, mkdir, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  sync, mapRow, mapFeed, describeChanges, serialise, renderReport, GUARD_MARKER,
} from './sync-program-schedules.mjs';

const fixture = name => readFile(new URL(`./fixtures/program-schedules/${name}`, import.meta.url), 'utf8');
const SCRIPT = fileURLToPath(new URL('./sync-program-schedules.mjs', import.meta.url));
const row = (over = {}) => ({ program: 'Test', day: 'Monday', start: '11:00', end: '12:15', mode: 'face_to_face', frequency: 'weekly', public_note: '', ...over });

// ---- Wording map (+5) ----

test('wording: face_to_face, zoom and hybrid give the three Life Choices format words', () => {
  // protects: the Format column text. fails_when: a mode maps to anything but the agreed wording.
  // no_claim: does not check how the page styles the badge.
  assert.equal(mapRow('life-choices', row({ mode: 'face_to_face' })).format, 'In-person');
  assert.equal(mapRow('life-choices', row({ mode: 'zoom' })).format, 'Online / Zoom Only');
  assert.equal(mapRow('life-choices', row({ mode: 'hybrid' })).format, 'In-person or Zoom');
});

test('wording: fortnightly and monthly append their word to notes; weekly adds nothing', () => {
  // protects: the only new frequency wording allowed. fails_when: weekly adds text, or the word goes elsewhere.
  // no_claim: Life Choices does not render notes today, so on that page the word is stored but not shown.
  assert.equal(mapRow('aa', row({ frequency: 'fortnightly', public_note: 'Spanish Speaking' })).notes, 'Spanish Speaking, Fortnightly');
  assert.equal(mapRow('ga', row({ frequency: 'monthly' })).notes, 'Monthly');
  assert.equal(mapRow('life-choices', row({ frequency: 'monthly' })).notes, 'Monthly');
  assert.equal(mapRow('aa', row({ frequency: 'weekly' })).notes, '');
});

test('wording: adhoc rows are held back from the file and listed in the report', () => {
  // protects: one-off sessions never reach a weekly table. fails_when: an adhoc row is written, or vanishes unreported.
  // no_claim: does not judge whether HubEasy marked the row adhoc correctly.
  const doc = { sections: { 'life-choices': [row()], aa: [row(), row({ day: 'Saturday', frequency: 'adhoc', program: 'AA Open Day' })], ga: [row()], dbt: [row()] } };
  assert.equal(mapRow('aa', doc.sections.aa[1]), null);
  const { sections, heldBack } = mapFeed(doc);
  assert.equal(sections.aa.length, 1);
  assert.equal(heldBack.length, 1);
  const report = renderReport({ lines: ['x'], heldBack, generatedAt: 't' });
  assert.match(report, /Held back \(ad hoc, not put on the site\)/);
  assert.match(report, /- AA: AA Open Day, Saturday 11:00am to 12:15pm/);
});

test('wording: public_note goes to audience on Life Choices and to notes on AA, GA and DBT', () => {
  // protects: the note lands in the column each page shows. fails_when: a note lands in a column that page hides.
  // no_claim: does not check the note's wording, which staff own.
  assert.deepEqual(mapRow('life-choices', row({ public_note: 'Ladies Only' })), { day: 'Monday', start: '11:00', end: '12:15', format: 'In-person', audience: 'Ladies Only', notes: '' });
  for (const s of ['aa', 'ga', 'dbt']) {
    assert.deepEqual(mapRow(s, row({ public_note: ' Starts 13 May 2026 ' })), { day: 'Monday', start: '11:00', end: '12:15', format: '', audience: '', notes: 'Starts 13 May 2026' });
  }
});

test('wording: AA, GA and DBT rows keep format blank whatever the mode', () => {
  // protects: no new text on pages that have no Format column. fails_when: AA gets a format word.
  // no_claim: a Zoom-only AA meeting is not flagged on its page; that needs a page change, out of scope.
  for (const mode of ['face_to_face', 'zoom', 'hybrid']) assert.equal(mapRow('aa', row({ mode })).format, '');
});

// ---- Guards (+4): each writes nothing and produces exactly one message ----

async function guardCase(name) {
  const result = sync(await fixture(name), await fixture('current.json'));
  assert.equal(result.outcome, 'guard');
  assert.equal(result.file, undefined, 'no file content is produced');
  assert.equal(result.comment.split(GUARD_MARKER).length - 1, 1, 'exactly one guard message');
  return result;
}

test('guard: a feed that is not JSON (an HTML error page) stops the sync', async () => {
  // protects: the site file from a broken feed. fails_when: the sync throws, writes, or reports nothing.
  // no_claim: does not cover a valid-JSON feed with plausible but wrong times.
  const r = await guardCase('feed-malformed.txt');
  assert.match(r.comment, /stopped: the feed is not JSON/);
  assert.equal(sync('{"source":"x"}', await fixture('current.json')).error.title, 'the feed has no "sections" object');
});

test('guard: an unknown mode stops the sync and names the row', async () => {
  // protects: no invented wording. fails_when: an unknown mode is mapped, dropped or shown raw.
  // no_claim: unknown frequency and section take the same path; covered by the inline checks below.
  const r = await guardCase('feed-unknown-mode.json');
  assert.match(r.comment, /Life Choices row 1 \(Life Choices Program\): unknown mode "in_person"/);
  const cur = await fixture('current.json');
  const doc = JSON.parse(await fixture('feed-current.json'));
  doc.sections.aa[0].frequency = 'quarterly';
  assert.match(sync(JSON.stringify(doc), cur).comment, /unknown frequency "quarterly"/);
  doc.sections.aa[0].frequency = 'weekly';
  doc.sections.outpatients = [];
  assert.match(sync(JSON.stringify(doc), cur).comment, /unknown section "outpatients"/);
});

test('guard: a section left with no rows stops the sync', async () => {
  // protects: a page never shows an empty table. fails_when: DBT is written empty.
  // no_claim: a program that really ends needs a hand edit and a page change (docs/program-schedule-sync.md).
  const r = await guardCase('feed-empty-section.json');
  assert.match(r.comment, /DBT would be empty/);
});

test('guard: fewer than half the current rows stops the sync', async () => {
  // protects: against a partial feed wiping most times. fails_when: 4 of 14 rows are proposed as a normal change.
  // no_claim: a drop to exactly half or more is allowed through to the pull request for Simon to judge.
  const r = await guardCase('feed-halved.json');
  assert.match(r.comment, /4 rows proposed, 14 on the site now/);
});

// ---- Diff to plain English (+3) ----

const lc = (day, start, end, format = 'In-person', audience = '') => ({ day, start, end, format, audience, notes: '' });
const meet = (day, start, end, notes = '') => ({ day, start, end, format: '', audience: '', notes });
const empty = { 'life-choices': [], aa: [], ga: [], dbt: [] };

test('diff: a session moved between tables names both tables (the 26 November mix-up)', () => {
  // protects: Simon can see a cross-page move at a glance. fails_when: it reads as an unrelated add and remove.
  // no_claim: does not decide which table is right.
  const lines = describeChanges({ ...empty, aa: [meet('Friday', '10:00', '11:30')] }, { ...empty, 'life-choices': [lc('Friday', '10:00', '11:30')] });
  assert.deepEqual(lines, ['AA: Friday 10:00am to 11:30am moved to Life Choices (In-person)']);
});

test('diff: a wording change and a time change on the same day read as one line each', () => {
  // protects: edits read as edits. fails_when: a format change or a new time shows as a removal plus a new session.
  // no_claim: two sessions changed on the same day may pair in start order rather than as staff intended.
  const lines = describeChanges(
    { ...empty, 'life-choices': [lc('Tuesday', '11:00', '12:15', 'In-person', 'Ladies Only')], ga: [meet('Tuesday', '19:00', '20:30')] },
    { ...empty, 'life-choices': [lc('Tuesday', '11:00', '12:15', 'Online / Zoom Only', 'Ladies Only')], ga: [meet('Tuesday', '19:30', '21:00')] },
  );
  assert.deepEqual(lines, [
    'Life Choices: Tuesday 11:00am to 12:15pm format "In-person" changed to "Online / Zoom Only"',
    'GA: Tuesday 7:00pm to 8:30pm now 7:30pm to 9:00pm',
  ]);
});

test('diff: new and removed sessions are listed, and identical rows produce no lines', () => {
  // protects: additions and removals are visible, and no-op runs stay silent. fails_when: an unchanged row is listed.
  // no_claim: does not cover duplicate identical rows beyond matching them one for one.
  const same = meet('Thursday', '13:00', '14:30');
  assert.deepEqual(describeChanges({ ...empty, aa: [same] }, { ...empty, aa: [{ ...same }] }), []);
  assert.deepEqual(
    describeChanges({ ...empty, aa: [same] }, { ...empty, dbt: [meet('Monday', '13:00', '14:15', 'Fortnightly')] }),
    ['DBT: new session Monday 1:00pm to 2:15pm (Fortnightly)', 'AA: Thursday 1:00pm to 2:30pm removed'],
  );
});

// ---- Integration (+2): the real command against a scratch copy ----

async function scratch() {
  const dir = await mkdtemp(join(tmpdir(), 'program-sync-'));
  await mkdir(join(dir, 'src/content'), { recursive: true });
  await writeFile(join(dir, 'src/content/program-schedules.json'), await fixture('current.json'));
  return dir;
}
function runSync(dir, feed) {
  const env = { ...process.env, PROGRAM_SYNC_ROOT: dir, GITHUB_OUTPUT: join(dir, 'out'), GITHUB_STEP_SUMMARY: join(dir, 'summary') };
  return execFileSync(process.execPath, [SCRIPT, '--from', fileURLToPath(new URL(`./fixtures/program-schedules/${feed}`, import.meta.url))], { env, encoding: 'utf8' });
}
const exists = p => access(p).then(() => true, () => false);

test('integration: a feed equal to the current file changes nothing and reports no change', async () => {
  // protects: acceptance 1, no pull request when nothing changed. fails_when: the file is rewritten or a report appears.
  // no_claim: the real feed's match with the live file is only known once H1 is live.
  const dir = await scratch();
  const before = await readFile(join(dir, 'src/content/program-schedules.json'), 'utf8');
  runSync(dir, 'feed-current.json');
  assert.equal(await readFile(join(dir, 'src/content/program-schedules.json'), 'utf8'), before);
  assert.equal(await exists(join(dir, 'sync-report.md')), false);
  assert.equal(await readFile(join(dir, 'out'), 'utf8'), 'outcome=unchanged\n');
  // The serialiser reproduces the hand-written layout byte for byte, so a real change diffs only its own rows.
  assert.equal(serialise(JSON.parse(before).sections), before);
});

test('integration: the moved AA session writes the file and a report naming both tables', async () => {
  // protects: acceptance 2 end to end, and that guards write nothing on disk. fails_when: the report or file is missing.
  // no_claim: does not run the workflow or GitHub; see program-sync-publish.test.mjs.
  const dir = await scratch();
  runSync(dir, 'feed-aa-friday-moved.json');
  const file = JSON.parse(await readFile(join(dir, 'src/content/program-schedules.json'), 'utf8'));
  assert.ok(file.sections['life-choices'].some(r => r.day === 'Friday' && r.start === '10:00'));
  assert.ok(!file.sections.aa.some(r => r.day === 'Friday' && r.start === '10:00'));
  const report = await readFile(join(dir, 'sync-report.md'), 'utf8');
  assert.match(report, /^- AA: Friday 10:00am to 11:30am moved to Life Choices/m);
  assert.equal(await readFile(join(dir, 'out'), 'utf8'), 'outcome=changed\n');
  assert.match(await readFile(join(dir, 'summary'), 'utf8'), /moved to Life Choices/);

  const guarded = await scratch();
  const before = await readFile(join(guarded, 'src/content/program-schedules.json'), 'utf8');
  runSync(guarded, 'feed-halved.json');
  assert.equal(await readFile(join(guarded, 'src/content/program-schedules.json'), 'utf8'), before, 'a guard leaves the file alone');
  assert.equal(await exists(join(guarded, 'sync-report.md')), false);
  assert.ok((await readFile(join(guarded, 'sync-guard.md'), 'utf8')).startsWith(GUARD_MARKER));
  assert.equal(await readFile(join(guarded, 'out'), 'utf8'), 'outcome=guard\n');
});
