// Astro content collections for the files the website editor (/admin) can change. Stage W7, issue #15.
//
// The schemas live in src/content/schemas.mjs, which scripts/build-cms-config.mjs also reads to generate the
// Decap config, so the site and the editor share one definition. Each editable file is loaded whole, as a single
// entry with id "data", and checked against its schema during `astro build`.
//
// (Astro 6 reads collections from src/content.config.ts; the older src/content/config.ts location is an error.)
import { defineCollection } from 'astro:content';
import { glob, type Loader } from 'astro/loaders';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import yaml from 'js-yaml';
import { cmsCollections, pageSchema, PAGES_FOLDER } from './content/schemas.mjs';

/** Load one JSON or YAML file as a single entry. A file that does not exist yet loads as an empty collection. */
function wholeFile(file: string, format: 'json' | 'yaml'): Loader {
  return {
    name: 'whole-file',
    load: async ({ store, parseData, logger, watcher }) => {
      // Paths are relative to the project root, where `astro` runs.
      const url = resolve(process.cwd(), file);
      store.clear();
      if (!existsSync(url)) {
        logger.warn(`${file} does not exist yet`);
        return;
      }
      const raw = await readFile(url, 'utf8');
      const parsed = format === 'json' ? JSON.parse(raw) : yaml.load(raw);
      const data = await parseData({ id: 'data', data: parsed as Record<string, unknown> });
      store.set({ id: 'data', data });
      watcher?.add(url);
    },
  };
}

export const collections = {
  ...Object.fromEntries(
    cmsCollections
      .filter((c) => c.kind === 'file')
      .map((c) => [c.name, defineCollection({ loader: wholeFile(c.file, c.format), schema: c.schema })]),
  ),
  // Stage W4, issue #12: one YAML file per page. The entry id is the file name without ".yaml"
  // (services--aa-ga-meetings), and the schema is picked by the file's `layout:` field.
  pages: defineCollection({
    loader: glob({
      pattern: '*.yaml',
      base: PAGES_FOLDER,
      generateId: ({ entry }) => entry.replace(/\.yaml$/, ''),
    }),
    schema: pageSchema,
  }),
};
