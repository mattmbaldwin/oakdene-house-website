#!/usr/bin/env node
// Zero-difference check (website-editor stage W1, issue #9).
//
// Proves a change altered HOW the site is built, not WHAT it shows: it builds two git refs and compares every
// page as a parsed DOM rather than as bytes. A byte comparison would wrongly fail every content move, because
// Astro escapes text that comes from data (an apostrophe becomes &#39;) but leaves inline template text alone.
//
// Usage:
//   node scripts/check-zero-diff.mjs <baseRef> <headRef>     build both refs, then compare
//   node scripts/check-zero-diff.mjs --dirs <baseDir> <headDir>   compare two already-built folders
//
// Exit 0 = no difference. Exit 1 = at least one difference (each one printed). Exit 2 = usage or build error.
//
// Normalisation, applied identically to both sides (nothing else is ignored):
//   1. Entities are decoded: the HTML is parsed with parse5, the WHATWG-conformant parser, so `'` and `&#39;`
//      and `&apos;` all become the same text or attribute value.
//   2. Whitespace rule (the only one): in a text node, every run of whitespace (space, tab, newline, CR, FF)
//      becomes one space. Text inside <pre>, <textarea> or <script> is kept exactly. Leading and trailing
//      whitespace is collapsed, not trimmed, so adding or removing a space next to an inline element is still
//      reported.
//   3. Content hashes in /_astro/ asset names are replaced with [hash] (name.D9kWE2Hj.css -> name.[hash].css),
//      in attribute values and in text, because they change whenever any bundled code changes.
//   4. Pages under /admin/ are skipped (the Decap editor is not part of the public site).
//   5. HTML comments are dropped (they are not rendered).
// Compared: the set of HTML pages; for each page, element order, tag names, attribute names, values and order,
// and text, including the doctype.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';

const RAW_TEXT_PARENTS = new Set(['pre', 'textarea', 'script']);
const ASTRO_HASH = /(\/_astro\/[^"'\s()<>,?#]*?)\.[A-Za-z0-9_-]{8}(?:_[A-Za-z0-9_-]+)?\.([A-Za-z0-9]+)/g;
const MAX_SHOWN = 120;

/** Replace /_astro/ content hashes with a fixed placeholder. */
export function stripAstroHashes(value) {
  return value.replace(ASTRO_HASH, '$1.[hash].$2');
}

/** The whitespace rule: collapse runs of whitespace to one space unless kept raw. */
export function collapseWhitespace(text) {
  return text.replace(/[ \t\n\r\f]+/g, ' ');
}

/** True if the page is outside the comparison (the /admin/ editor). `rel` uses / separators. */
export function isIgnoredPage(rel) {
  return rel === 'admin' || rel.startsWith('admin/');
}

/**
 * Parse an HTML string into a plain normalised tree:
 *   { type: 'doctype', name } | { type: 'text', value } | { type: 'element', tag, attrs: [[name, value]], children }
 */
export function normaliseHtml(html) {
  const doc = parse(html);
  return { type: 'document', tag: '#document', attrs: [], children: normaliseChildren(doc, false) };
}

function normaliseChildren(node, raw) {
  // <template> content lives in node.content in parse5.
  const kids = node.content ? node.content.childNodes : node.childNodes || [];
  const out = [];
  for (const child of kids) {
    if (child.nodeName === '#comment') continue;
    if (child.nodeName === '#documentType') {
      out.push({ type: 'doctype', name: child.name });
    } else if (child.nodeName === '#text') {
      const value = stripAstroHashes(raw ? child.value : collapseWhitespace(child.value));
      const prev = out[out.length - 1];
      // Dropping a comment can leave two text nodes side by side; join them as the browser would render them.
      if (prev && prev.type === 'text') prev.value = raw ? prev.value + value : collapseWhitespace(prev.value + value);
      else out.push({ type: 'text', value });
    } else if (child.tagName) {
      const tag = child.tagName;
      out.push({
        type: 'element',
        tag,
        attrs: child.attrs.map((a) => [a.prefix ? `${a.prefix}:${a.name}` : a.name, stripAstroHashes(a.value)]),
        children: normaliseChildren(child, raw || RAW_TEXT_PARENTS.has(tag)),
      });
    }
  }
  return out;
}

function show(value) {
  const s = JSON.stringify(value);
  return s.length > MAX_SHOWN ? `${s.slice(0, MAX_SHOWN - 1)}…"` : s;
}

function describe(node) {
  if (!node) return '(nothing)';
  if (node.type === 'text') return `text ${show(node.value)}`;
  if (node.type === 'doctype') return `<!DOCTYPE ${node.name}>`;
  const attrs = node.attrs.map(([n, v]) => ` ${n}=${show(v)}`).join('');
  return `<${node.tag}${attrs}>`;
}

function step(parentPath, node, index, siblings) {
  if (node.type !== 'element') return `${parentPath} > #${node.type}`;
  const elementIndex = siblings.slice(0, index + 1).filter((n) => n.type === 'element').length;
  const part = `${node.tag}:nth-child(${elementIndex})`;
  return parentPath ? `${parentPath} > ${part}` : part;
}

/**
 * Compare two normalised trees. Returns a list of { selector, before, after } strings, in document order.
 */
export function compareTrees(a, b, path = '') {
  const diffs = [];
  if (a.tag !== b.tag) {
    diffs.push({ selector: path || '/', before: describe(a), after: describe(b) });
    return diffs;
  }
  const attrsA = a.attrs.map(([n, v]) => `${n}=${JSON.stringify(v)}`).join(' ');
  const attrsB = b.attrs.map(([n, v]) => `${n}=${JSON.stringify(v)}`).join(' ');
  if (attrsA !== attrsB) {
    diffs.push({ selector: `${path || '/'} [attributes]`, before: attrsA || '(none)', after: attrsB || '(none)' });
  }
  const n = Math.max(a.children.length, b.children.length);
  for (let i = 0; i < n; i++) {
    const ca = a.children[i];
    const cb = b.children[i];
    const childPath = step(path, ca || cb, i, ca ? a.children : b.children);
    if (!ca || !cb || ca.type !== cb.type) {
      diffs.push({ selector: childPath, before: describe(ca), after: describe(cb) });
    } else if (ca.type === 'text') {
      if (ca.value !== cb.value) diffs.push({ selector: childPath, before: show(ca.value), after: show(cb.value) });
    } else if (ca.type === 'doctype') {
      if (ca.name !== cb.name) diffs.push({ selector: childPath, before: describe(ca), after: describe(cb) });
    } else if (ca.tag !== cb.tag) {
      diffs.push({ selector: childPath, before: describe(ca), after: describe(cb) });
    } else {
      diffs.push(...compareTrees(ca, cb, childPath));
    }
  }
  return diffs;
}

/** Compare two HTML strings. */
export function compareHtml(before, after) {
  return compareTrees(normaliseHtml(before), normaliseHtml(after));
}

/** Every *.html file under dir, as /-separated relative paths, minus ignored pages. */
export function listPages(dir) {
  const pages = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const full = join(d, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith('.html')) pages.push(relative(dir, full).split(sep).join('/'));
    }
  };
  walk(dir);
  return pages.filter((p) => !isIgnoredPage(p)).sort();
}

/** Compare two built folders. Returns a list of { page, selector, before, after }. */
export function compareDirs(baseDir, headDir) {
  const basePages = listPages(baseDir);
  const headPages = listPages(headDir);
  const headSet = new Set(headPages);
  const baseSet = new Set(basePages);
  const diffs = [];
  for (const page of [...new Set([...basePages, ...headPages])].sort()) {
    if (!headSet.has(page)) diffs.push({ page, selector: '(page)', before: 'present', after: 'missing' });
    else if (!baseSet.has(page)) diffs.push({ page, selector: '(page)', before: 'missing', after: 'present' });
    else {
      const found = compareHtml(readFileSync(join(baseDir, page), 'utf8'), readFileSync(join(headDir, page), 'utf8'));
      for (const d of found) diffs.push({ page, ...d });
    }
  }
  return diffs;
}

function run(cmd, args, cwd) {
  // stdout to stderr so the report on stdout stays clean; stderr passes through untouched.
  execFileSync(cmd, args, { cwd, stdio: ['ignore', process.stderr, process.stderr] });
}

/** Check out `ref` into a temporary git worktree, install and build it. Returns { dir, dist, cleanup }. */
export function buildRef(ref, repoRoot) {
  const dir = mkdtempSync(join(tmpdir(), 'zero-diff-'));
  run('git', ['worktree', 'add', '--detach', dir, ref], repoRoot);
  const cleanup = () => {
    try {
      execFileSync('git', ['worktree', 'remove', '--force', dir], { cwd: repoRoot, stdio: 'ignore' });
    } catch {
      rmSync(dir, { recursive: true, force: true });
    }
  };
  try {
    run('npm', ['ci', '--no-audit', '--no-fund'], dir);
    run('npm', ['run', 'build'], dir);
  } catch (err) {
    cleanup();
    throw new Error(`build of ${ref} failed: ${err.message}`);
  }
  return { dir, dist: join(dir, 'dist'), cleanup };
}

function report(diffs, label) {
  for (const d of diffs) console.log(`${d.page}: ${d.selector}: ${d.before} → ${d.after}`);
  if (diffs.length === 0) {
    console.log(`Zero difference: ${label}.`);
    return 0;
  }
  const pages = new Set(diffs.map((d) => d.page)).size;
  console.log(`${diffs.length} difference(s) on ${pages} page(s): ${label}.`);
  return 1;
}

function main(argv) {
  if (argv[0] === '--dirs' && argv.length === 3) {
    return report(compareDirs(argv[1], argv[2]), `${argv[1]} vs ${argv[2]}`);
  }
  if (argv.length !== 2 || argv[0].startsWith('-')) {
    console.error('Usage: node scripts/check-zero-diff.mjs <baseRef> <headRef>\n' +
      '       node scripts/check-zero-diff.mjs --dirs <baseDir> <headDir>');
    return 2;
  }
  const [baseRef, headRef] = argv;
  const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const resolve = (ref) => execFileSync('git', ['rev-parse', '--verify', `${ref}^{commit}`], { cwd: repoRoot, encoding: 'utf8' }).trim();
  const baseSha = resolve(baseRef);
  const headSha = resolve(headRef);
  const built = [];
  try {
    console.error(`Building base ${baseRef} (${baseSha.slice(0, 7)})`);
    built.push(buildRef(baseSha, repoRoot));
    console.error(`Building head ${headRef} (${headSha.slice(0, 7)})`);
    built.push(buildRef(headSha, repoRoot));
    const label = `${baseRef} (${baseSha.slice(0, 7)}) vs ${headRef} (${headSha.slice(0, 7)}), ` +
      `${listPages(built[0].dist).length} page(s) compared`;
    return report(compareDirs(built[0].dist, built[1].dist), label);
  } finally {
    for (const b of built) b.cleanup();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    process.exitCode = 2;
  }
}
