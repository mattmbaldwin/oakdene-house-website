// Adds srcset and sizes to every <img> in the built pages whose photo has
// phone-sized copies listed in src/content/image-sizes.json (made by
// `npm run images`). Phones then download a 640px or 1080px copy instead of
// the full-size photo. Desktop still gets the original, because sizes tells
// the browser the image can be up to 1200px wide on larger screens.
//
// It runs after the build, so pages and components keep plain src paths.
// Images that already have a srcset, or have no copies, are left alone.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SIZES = '(max-width: 768px) calc(100vw - 32px), 1200px';

function htmlFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) htmlFiles(full, out);
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

export default function responsiveImages() {
  return {
    name: 'oakdene-responsive-images',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const manifestPath = new URL('../src/content/image-sizes.json', import.meta.url);
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        let count = 0;

        for (const file of htmlFiles(fileURLToPath(dir))) {
          const html = fs.readFileSync(file, 'utf8');
          const updated = html.replace(/<img\b[^>]*>/g, (tag) => {
            if (/\ssrcset=/.test(tag)) return tag;
            const src = tag.match(/\ssrc="([^"]+)"/)?.[1];
            const entry = src && manifest[src];
            if (!entry) return tag;
            const candidates = Object.entries(entry.variants).map(([w, ref]) => `${ref} ${w}w`);
            candidates.push(`${src} ${entry.width}w`);
            count++;
            return tag.replace(/\ssrc="[^"]+"/, (m) => `${m} srcset="${candidates.join(', ')}" sizes="${SIZES}"`);
          });
          if (updated !== html) fs.writeFileSync(file, updated);
        }

        logger.info(`Added phone-sized images to ${count} <img> tags`);
      },
    },
  };
}
