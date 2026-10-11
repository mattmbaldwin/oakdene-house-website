// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import responsiveImages from './integrations/responsive-images.mjs';

// Pages left out of the sitemap: error and form thank-you pages, plus pages
// that already carry a noindex tag (our-board, support-us).
const SITEMAP_EXCLUDE = [
  '/404/',
  '/thankyou/',
  '/services/referral/thank-you/',
  '/community-programs/volunteering/thank-you/',
  '/about/our-board/',
  '/support-us/',
];

// https://astro.build/config
export default defineConfig({
  site: 'https://oakdenehouse.org.au',
  devToolbar: { enabled: false },
  integrations: [
    sitemap({
      filter: (page) => !SITEMAP_EXCLUDE.includes(new URL(page).pathname),
    }),
    responsiveImages(),
  ],
});
