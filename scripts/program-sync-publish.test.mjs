// Run with: node --test scripts/*.test.mjs
// Covers the workflow's GitHub side with a fake `gh`, and checks the workflow files themselves.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { publish, BRANCH, PR_TITLE } from './program-sync-publish.mjs';
import { renderGuard, GuardError, GUARD_MARKER } from './sync-program-schedules.mjs';

const workflow = name => readFile(new URL(`../.github/workflows/${name}`, import.meta.url), 'utf8');

/** A small in-memory GitHub: pull requests, issues and comments, driven by the same gh arguments the script uses. */
function fakeGh({ closedPrs = [], contentsAt = {} } = {}) {
  const s = { prs: [], issues: [], comments: [], calls: [], nextId: 100, nextNumber: 1 };
  const flag = (a, f) => a[a.indexOf(f) + 1];
  const gh = a => {
    s.calls.push(a);
    const [c, sub] = a;
    if (c === 'pr' && sub === 'list') return JSON.stringify(flag(a, '--state') === 'open' ? s.prs.filter(p => p.state === 'open') : closedPrs);
    if (c === 'pr' && sub === 'create') { s.prs.push({ number: s.nextNumber, state: 'open', body: flag(a, '--body'), title: flag(a, '--title') }); return `https://github.com/o/r/pull/${s.nextNumber++}\n`; }
    if (c === 'pr' && sub === 'edit') { s.prs.find(p => p.number === Number(a[2])).body = flag(a, '--body'); return ''; }
    if (c === 'pr' && sub === 'close') { s.prs.find(p => p.number === Number(a[2])).state = 'closed'; return ''; }
    if (c === 'issue' && sub === 'list') return JSON.stringify(s.issues.map(i => ({ number: i.number, title: i.title })));
    if (c === 'issue' && sub === 'create') { s.issues.push({ number: s.nextNumber, title: flag(a, '--title') }); return `https://github.com/o/r/issues/${s.nextNumber++}\n`; }
    if (c === 'label') return '';
    if (c === 'api') {
      const path = a.find(x => x.startsWith('repos/'));
      const m = /\/comments(?:\/(\d+))?$/.exec(path);
      if (path.includes('/contents/')) return Buffer.from(contentsAt[path.split('ref=')[1]] ?? '').toString('base64');
      if (a.includes('--paginate')) return JSON.stringify([s.comments.filter(x => path.includes(`/issues/${x.on}/`))]);
      const body = a.find(x => x.startsWith('body=')).slice(5);
      if (flag(a, '--method') === 'POST') { s.comments.push({ id: s.nextId++, on: Number(/issues\/(\d+)/.exec(path)[1]), body }); return ''; }
      s.comments.find(x => x.id === Number(m[1])).body = body; return '';
    }
    throw new Error(`unexpected gh call: ${a.join(' ')}`);
  };
  return { gh, s };
}

test('publish: running twice with the same changed feed leaves one pull request, edited not duplicated', () => {
  // protects: acceptance 5. fails_when: a second run opens a second PR. no_claim: does not test real GitHub.
  const { gh, s } = fakeGh();
  assert.match(publish({ outcome: 'changed', report: 'A\n', gh }), /opened pull request #1/);
  assert.match(publish({ outcome: 'changed', report: 'A\n', gh }), /updated pull request #1/);
  assert.equal(s.prs.length, 1);
  assert.equal(s.prs[0].body, 'A\n');
  assert.equal(s.prs[0].title, PR_TITLE);
  assert.equal(s.calls.filter(c => c[0] === 'pr' && c[1] === 'create').length, 1);
  const create = s.calls.find(c => c[1] === 'create');
  assert.equal(create[create.indexOf('--head') + 1], BRANCH);
  assert.equal(create[create.indexOf('--base') + 1], 'main');
});

test('publish: a pull request Simon closed without merging is not reopened for the same file', () => {
  // protects: "no" stays no. fails_when: a declined change comes back every half hour.
  // no_claim: a different change (different file) does open a new pull request, checked here too.
  const { gh, s } = fakeGh({ closedPrs: [{ number: 9, headRefOid: 'abc', mergedAt: null }], contentsAt: { abc: 'FILE-1' } });
  assert.match(publish({ outcome: 'changed', report: 'R', proposed: 'FILE-1', gh }), /not reopening/);
  assert.equal(s.prs.length, 0);
  assert.match(publish({ outcome: 'changed', report: 'R', proposed: 'FILE-2', gh }), /opened pull request/);
  assert.equal(s.prs.length, 1);
});

test('publish: repeated guard failures leave one comment on the open pull request, edited each time', () => {
  // protects: one comment, never one per run. fails_when: the comment count grows.
  const { gh, s } = fakeGh();
  publish({ outcome: 'changed', report: 'R', gh });
  const guard = renderGuard(new GuardError('the feed is not JSON'));
  publish({ outcome: 'guard', guard, gh, now: 't1' });
  publish({ outcome: 'guard', guard, gh, now: 't2' });
  assert.equal(s.comments.length, 1);
  assert.equal(s.comments[0].on, 1);
  assert.match(s.comments[0].body, /Last checked t2/);
  assert.equal(s.issues.length, 0, 'no tracking issue while a pull request is open');
});

test('publish: with no pull request open, a guard failure goes to one tracking issue, one comment', () => {
  // protects: the feed-not-live-yet case is a single quiet message. fails_when: an issue or comment per run.
  const { gh, s } = fakeGh();
  const guard = renderGuard(new GuardError('the HubEasy programs feed could not be reached', ['url answered 404']));
  for (let i = 0; i < 3; i++) publish({ outcome: 'guard', guard, gh });
  assert.equal(s.issues.length, 1);
  assert.equal(s.comments.length, 1);
  assert.ok(s.comments[0].body.startsWith(GUARD_MARKER));
});

test('publish: a guard comment is marked cleared once the sync works again, and a stale pull request is closed', () => {
  // protects: the thread does not keep saying "stopped". fails_when: the old guard text stays as the last word.
  const { gh, s } = fakeGh();
  publish({ outcome: 'guard', guard: renderGuard(new GuardError('x')), gh });
  assert.match(publish({ outcome: 'unchanged', gh }), /nothing to do/);
  assert.match(s.comments[0].body, /\*\*Cleared\.\*\*/);
  publish({ outcome: 'changed', report: 'R', gh });
  assert.match(publish({ outcome: 'unchanged', gh }), /closed stale pull request #/);
  assert.equal(s.prs[0].state, 'closed');
});

test('workflow: the program sync can never push to main', async () => {
  // protects: decision D6 (only Simon publishes). fails_when: any push in the workflow or scripts can reach main.
  // no_claim: a grep, not a proof; branch protection on main is the second lock and is Matt's to set.
  const text = await workflow('sync-program-schedules.yml');
  const code = text.split('\n').filter(l => !l.trim().startsWith('#')).join('\n');
  const pushes = code.split('\n').filter(l => /\bgit\s+push\b/.test(l) || /gh\s+api\b.*(git\/refs|merge)/.test(l) || /gh\s+pr\s+merge/.test(l));
  assert.ok(pushes.length >= 1, 'expected the force-push to the sync branch');
  for (const line of pushes) {
    assert.match(line, /--force origin "HEAD:refs\/heads\/\$BRANCH"/, `push must target the sync branch only: ${line.trim()}`);
    assert.doesNotMatch(line, /\bmain\b/);
  }
  assert.match(code, /BRANCH: sync\/program-schedules/);
  assert.doesNotMatch(code, /git push\s*$/m, 'a bare "git push" would follow the checked-out branch');
  assert.doesNotMatch(code, /git push[^\n]*(--all|--mirror|:main|origin main)/);
  assert.doesNotMatch(code, /pr merge|--auto|auto-merge/);
  const publisher = await readFile(new URL('./program-sync-publish.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(publisher.replace(/^\s*\/\/.*$/gm, ''), /'push'|git |'merge'/, 'the publisher never runs git or merges');
});

test('workflow: both syncs share the concurrency group content-sync', async () => {
  // protects: acceptance 6, two syncs never run at once. fails_when: either group is renamed.
  for (const f of ['sync-program-schedules.yml', 'sync-service-directory.yml']) {
    assert.match(await workflow(f), /concurrency:\s*\n\s+group: content-sync\n\s+cancel-in-progress: false/, f);
  }
});

test('workflow: runs every 30 minutes at 7 and 37 past, can be run by hand, and is off on a schedule until enabled', async () => {
  // protects: nothing runs against the live feed before H1. fails_when: the enable gate is removed.
  // no_claim: does not prove GitHub honours the gate; check the first scheduled run after setting the variable.
  const text = await workflow('sync-program-schedules.yml');
  assert.match(text, /cron: '7,37 \* \* \* \*'/);
  assert.match(text, /workflow_dispatch:/);
  assert.match(text, /vars\.PROGRAM_SYNC_ENABLED == 'true'/);
});
