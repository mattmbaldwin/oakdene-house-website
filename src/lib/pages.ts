// Reads a page's words and images from src/content/pages/<id>.yaml (website-editor stage W4, issue #12).
//
// A page calls pageContent('services--aa-ga-meetings', 'aa-ga-meetings') and gets that file's data, typed by its
// layout's schema in src/content/schemas.mjs. The build fails, naming the file, if the file is missing or uses a
// different layout from the one the page renders.
import { getEntry, type CollectionEntry } from 'astro:content';

type PageData = CollectionEntry<'pages'>['data'];
export type Layout = PageData['layout'];

export const PAGES_FOLDER = 'src/content/pages';

export async function pageContent<L extends Layout>(id: string, layout: L): Promise<Extract<PageData, { layout: L }>> {
  const file = `${PAGES_FOLDER}/${id}.yaml`;
  const entry = await getEntry('pages', id);
  if (!entry) throw new Error(`${file}: missing; this page reads its words and images from it`);
  if (entry.data.layout !== layout) {
    throw new Error(`${file}: layout: expected "${layout}", found "${entry.data.layout}"`);
  }
  return entry.data as Extract<PageData, { layout: L }>;
}

/** Names a field in a page file for prose build errors, e.g. "src/content/pages/x.yaml: overview.paragraphs.0". */
export function fieldSource(id: string, path: string): string {
  return `${PAGES_FOLDER}/${id}.yaml: ${path}`;
}
