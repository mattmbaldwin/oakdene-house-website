// Turns the outcome of scripts/sync-program-schedules.mjs into GitHub activity, through the gh CLI.
// Called by .github/workflows/sync-program-schedules.yml after the branch has been force-updated (or not).
//
//   changed    open the one sync pull request, or update its body if it is already open
//   unchanged  close the sync pull request if one is open (HubEasy matches the site again, so it is stale)
//   guard      post the guard message as one comment on the sync pull request, or on the tracking issue when no pull
//              request is open; later runs edit that same comment, never add another
//
// This file never runs git and never pushes. Usage: node scripts/program-sync-publish.mjs <changed|unchanged|guard>
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { GUARD_MARKER } from './sync-program-schedules.mjs';

export const BRANCH = 'sync/program-schedules';
export const PR_TITLE = 'Program times: changes from HubEasy';
export const ISSUE_TITLE = 'Program schedule sync needs attention';
export const ISSUE_LABEL = 'program-sync';
export const FILE = 'src/content/program-schedules.json';

const json = text => (text && text.trim() ? JSON.parse(text) : null);

/** The open sync pull request's number, or null. */
export function openPr(gh) {
  const list = json(gh(['pr', 'list', '--head', BRANCH, '--base', 'main', '--state', 'open', '--json', 'number']));
  return list && list.length ? list[0].number : null;
}

function trackingIssue(gh, create) {
  const list = json(gh(['issue', 'list', '--label', ISSUE_LABEL, '--state', 'open', '--json', 'number,title']));
  const hit = (list || []).find(i => i.title === ISSUE_TITLE);
  if (hit) return hit.number;
  if (!create) return null;
  gh(['label', 'create', ISSUE_LABEL, '--color', '003E51', '--description', 'Program schedule sync from HubEasy', '--force']);
  const url = gh(['issue', 'create', '--title', ISSUE_TITLE, '--label', ISSUE_LABEL, '--body',
    'The program schedule sync posts here when it stops and no sync pull request is open. See docs/program-schedule-sync.md.']).trim();
  return Number(url.split('/').pop());
}

function guardComment(gh, number) {
  const comments = json(gh(['api', '--paginate', '--slurp', `repos/{owner}/{repo}/issues/${number}/comments`])) || [];
  return comments.flat().find(c => typeof c.body === 'string' && c.body.startsWith(GUARD_MARKER)) || null;
}

const stamp = (runUrl, now) => `\n_Last checked ${now}${runUrl ? ` ([run](${runUrl}))` : ''}._\n`;

/** Marks an earlier guard comment as cleared, so the thread does not keep saying the sync is stopped. */
function clearGuard(gh, number, runUrl, now) {
  const c = guardComment(gh, number);
  if (!c || c.body.includes('**Cleared.**')) return;
  gh(['api', '--method', 'PATCH', `repos/{owner}/{repo}/issues/comments/${c.id}`, '-f',
    `body=${GUARD_MARKER}\n**Cleared.** The program schedule sync is running normally again.${stamp(runUrl, now)}`]);
}

/**
 * gh: (args: string[]) => stdout string. proposed: the new file text (for the closed-without-merging check).
 * Returns a short description of what was done, for the log.
 */
export function publish({ outcome, report = '', guard = '', proposed = '', gh, runUrl = '', now = new Date().toISOString() }) {
  const pr = openPr(gh);
  if (outcome === 'changed') {
    let number = pr;
    if (number) gh(['pr', 'edit', String(number), '--body', report]);
    else {
      // Simon closed the last sync pull request without merging, and it proposed this same file: that is a "no", so
      // do not reopen it every run. A new change in HubEasy produces a different file and a fresh pull request.
      const last = (json(gh(['pr', 'list', '--head', BRANCH, '--base', 'main', '--state', 'closed', '--limit', '1',
        '--json', 'number,headRefOid,mergedAt'])) || [])[0];
      if (last && !last.mergedAt && proposed) {
        const encoded = gh(['api', `repos/{owner}/{repo}/contents/${FILE}?ref=${last.headRefOid}`, '--jq', '.content']);
        if (Buffer.from(encoded.replace(/\s/g, ''), 'base64').toString('utf8') === proposed) {
          return `pull request #${last.number} proposed these same changes and was closed without merging; not reopening`;
        }
      }
      const url = gh(['pr', 'create', '--base', 'main', '--head', BRANCH, '--title', PR_TITLE, '--body', report]).trim();
      number = Number(url.split('/').pop());
    }
    clearGuard(gh, number, runUrl, now);
    const issue = trackingIssue(gh, false);
    if (issue) clearGuard(gh, issue, runUrl, now);
    return pr ? `updated pull request #${number}` : `opened pull request #${number}`;
  }
  if (outcome === 'unchanged') {
    const issue = trackingIssue(gh, false);
    if (issue) clearGuard(gh, issue, runUrl, now);
    if (!pr) return 'nothing to do';
    gh(['pr', 'close', String(pr), '--comment', 'HubEasy now matches the website again, so there is nothing to publish. Closing this pull request; the next change opens a new one.']);
    return `closed stale pull request #${pr}`;
  }
  if (outcome === 'guard') {
    const target = pr ?? trackingIssue(gh, true);
    const body = guard.trimEnd() + '\n' + stamp(runUrl, now);
    const existing = guardComment(gh, target);
    if (existing) {
      gh(['api', '--method', 'PATCH', `repos/{owner}/{repo}/issues/comments/${existing.id}`, '-f', `body=${body}`]);
      return `edited the guard comment on #${target}`;
    }
    gh(['api', '--method', 'POST', `repos/{owner}/{repo}/issues/${target}/comments`, '-f', `body=${body}`]);
    return `posted the guard comment on #${target}`;
  }
  throw new Error(`unknown outcome "${outcome}"`);
}

async function main() {
  const outcome = process.argv[2];
  const root = new URL('..', import.meta.url);
  const read = async name => { try { return await readFile(new URL(name, root), 'utf8'); } catch { return ''; } };
  const gh = args => execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  const { GITHUB_SERVER_URL: s, GITHUB_REPOSITORY: r, GITHUB_RUN_ID: id } = process.env;
  const runUrl = s && r && id ? `${s}/${r}/actions/runs/${id}` : '';
  console.log(publish({ outcome, report: await read('sync-report.md'), guard: await read('sync-guard.md'), proposed: await read(FILE), gh, runUrl }));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(e => { console.error('Publishing the program sync result failed:', e.message); process.exit(1); });
}
