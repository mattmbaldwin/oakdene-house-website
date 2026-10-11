// Builds public/admin/pages.js: the "Page text" collection in the full
// content editor, one entry per file in src/content/pages/. Run with
// `npm run cms:pages` after adding or renaming a field in a page's text file.
//
// Field labels come from the key: "hero__heading_2" shows as "Hero: heading 2".
// The widget is chosen from the value: long text gets a text box, lists stay
// lists, /images/ paths get an image picker. Fields the page renders with
// inlineMarkdown() get a hint about **bold** and [links](/page/).

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIR = path.join(ROOT, 'src/content/pages');
const PAGES = path.join(ROOT, 'src/pages');
const OUT = path.join(ROOT, 'public/admin/pages.js');

const MD_HINT = 'You can use **bold**, *italics* and [link text](/page/).';
const HTML_HINT = 'This text contains HTML. Change the words only and keep the tags as they are.';
const SECTION_NAMES = { seo: 'Search and browser tab', data: 'Cards and lists', page: 'Page' };

const human = (s) => s.replace(/_/g, ' ').replace(/\s+/g, ' ').trim().replace(/^./, (c) => c.toUpperCase());
function labelFor(key) {
  const [section, role] = key.split('__');
  if (!role) return human(section);
  const r = human(role.replace(/_html$/, '')).replace(/^Image alt/, 'Image description (alt text)');
  return `${SECTION_NAMES[section] || human(section)}: ${r}`;
}

// Find the page file for a slug, and which keys it renders as Markdown.
function pageSource(slug) {
  const candidates = slug === 'home' ? ['index.astro'] : [
    slug.replace(/-/g, '/') + '.astro', slug.replace(/-/g, '/') + '/index.astro',
  ];
  const all = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p); else if (p.endsWith('.astro')) all.push(p);
    }
  })(PAGES);
  for (const p of all) {
    const text = fs.readFileSync(p, 'utf8');
    if (text.includes(`content/pages/${slug}.json'`)) return { file: p, text };
  }
  return { file: candidates[0], text: '' };
}

function routeFor(file) {
  const rel = path.relative(PAGES, file).replace(/\.astro$/, '').replace(/(^|\/)index$/, '');
  return '/' + (rel ? rel + '/' : '');
}

function fieldFor(name, value, ctx) {
  const label = labelFor(name);
  const base = { name, label, required: false };
  if (name.endsWith('_html')) return { ...base, widget: 'text', hint: HTML_HINT };
  if (typeof value === 'boolean') return { ...base, widget: 'boolean' };
  if (typeof value === 'number') return { ...base, widget: 'number', value_type: Number.isInteger(value) ? 'int' : 'float' };
  if (value === null || value === undefined) return { ...base, widget: 'string' };
  if (typeof value === 'string') {
    if (/^\/images\/.+\.(jpe?g|png|webp|svg|gif)$/i.test(value)) {
      return { ...base, widget: 'image', media_folder: '/public/images/uploads', public_folder: '/images/uploads', hint: 'After adding a new photo, ask for npm run images to be run so phones get a smaller copy.' };
    }
    const md = ctx.md.has(name);
    const long = value.length > 90 || value.includes('\n');
    return { ...base, widget: long ? 'text' : 'string', ...(md ? { hint: MD_HINT } : {}) };
  }
  if (Array.isArray(value)) {
    const first = value.find((v) => v !== null && v !== undefined);
    if (first === undefined || typeof first !== 'object') {
      const md = ctx.md.has(name) || ctx.mdLists.has(name);
      const long = value.some((v) => typeof v === 'string' && v.length > 90);
      return { ...base, widget: 'list', field: { name: 'item', label: 'Item', widget: long ? 'text' : 'string', ...(md ? { hint: MD_HINT } : {}) } };
    }
    const keys = [];
    for (const item of value) for (const k of Object.keys(item || {})) if (!keys.includes(k)) keys.push(k);
    // Use the longest value seen for each key, so long text gets a text box.
    const sample = (k) => value.map((v) => v?.[k]).filter((x) => x !== undefined && x !== null && x !== '')
      .sort((a, b) => String(b).length - String(a).length)[0] ?? '';
    const PREFERRED = ['title', 'name', 'heading', 'question', 'label', 'text', 'quote'];
    const summaryKey = PREFERRED.find((k) => keys.includes(k))
      || keys.find((k) => typeof sample(k) === 'string' && !/^(\/|https?:|#)/.test(sample(k))) || keys[0];
    return { ...base, widget: 'list', collapsed: true, summary: `{{fields.${summaryKey}}}`,
      fields: keys.map((k) => fieldFor(k, sample(k), { md: new Set(), mdLists: new Set() })) };
  }
  if (typeof value === 'object') {
    return { ...base, widget: 'object', collapsed: true, fields: Object.entries(value).map(([k, v]) => fieldFor(k, v, { md: new Set(), mdLists: new Set() })) };
  }
  return { ...base, widget: 'string' };
}

// Plain-English labels for keys inside lists and objects.
const INNER = { href: 'Link', text: 'Text', title: 'Title', summary: 'Summary', body: 'Text', image: 'Image', imageAlt: 'Image description', alt: 'Image description', variant: 'Style', number: 'Number', label: 'Label', tel: 'Phone number for dialling (digits only)', phone: 'Phone number as shown' };
function relabel(field, top = true) {
  if (!top && INNER[field.name]) field.label = INNER[field.name];
  else if (!top) field.label = human(field.name.replace(/([a-z])([A-Z])/g, '$1 $2'));
  if (field.fields) field.fields.forEach((f) => relabel(f, false));
  if (field.field) relabel(field.field, false);
  return field;
}

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).sort();
const entries = files.map((f) => {
  const slug = f.replace(/\.json$/, '');
  const data = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  const { file, text } = pageSource(slug);
  const md = new Set([...text.matchAll(/inlineMarkdown\(pageText\.(\w+)\)/g)].map((m) => m[1]));
  const mdLists = new Set([...text.matchAll(/pageText\.(\w+)\.map\(\(item\) => <li set:html=\{inlineMarkdown/g)].map((m) => m[1]));
  const title = slug === 'home' ? 'Home' : String(data.seo__browser_title || slug).split(/\s[—|–-]\s/)[0].trim();
  const route = routeFor(file);
  return {
    name: slug.replace(/[^a-z0-9_]/gi, '_'),
    label: `${title} (${route})`,
    file: `src/content/pages/${f}`,
    fields: Object.entries(data).map(([k, v]) => relabel(fieldFor(k, v, { md, mdLists }))),
  };
});
entries.sort((a, b) => a.label.localeCompare(b.label));

const collection = {
  name: 'pages', label: 'Page text', label_singular: 'page', editor: { preview: false },
  description: 'The words on every page. Layout and design stay as they are.',
  files: entries,
};

fs.writeFileSync(OUT, `// Generated by scripts/cms-pages.mjs (npm run cms:pages). Do not edit by hand.
// The "Page text" collection for the full content editor at /admin/.
window.OAKDENE_CMS_PAGES = ${JSON.stringify(collection, null, 2)};
`);
console.log(`Page text: ${entries.length} pages, ${entries.reduce((n, e) => n + e.fields.length, 0)} fields -> public/admin/pages.js`);
