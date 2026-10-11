// Makes smaller copies of the site's photos for phones and records them in
// src/content/image-sizes.json. Run with `npm run images` after adding or
// replacing a photo, then commit the new files.
//
// For each JPEG referenced in src/ (and the video thumbnails in the launch
// pack) wider than 640px, it writes name-640.jpg and, if wider than 1080px,
// name-1080.jpg next to the original. The build then adds these to srcset
// (integrations/responsive-images.mjs) and the Hero component uses the
// 1080 copy on small screens.

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const MANIFEST = path.join(ROOT, 'src/content/image-sizes.json');
const SCAN = [path.join(ROOT, 'src'), path.join(ROOT, 'docs/video-launch/content')];
const WIDTHS = [640, 1080];
const VARIANT = /-(640|1080)\.(jpe?g)$/i;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(astro|ts|js|mjs|json|css|md)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const refs = new Set();
for (const file of SCAN.flatMap((dir) => walk(dir))) {
  if (file === MANIFEST) continue;
  const text = fs.readFileSync(file, 'utf8');
  for (const match of text.matchAll(/(?:public)?(\/images\/[^"'`)\s,]+\.(?:jpe?g))/gi)) {
    if (!VARIANT.test(match[1])) refs.add(match[1]);
  }
}

const manifest = {};
let written = 0;
for (const ref of [...refs].sort()) {
  const src = path.join(PUBLIC, ref);
  if (!fs.existsSync(src)) continue;
  const { width, height } = await sharp(src).metadata();
  const entry = { width, height, variants: {} };
  for (const w of WIDTHS) {
    if (width <= w) continue;
    const variantRef = ref.replace(/\.(jpe?g)$/i, `-${w}.$1`);
    const out = path.join(PUBLIC, variantRef);
    if (!fs.existsSync(out) || fs.statSync(out).mtimeMs < fs.statSync(src).mtimeMs) {
      await sharp(src).rotate().resize({ width: w }).jpeg({ quality: 78, mozjpeg: true, progressive: true }).toFile(out);
      written++;
    }
    entry.variants[w] = variantRef;
  }
  if (Object.keys(entry.variants).length) manifest[ref] = entry;
}

fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
console.log(`${Object.keys(manifest).length} photos have phone sizes; ${written} files written.`);
