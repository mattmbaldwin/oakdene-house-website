// Page content model (website-editor stage W4, issue #12): the `pages` schemas in src/content/schemas.mjs, the
// page files in src/content/pages/, and the Decap forms scripts/build-cms-config.mjs generates for them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdtemp, mkdir, writeFile, cp, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import yaml from 'js-yaml';
import { z } from 'astro/zod';
import { buildConfig, validateContent, zodToDecapFields, pageFilePath } from './build-cms-config.mjs';
import {
  cmsCollections,
  pageLayouts,
  pageFiles,
  pageSchema,
  button,
  BUTTON_STYLES,
  PAGES_FOLDER,
  HREF_PATTERN,
} from '../src/content/schemas.mjs';
import { renderProse } from '../src/lib/prose.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pagesCollection = cmsCollections.find((c) => c.kind === 'pages');

async function loadPage(name) {
  return yaml.load(await readFile(join(ROOT, PAGES_FOLDER, `${name}.yaml`), 'utf8'));
}

/** A scratch project root holding only the page files, with `edit` applied to one page's data. */
async function scratchWithPage(name, edit) {
  const dir = await mkdtemp(join(tmpdir(), 'pages-'));
  await cp(join(ROOT, PAGES_FOLDER), join(dir, PAGES_FOLDER), { recursive: true });
  const data = await loadPage(name);
  edit(data);
  await writeFile(join(dir, PAGES_FOLDER, `${name}.yaml`), yaml.dump(data, { lineWidth: -1 }));
  return dir;
}

// protects: acceptance criterion 2 (a page file with seo.description removed or emptied fails the build, naming
//           the file and the field).
// fails_when: a required field can be dropped or blanked and the page still builds (it would show an empty tag
//             or the BaseLayout default instead of Simon's text).
// no_claim: Astro's own collection check is exercised by `npm run build`, not here; this covers the
//           check:cms step that build runs first.
test('a page file missing a required field, or with it empty, fails naming the file and the field', async () => {
  const name = 'services--aa-ga-meetings';
  const file = `${PAGES_FOLDER}/${name}.yaml`;

  const missing = await scratchWithPage(name, (d) => delete d.seo.description);
  const first = await validateContent([pagesCollection], missing);
  assert.equal(first.problems.length, 1, first.problems.join('\n'));
  assert.ok(first.problems[0].startsWith(`${file}: seo.description: `), first.problems[0]);

  const empty = await scratchWithPage(name, (d) => (d.overview.helpItems[1] = ''));
  const second = await validateContent([pagesCollection], empty);
  assert.equal(second.problems.length, 1, second.problems.join('\n'));
  assert.ok(second.problems[0].startsWith(`${file}: overview.helpItems.1: `), second.problems[0]);

  // The same failure through the command `npm run build` runs first (check:cms), in a scratch project.
  await mkdir(join(missing, 'scripts'), { recursive: true });
  await mkdir(join(missing, 'public/admin'), { recursive: true });
  await cp(join(ROOT, 'scripts/build-cms-config.mjs'), join(missing, 'scripts/build-cms-config.mjs'));
  await cp(join(ROOT, 'src/content/schemas.mjs'), join(missing, 'src/content/schemas.mjs'));
  await cp(join(ROOT, 'public/admin/config.yml'), join(missing, 'public/admin/config.yml'));
  await symlink(join(ROOT, 'node_modules'), join(missing, 'node_modules'), 'dir');
  const run = spawnSync(process.execPath, ['scripts/build-cms-config.mjs', '--check'], { cwd: missing, encoding: 'utf8' });
  assert.equal(run.status, 1, run.stdout + run.stderr);
  assert.match(run.stderr, /src\/content\/pages\/services--aa-ga-meetings\.yaml: seo\.description: /);
});

// protects: button style is one of the three styles the site's CSS defines.
// fails_when: a typo or invented style ("blue", "Primary") is accepted and the button renders unstyled.
// no_claim: none of the three batch-1 pages has a styled inline button (their buttons are in the CTA band, whose
//           styles the band fixes); this proves the shared field type later batches use.
test('a button with a style other than primary, secondary or white fails', () => {
  const schema = button();
  const ok = { label: 'Contact Us', href: '/contact/', style: 'primary' };
  for (const style of BUTTON_STYLES) assert.equal(schema.safeParse({ ...ok, style }).success, true, style);
  for (const style of ['blue', 'Primary', 'white-outline', '']) {
    const result = schema.safeParse({ ...ok, style });
    assert.equal(result.success, false, `style "${style}" was accepted`);
    assert.deepEqual(result.error.issues.map((i) => i.path.join('.')), ['style']);
  }
  assert.equal(schema.safeParse({ label: 'x', href: 'javascript:alert(1)', style: 'primary' }).success, false);

  // In the editor the style is a drop-down of exactly those three.
  const [, , style] = zodToDecapFields(z.strictObject({ b: button() }))[0].fields;
  assert.deepEqual(style, { name: 'style', label: 'Style', hint: style.hint, widget: 'select', options: BUTTON_STYLES });
});

/** Every key path in a JSON schema, e.g. "overview.paragraphs[]", "seo.image". */
function schemaPaths(node, prefix = '') {
  const out = [];
  if (node.type === 'object') {
    for (const [key, child] of Object.entries(node.properties)) {
      const p = prefix ? `${prefix}.${key}` : key;
      out.push(p, ...schemaPaths(child, p));
    }
  } else if (node.type === 'array') {
    out.push(...schemaPaths(node.items, `${prefix}[]`).filter((p) => p !== `${prefix}[]`));
  }
  return out;
}

/** Every field path in generated Decap fields, in the same notation. */
function decapPaths(fields, prefix = '') {
  const out = [];
  for (const f of fields) {
    const p = prefix ? `${prefix}.${f.name}` : f.name;
    out.push(p);
    if (f.fields) out.push(...decapPaths(f.fields, f.widget === 'list' ? `${p}[]` : p));
  }
  return out;
}

/** Every key path present in a page file's data. */
function dataPaths(value, prefix = '') {
  if (Array.isArray(value)) return value.flatMap((v) => dataPaths(v, `${prefix}[]`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => {
      const p = prefix ? `${prefix}.${k}` : k;
      return [p, ...dataPaths(v, p)];
    });
  }
  return [];
}

// protects: acceptance criterion 4 (the three pages appear in /admin with every field) and the generator side of
//           decision D5: every key a layout schema defines, and every key in the page files, is a form field.
// fails_when: a schema key or a data key has no editor field, so Simon could not change that text.
// no_claim: does not open /admin in a browser or sign in; Decap's own rendering of config.yml is not tested.
test('the generated editor has a field for every schema key and every value in the page files', async () => {
  const config = buildConfig(cmsCollections);
  const pages = config.collections.find((c) => c.name === 'pages');
  assert.deepEqual(
    pages.files.map((f) => f.file),
    pageFiles.map((p) => pageFilePath(pagesCollection, p)),
  );
  for (const page of pageFiles) {
    const form = pages.files.find((f) => f.name === page.name);
    const fields = new Set(decapPaths(form.fields));
    const json = z.toJSONSchema(pageLayouts[page.layout], { io: 'input' });
    const keys = schemaPaths(json);
    assert.ok(keys.length > 15, `${page.name}: walked ${keys.length} schema keys`);
    for (const key of keys) assert.ok(fields.has(key), `${page.name}: schema key ${key} has no editor field`);
    for (const key of fields) assert.ok(keys.includes(key), `${page.name}: editor field ${key} is not in the schema`);
    for (const key of new Set(dataPaths(await loadPage(page.name)))) {
      assert.ok(fields.has(key), `${page.name}: value at ${key} has no editor field`);
    }
    assert.deepEqual(form.fields[0], { name: 'layout', label: 'Layout', widget: 'hidden', default: page.layout });
  }
});

// protects: the three real page files validate, and every prose field renders through the one prose renderer.
// fails_when: a page file drifts from its schema, or holds Markdown renderProse() refuses (the build would fail).
// no_claim: that the rendered pages match main; that is the zero-difference check.
test('the real page files match their layouts and every prose field renders', async () => {
  const { problems } = await validateContent([pagesCollection], ROOT);
  assert.deepEqual(problems, []);
  for (const page of pageFiles) {
    const data = await loadPage(page.name);
    assert.equal(pageSchema.parse(data).layout, page.layout);
    let count = 0;
    const visit = (schemaNode, value, path) => {
      if (schemaNode.cms?.widget === 'markdown') {
        renderProse(value, `${page.name}: ${path}`);
        count++;
      } else if (schemaNode.type === 'object') {
        for (const [k, child] of Object.entries(schemaNode.properties)) {
          if (value[k] !== undefined) visit(child, value[k], `${path}${path ? '.' : ''}${k}`);
        }
      } else if (schemaNode.type === 'array') {
        value.forEach((v, i) => visit(schemaNode.items, v, `${path}.${i}`));
      }
    };
    visit(z.toJSONSchema(pageLayouts[page.layout], { io: 'input' }), data, '');
    assert.ok(count >= 1, `${page.name}: rendered ${count} prose fields`);
  }
});

// protects: every page file is reachable from the editor and uses the layout its listing says.
// fails_when: a new YAML file is added without listing it (invisible in /admin), or its layout is wrong.
test('an unlisted page file or a wrong layout fails', async () => {
  const dir = await scratchWithPage('services--group-dbt-therapy', (d) => (d.layout = 'aa-ga-meetings'));
  await writeFile(join(dir, PAGES_FOLDER, 'about--extra.yaml'), 'layout: aa-ga-meetings\n');
  const { problems } = await validateContent([pagesCollection], dir);
  assert.deepEqual(problems, [
    `${PAGES_FOLDER}/services--group-dbt-therapy.yaml: layout: expected "group-dbt-therapy", found "aa-ga-meetings"`,
    `${PAGES_FOLDER}/about--extra.yaml: not listed in pageFiles in src/content/schemas.mjs, so the editor cannot show it`,
  ]);
  const files = (await readdir(join(ROOT, PAGES_FOLDER))).filter((f) => f.endsWith('.yaml')).sort();
  assert.deepEqual(files, pageFiles.map((p) => `${p.name}.yaml`).sort());
});

// protects: links and buttons accept exactly the addresses the prose renderer accepts.
test('the link address rule matches the prose renderer', async () => {
  const prose = await readFile(join(ROOT, 'src/lib/prose.ts'), 'utf8');
  const literal = prose.match(/^const HREF = \/(.*)\/;$/m)[1];
  assert.equal(new RegExp(HREF_PATTERN).source, new RegExp(literal).source);
});
