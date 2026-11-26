#!/usr/bin/env node
// Generates public/admin/config.yml (the Decap CMS config for /admin) from the Zod schemas in
// src/content/schemas.mjs. Website-editor stage W7, issue #15.
//
//   node scripts/build-cms-config.mjs          write public/admin/config.yml   (npm run build:cms)
//   node scripts/build-cms-config.mjs --check  fail if it is out of date, or if a content file does not match
//                                              its schema                       (npm run check:cms, run by build)
//
// The committed config.yml is the file Decap reads. `npm run build` runs --check, so changing a schema without
// regenerating fails the build instead of shipping an editor that disagrees with the site.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import yaml from 'js-yaml';
import { z } from 'astro/zod';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const CONFIG_PATH = 'public/admin/config.yml';

/** Site-wide editor settings. Collections come from the schemas. */
export const BASE_CONFIG = {
  backend: {
    name: 'github',
    repo: 'mattmbaldwin/oakdene-house-website',
    branch: 'main',
    base_url: 'https://oakdenehouse.org.au',
    auth_endpoint: 'api/auth',
    auth_scope: 'public_repo',
    squash_merges: true,
  },
  publish_mode: 'editorial_workflow',
  site_url: 'https://oakdenehouse.org.au',
  display_url: 'https://oakdenehouse.org.au',
  media_folder: 'public/images/uploads',
  public_folder: '/images/uploads',
};

/** The markdown widget is limited to what renderProse() (src/lib/prose.ts) accepts. */
const MARKDOWN_OPTIONS = { buttons: ['bold', 'italic', 'link'], editor_components: [] };

const HEADER = `# GENERATED FILE. Do not edit by hand.
# Source: src/content/schemas.mjs. Regenerate with: npm run build:cms
# npm run build fails if this file does not match the schemas.
`;

/** "showOnFaqPage" -> "Show on faq page" */
export function humanise(key) {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Convert one JSON-schema node (from z.toJSONSchema) into a Decap field.
 * Throws on any schema shape the editor cannot represent, so a new schema cannot silently lose a field.
 */
function toField(name, node, required, path) {
  const where = path.join('.');
  const cms = node.cms ?? {};
  const field = { name, label: node.title ?? humanise(name) };
  if (node.description) field.hint = node.description;
  if (!required) field.required = false;

  if (node.enum) {
    if (!node.enum.every((v) => typeof v === 'string')) throw new Error(`${where}: only text options are supported`);
    return { ...field, widget: 'select', options: [...node.enum] };
  }

  switch (node.type) {
    case 'string': {
      const widget = cms.widget ?? 'string';
      if (!['string', 'text', 'markdown'].includes(widget)) throw new Error(`${where}: unknown text widget "${widget}"`);
      const out = { ...field, widget };
      if (widget === 'markdown') Object.assign(out, MARKDOWN_OPTIONS);
      if (node.pattern) out.pattern = [node.pattern, `Must match ${node.pattern}`];
      return out;
    }
    case 'boolean':
      return { ...field, widget: 'boolean', default: false };
    case 'integer':
      return { ...field, widget: 'number', value_type: 'int' };
    case 'number':
      return { ...field, widget: 'number', value_type: 'float' };
    case 'object':
      return {
        ...field,
        widget: 'object',
        ...(cms.collapsed ? { collapsed: true } : {}),
        fields: objectFields(node, path),
      };
    case 'array': {
      const items = node.items;
      if (!items || Array.isArray(items)) throw new Error(`${where}: list items need one schema`);
      const out = { ...field, widget: 'list' };
      if (cms.summary) out.summary = cms.summary;
      if (items.title) out.label_singular = items.title;
      if (items.type === 'object') {
        out.fields = objectFields(items, [...path, '[]']);
      } else {
        out.field = toField('item', items, true, [...path, '[]']);
      }
      return out;
    }
    default:
      throw new Error(`${where}: the editor cannot show a field of type ${JSON.stringify(node.type ?? node)}`);
  }
}

function objectFields(node, path) {
  if (node.type !== 'object' || !node.properties) throw new Error(`${path.join('.')}: expected an object schema`);
  if (node.additionalProperties !== false) {
    throw new Error(`${path.join('.')}: use z.strictObject so data keys the editor cannot see fail the build`);
  }
  const required = new Set(node.required ?? []);
  return Object.entries(node.properties).map(([key, child]) => toField(key, child, required.has(key), [...path, key]));
}

/** Decap `fields` for a Zod object schema. */
export function zodToDecapFields(schema, name = 'schema') {
  // `io: 'input'` so optional/default fields are reported as not required, the way an editor sees them.
  const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'throw' });
  return objectFields(json, [name]);
}

function toCollection(c) {
  const fields = zodToDecapFields(c.schema, c.name);
  if (c.kind === 'file') {
    return {
      name: c.name,
      label: c.label,
      format: c.format,
      editor: { preview: false },
      files: [{ name: c.name, label: c.label, file: c.file, fields }],
    };
  }
  if (c.kind === 'folder') {
    const { kind, schema, ...decap } = c;
    return { ...decap, editor: { preview: false }, fields };
  }
  throw new Error(`collection ${c.name}: unknown kind "${c.kind}"`);
}

/** The whole Decap config object for a list of collections. */
export function buildConfig(collections) {
  const names = new Set();
  for (const c of collections) {
    if (names.has(c.name)) throw new Error(`duplicate collection name "${c.name}"`);
    names.add(c.name);
  }
  return { ...BASE_CONFIG, collections: collections.map(toCollection) };
}

/** The config.yml text for a list of collections. Deterministic: same schemas, same bytes. */
export function renderConfig(collections) {
  return HEADER + yaml.dump(buildConfig(collections), { lineWidth: -1, noRefs: true, quotingType: '"' });
}

/**
 * Check each content file against its schema. Returns { problems, missing }: problems fail the build; a missing
 * file only warns (the stage that creates it may not have merged yet, and Decap simply shows nothing for it).
 */
export async function validateContent(collections, root = ROOT) {
  const problems = [];
  const missing = [];
  for (const c of collections) {
    if (c.kind !== 'file') continue;
    const full = resolve(root, c.file);
    if (!existsSync(full)) {
      missing.push(c.file);
      continue;
    }
    const raw = await readFile(full, 'utf8');
    let data;
    try {
      data = c.format === 'json' ? JSON.parse(raw) : yaml.load(raw);
    } catch (err) {
      problems.push(`${c.file}: cannot be parsed: ${err.message}`);
      continue;
    }
    const result = c.schema.safeParse(data);
    if (!result.success) {
      for (const issue of result.error.issues) {
        problems.push(`${c.file}: ${issue.path.join('.') || '(top level)'}: ${issue.message}`);
      }
    }
  }
  return { problems, missing };
}

async function main(argv) {
  const { cmsCollections } = await import(pathToFileURL(resolve(ROOT, 'src/content/schemas.mjs')).href);
  const expected = renderConfig(cmsCollections);
  const target = resolve(ROOT, CONFIG_PATH);

  if (!argv.includes('--check')) {
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, expected);
    console.log(`build-cms-config: wrote ${CONFIG_PATH} (${cmsCollections.length} collections)`);
    return 0;
  }

  let failed = false;
  const actual = existsSync(target) ? await readFile(target, 'utf8') : null;
  if (actual !== expected) {
    failed = true;
    console.error(
      `build-cms-config: ${CONFIG_PATH} ${actual === null ? 'is missing' : 'does not match src/content/schemas.mjs'}.\n` +
        '  Run `npm run build:cms` and commit the result.',
    );
  }
  const { problems, missing } = await validateContent(cmsCollections);
  for (const file of missing) console.warn(`build-cms-config: warning: ${file} does not exist yet; its editor form will be empty`);
  if (problems.length) {
    failed = true;
    console.error('build-cms-config: content does not match its schema:');
    for (const p of problems) console.error(`  ${p}`);
  }
  if (failed) return 1;
  console.log(`build-cms-config: ${CONFIG_PATH} is up to date; ${cmsCollections.length - missing.length} content file(s) match their schemas`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      console.error(`build-cms-config: ${err.stack ?? err}`);
      process.exit(1);
    },
  );
}
