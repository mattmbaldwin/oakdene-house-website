// Decap config generator (stage W7, issue #15): scripts/build-cms-config.mjs and src/content/schemas.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, mkdir, cp, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import yaml from 'js-yaml';
import { z } from 'astro/zod';
import { renderConfig, buildConfig, zodToDecapFields, validateContent, CONFIG_PATH } from '../scripts/build-cms-config.mjs';
import { cmsCollections, faqsSchema, openingHoursSchema, prose, text } from '../src/content/schemas.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('the committed config.yml is exactly what the schemas generate', async () => {
  const committed = await readFile(join(ROOT, CONFIG_PATH), 'utf8');
  assert.equal(committed, renderConfig(cmsCollections), 'run `npm run build:cms` and commit');
});

test('backend and workflow settings', () => {
  const config = yaml.load(renderConfig(cmsCollections));
  assert.deepEqual(
    { ...config.backend },
    {
      name: 'github',
      repo: 'mattmbaldwin/oakdene-house-website',
      branch: 'main',
      base_url: 'https://oakdenehouse.org.au',
      auth_endpoint: 'api/auth',
      auth_scope: 'public_repo',
      squash_merges: true,
    },
  );
  assert.equal(config.publish_mode, 'editorial_workflow');
  assert.equal(config.media_folder, 'public/images/uploads');
  assert.equal(config.public_folder, '/images/uploads');
});

test('collections: opening hours, FAQs and pages; program schedules are not exposed', () => {
  const config = buildConfig(cmsCollections);
  assert.deepEqual(config.collections.map((c) => c.name), ['opening-hours', 'faqs', 'pages']);
  const all = JSON.stringify(config);
  assert.ok(!/program-schedules/i.test(all), 'no collection reads the schedules file');
  // W4 pages have section headings named "schedule", so the word itself is allowed; the schedule rows' own time
  // fields (start, end) must not appear anywhere in the editor. ("day" is a legitimate opening-hours field.)
  const names = [];
  const walk = (fields) => {
    for (const f of fields ?? []) {
      names.push(f.name);
      walk(f.fields);
      if (f.field) walk([f.field]);
    }
  };
  for (const c of config.collections) for (const f of c.files ?? [{ fields: c.fields }]) walk(f.fields);
  for (const row of ['start', 'end']) assert.ok(!names.includes(row), `no "${row}" field`);
});

test('every markdown field is limited to bold, italic and link with no editor components', () => {
  const markdown = [];
  const walk = (fields) => {
    for (const f of fields ?? []) {
      if (f.widget === 'markdown') markdown.push(f);
      walk(f.fields);
    }
  };
  for (const c of buildConfig(cmsCollections).collections) for (const file of c.files ?? [c]) walk(file.fields);
  assert.ok(markdown.length >= 1, 'the FAQ answer is a markdown field');
  for (const f of markdown) {
    assert.deepEqual(f.buttons, ['bold', 'italic', 'link'], f.name);
    assert.deepEqual(f.editor_components, [], f.name);
  }
});

test('removing a field from a schema changes the generated config (drift is detectable)', () => {
  const trimmed = cmsCollections.map((c) =>
    c.name === 'faqs'
      ? { ...c, schema: faqsSchema.extend({ faqs: z.array(faqsSchema.shape.faqs.element.omit({ showOnHome: true })) }) }
      : c,
  );
  const before = renderConfig(cmsCollections);
  const after = renderConfig(trimmed);
  assert.notEqual(after, before);
  assert.ok(before.includes('name: showOnHome') && !after.includes('name: showOnHome'));
});

test('--check fails when config.yml is stale, and passes once regenerated', async () => {
  // A scratch copy of the project files the script reads, with a schema field removed but config.yml not regenerated.
  const dir = await mkdtemp(join(tmpdir(), 'cms-check-'));
  await mkdir(join(dir, 'scripts'), { recursive: true });
  await mkdir(join(dir, 'src/content'), { recursive: true });
  await mkdir(join(dir, 'public/admin'), { recursive: true });
  await cp(join(ROOT, 'scripts/build-cms-config.mjs'), join(dir, 'scripts/build-cms-config.mjs'));
  await cp(join(ROOT, CONFIG_PATH), join(dir, CONFIG_PATH));
  await cp(join(ROOT, 'src/content/pages'), join(dir, 'src/content/pages'), { recursive: true });
  const schemas = await readFile(join(ROOT, 'src/content/schemas.mjs'), 'utf8');
  const edited = schemas.replace(/\n\s*showOnHome: z\.boolean\(\)\.meta\(\{ title: 'Show on the home page' \}\),/, '');
  assert.notEqual(edited, schemas, 'test fixture: the showOnHome line was found and removed');
  await writeFile(join(dir, 'src/content/schemas.mjs'), edited);
  await symlink(join(ROOT, 'node_modules'), join(dir, 'node_modules'), 'dir');

  const run = (...args) => spawnSync(process.execPath, ['scripts/build-cms-config.mjs', ...args], { cwd: dir, encoding: 'utf8' });
  const stale = run('--check');
  assert.equal(stale.status, 1, stale.stdout + stale.stderr);
  assert.match(stale.stderr, /does not match src\/content\/schemas\.mjs/);

  assert.equal(run().status, 0);
  const fresh = run('--check');
  assert.equal(fresh.status, 0, fresh.stdout + fresh.stderr);
});

test('content that does not match its schema is reported; a missing file only warns', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cms-content-'));
  await mkdir(join(dir, 'src/content'), { recursive: true });
  const hours = {
    kitchen: { days: 'd', hours: 'h', seoDays: 's', homeSummary: 'h', programsSummary: 'p', contactSummary: 'c' },
    laundrette: { days: 'd', hours: 'h', lastEntry: 'l', seoDescription: 's', groupBookingDays: 'g', contactSummary: 'c' },
    staplePacks: { day: 'd', hours: 'h', seoDay: 's', distributionDay: 'd', alsoRunningDay: 'a', contactSummary: 'c' },
    clothingStore: { days: 'd', hours: 'h', contactSummary: 'c' },
    office: { days: 'd', hours: 'h', availability: 'a', notInSchema: 'x' },
  };
  await writeFile(join(dir, 'src/content/opening-hours.json'), JSON.stringify(hours));
  // File collections only: page files are covered by scripts/page-content.test.mjs.
  const fileCollections = cmsCollections.filter((c) => c.kind === 'file');
  const { problems, missing } = await validateContent(fileCollections, dir);
  assert.deepEqual(missing, ['src/content/faqs.yaml']);
  assert.equal(problems.length, 1, problems.join('\n'));
  assert.match(problems[0], /^src\/content\/opening-hours\.json: office: Unrecognized key/);

  delete hours.office.notInSchema;
  hours.kitchen.hours = '';
  await writeFile(join(dir, 'src/content/opening-hours.json'), JSON.stringify(hours));
  const second = await validateContent(fileCollections, dir);
  assert.equal(second.problems.length, 1);
  assert.match(second.problems[0], /kitchen\.hours/);
});

test('the real content files, where present, match their schemas', async () => {
  const { problems } = await validateContent(cmsCollections, ROOT);
  assert.deepEqual(problems, []);
});

test('field mapping: widgets, optional fields and labels', () => {
  const fields = zodToDecapFields(
    z.strictObject({
      title: text('Title', 'A hint'),
      body: prose('Body'),
      count: z.number().int(),
      ratio: z.number().optional(),
      kind: z.enum(['a', 'b']),
      tags: z.array(z.string()),
      showOnHome: z.boolean(),
    }),
  );
  assert.deepEqual(fields, [
    { name: 'title', label: 'Title', hint: 'A hint', widget: 'string' },
    { name: 'body', label: 'Body', widget: 'markdown', buttons: ['bold', 'italic', 'link'], editor_components: [] },
    { name: 'count', label: 'Count', widget: 'number', value_type: 'int' },
    { name: 'ratio', label: 'Ratio', required: false, widget: 'number', value_type: 'float' },
    { name: 'kind', label: 'Kind', widget: 'select', options: ['a', 'b'] },
    { name: 'tags', label: 'Tags', widget: 'list', field: { name: 'item', label: 'Item', widget: 'string' } },
    { name: 'showOnHome', label: 'Show on home', widget: 'boolean', default: false },
  ]);
});

test('non-strict objects and unsupported types are rejected, so no field is silently dropped', () => {
  assert.throws(() => zodToDecapFields(z.object({ a: z.string() })), /strictObject/);
  assert.throws(() => zodToDecapFields(z.strictObject({ a: z.date() })), /./);
});

test('folder collections (for the W4 page files) generate a folder entry', () => {
  const config = buildConfig([
    { kind: 'folder', name: 'pages', label: 'Pages', folder: 'src/content/pages', extension: 'yaml', format: 'yaml', create: false, schema: z.strictObject({ title: text('Title') }) },
  ]);
  assert.deepEqual(config.collections[0], {
    name: 'pages',
    label: 'Pages',
    folder: 'src/content/pages',
    extension: 'yaml',
    format: 'yaml',
    create: false,
    editor: { preview: false },
    fields: [{ name: 'title', label: 'Title', widget: 'string' }],
  });
  assert.throws(() => buildConfig([cmsCollections[0], cmsCollections[0]]), /duplicate/);
});

test('opening-hours schema matches the shape W5 writes (one object per service)', () => {
  assert.deepEqual(Object.keys(openingHoursSchema.shape), ['kitchen', 'laundrette', 'staplePacks', 'clothingStore', 'office']);
});
