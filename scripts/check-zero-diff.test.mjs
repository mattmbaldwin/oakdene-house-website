// Self-tests for scripts/check-zero-diff.mjs (website-editor stage W1, issue #9). Run with `npm test`.
// Each test carries its profile: protects (the observable it guards), fails_when (the wrong result it
// rejects) and no_claim (what a green result does not prove).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  collapseWhitespace,
  compareHtml,
  isIgnoredPage,
  listPages,
  normaliseHtml,
  stripAstroHashes,
} from './check-zero-diff.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, 'check-zero-diff.mjs');
const fixtures = join(here, 'fixtures', 'zero-diff');

const page = (body, head = '<title>T</title>') => `<!DOCTYPE html><html lang="en"><head>${head}</head><body>${body}</body></html>`;

/** Run the CLI on a fixture pair and return { status, stdout, stderr }. */
function runFixture(name) {
  const r = spawnSync(process.execPath, [script, '--dirs', join(fixtures, name, 'base'), join(fixtures, name, 'head')], {
    encoding: 'utf8',
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

// ---------------------------------------------------------------- Unit: normaliser

test('normaliser decodes entities in text and attribute values', () => {
  // protects: a content move from template text to data (where Astro writes &#39;) reads as no change.
  // fails_when: `'`, `&#39;`, `&apos;` or `&amp;` forms are compared as different strings.
  // no_claim: does not prove every named entity Astro could emit is covered beyond what parse5 decodes.
  const plain = normaliseHtml(page(`<p title="Oakdene's & co">We're open</p>`));
  for (const variant of [
    page(`<p title="Oakdene&#39;s &amp; co">We&#39;re open</p>`),
    page(`<p title="Oakdene&apos;s &#38; co">We&apos;re open</p>`),
    page(`<p title="Oakdene&#x27;s &amp; co">We&#x27;re open</p>`),
  ]) {
    assert.deepEqual(normaliseHtml(variant), plain);
  }
});

test('normaliser collapses whitespace runs in text nodes to one space', () => {
  // protects: re-wrapping a long line in a .astro file reads as no change.
  // fails_when: newlines, tabs or repeated spaces inside a <p> are reported as a difference.
  // no_claim: does not trim; whitespace added or removed at a text edge (next to an inline tag) is still reported.
  assert.equal(collapseWhitespace('a \n\t  b\r\n c'), 'a b c');
  assert.deepEqual(compareHtml(page('<p>One wash, one dry</p>'), page('<p>One wash,\n      one   dry</p>')), []);
  assert.equal(compareHtml(page('<p>a <b>b</b></p>'), page('<p>a<b>b</b></p>')).length, 1);
});

test('normaliser keeps whitespace exactly inside pre, textarea and script', () => {
  // protects: whitespace that is visible (pre, textarea) or meaningful (script) is still compared.
  // fails_when: a whitespace-only change inside pre, textarea or script passes.
  // no_claim: <style> text is collapsed like any other text node; CSS whitespace changes are not reported.
  for (const tag of ['pre', 'textarea', 'script']) {
    const diffs = compareHtml(page(`<${tag}>a  b</${tag}>`), page(`<${tag}>a b</${tag}>`));
    assert.equal(diffs.length, 1, `${tag} whitespace change should be reported`);
  }
});

test('normaliser strips /_astro/ content hashes only', () => {
  // protects: a rebuilt bundle (new hash) reads as no change, while a different asset name still differs.
  // fails_when: hash changes are reported, or a renamed /_astro/ asset or a non-/_astro/ path is hidden.
  // no_claim: does not compare the asset files' contents (CSS or JS) at all.
  assert.equal(stripAstroHashes('/_astro/BaseLayout.D9kWE2Hj.css'), '/_astro/BaseLayout.[hash].css');
  assert.equal(
    stripAstroHashes('/_astro/VideoPlayer.astro_astro_type_script_index_0_lang.DutKinDw.js'),
    '/_astro/VideoPlayer.astro_astro_type_script_index_0_lang.[hash].js',
  );
  assert.equal(stripAstroHashes('/_astro/photo.Dx3k_aB1_Z1abcd.webp'), '/_astro/photo.[hash].webp');
  assert.equal(stripAstroHashes('/images/kitchen/k1.D9kWE2Hj.jpg'), '/images/kitchen/k1.D9kWE2Hj.jpg');
  assert.equal(
    compareHtml(page('', '<link rel="stylesheet" href="/_astro/a.D9kWE2Hj.css">'), page('', '<link rel="stylesheet" href="/_astro/b.D9kWE2Hj.css">')).length,
    1,
  );
  assert.equal(runFixture('pass-astro-hash').status, 0);
});

test('page lister skips /admin/ and nothing else', () => {
  // protects: the Decap editor at /admin/ never blocks a stage, while every public page is compared.
  // fails_when: an admin page is compared, or a public page whose path merely contains "admin" is skipped.
  // no_claim: does not check the admin page works.
  assert.equal(isIgnoredPage('admin/index.html'), true);
  assert.equal(isIgnoredPage('admin/collections/index.html'), true);
  assert.equal(isIgnoredPage('about/admin-team/index.html'), false);
  assert.equal(isIgnoredPage('administration/index.html'), false);
  assert.deepEqual(listPages(join(fixtures, 'pass-admin-ignored', 'head')), ['index.html']);
  assert.equal(runFixture('pass-admin-ignored').status, 0);
});

// ---------------------------------------------------------------- Unit: comparer (fixture pairs through the CLI)

test('fixture: apostrophe vs &#39; exits 0', () => {
  // protects: acceptance criterion 3, entity form.
  // fails_when: the CLI exits non-zero for a page that differs only by `'` vs `&#39;`.
  // no_claim: one page, one entity form; the decoding unit test covers the others.
  const r = runFixture('pass-apostrophe-entity');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /Zero difference/);
});

test('fixture: line-wrap whitespace in <p> exits 0', () => {
  // protects: acceptance criterion 3, whitespace form.
  // fails_when: the CLI exits non-zero for a <p> re-wrapped across lines.
  // no_claim: the fixture's <pre> is unchanged; pre handling is covered by its own unit test.
  const r = runFixture('pass-line-wrap-whitespace');
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('fixture: one changed word exits 1 and names it', () => {
  // protects: acceptance criterion 2a, a text change is caught and shown before and after.
  // fails_when: the CLI exits 0, or the report does not show both versions of the text.
  // no_claim: does not prove the report pinpoints the word inside a long text node (whole node is shown).
  const r = runFixture('fail-changed-word');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /index\.html: .*main:nth-child\(1\) > p:nth-child\(1\) > #text: "Open Tuesday and Thursday, 10am to 4pm\." → "Open Tuesday and Friday, 10am to 4pm\."/);
});

test('fixture: one changed attribute value exits 1 and names it', () => {
  // protects: acceptance criterion 2b, a changed link, image path or alt text is caught.
  // fails_when: the CLI exits 0, or the report omits the attribute's before and after values.
  // no_claim: attribute order changes are also reported (by design) but this fixture does not exercise them.
  const r = runFixture('fail-changed-attribute');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /a:nth-child\(1\) \[attributes\]: href="tel:0287170999" → href="tel:0287170998"/);
});

test('fixture: two swapped sibling elements exits 1 and names both', () => {
  // protects: acceptance criterion 2c, element order is compared, not just the set of elements.
  // fails_when: the CLI exits 0, or reports only one of the two moved positions.
  // no_claim: does not detect a move as a move; it reports each position that changed.
  const r = runFixture('fail-swapped-siblings');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /h2:nth-child\(1\): <h2> → <p>/);
  assert.match(r.stdout, /p:nth-child\(2\): <p> → <h2>/);
  // Same-tag siblings swapped: reported through their text.
  const sameTag = compareHtml(page('<ul><li>Kitchen</li><li>Laundrette</li></ul>'), page('<ul><li>Laundrette</li><li>Kitchen</li></ul>'));
  assert.equal(sameTag.length, 2);
});

test('comparer reports added and removed pages and attribute order', () => {
  // protects: a stage cannot drop or add a page, or reorder attributes, unnoticed.
  // fails_when: a page present on one side only, or attributes in a new order, give zero differences.
  // no_claim: attribute order has no visual effect; it is compared because the issue asks for it.
  assert.equal(compareHtml(page('<a href="/" class="x">h</a>'), page('<a class="x" href="/">h</a>')).length, 1);
  const r = spawnSync(process.execPath, [script, '--dirs', join(fixtures, 'pass-admin-ignored', 'head'), join(fixtures, 'fail-changed-word', 'head')], {
    encoding: 'utf8',
  });
  assert.equal(r.status, 1);
});

// ---------------------------------------------------------------- Integration: the real site against itself

test('integration: the real site built twice from the same commit has zero difference', { timeout: 600_000 }, () => {
  // protects: acceptance criterion 1; the Astro build is deterministic under this normalisation, so a later
  //   stage's failure means a real change, not build noise.
  // fails_when: building the same commit twice gives any difference (non-deterministic output, or a
  //   normalisation gap), or either build fails.
  // no_claim: does not prove a real content move passes; each W stage proves that on its own PR.
  //   Uses ZERO_DIFF_REF (default HEAD); CI checks the PR head, `origin/main origin/main` is run by hand.
  const ref = process.env.ZERO_DIFF_REF || 'HEAD';
  const r = spawnSync(process.execPath, [script, ref, ref], { encoding: 'utf8', cwd: join(here, '..') });
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr.slice(-2000)}`);
  assert.match(r.stdout, /Zero difference: .*\d+ page\(s\) compared/);
});
