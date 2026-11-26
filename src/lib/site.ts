// Reads the site-wide words (header, footer) from src/content/site.yaml (website-editor stage W10, issue #18).
// The build fails, naming the file, if it is missing.
import { getEntry, type CollectionEntry } from 'astro:content';

export type SiteContent = CollectionEntry<'site'>['data'];

export async function siteContent(): Promise<SiteContent> {
  const entry = await getEntry('site', 'data');
  if (!entry) throw new Error('src/content/site.yaml: missing; the header and footer read their words from it');
  return entry.data;
}
