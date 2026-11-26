# Oakdene House Foundation — Website Project

## Project overview
This is the official website for Oakdene House Foundation, a community charity based in Fairfield, Western Sydney. The site supports people and families affected by addiction, hardship, homelessness, and life challenges. The tone is warm, human, practical and non-judgmental. Every design decision should reflect dignity and community.

## Current project: video launch
Adding the Oakdene video (produced by Lead Story) to the homepage and a new watch page at /about/the-oakdene-story/video/. All project material is in docs/video-launch/. Read docs/video-launch/README.md and docs/video-launch/content/issues.md before any video work. docs/ is never published (Astro only publishes src/pages and public).

- Work on the branch feature/oakdene-video and commit after each working step with a clear message
- Never merge to the live branch or deploy without Simon's explicit approval, given as the words "approved to deploy"
- Don't change sections or pages outside the task
- Every build ends with tests and a pass or fail table
- The pack's own CLAUDE.md is kept for reference as docs/video-launch/CLAUDE-pack-original.md. Where it differs from this file (colours in particular), this file wins

### Writing rules for new content
- Australian English (organise, colour, centre, program)
- Plain, direct language. Compassionate, practical and community-centred tone
- Person-first wording: "person in recovery", "people affected by addiction", "lived experience". Never write "addict" in page text, alt text, captions or metadata
- No em dashes in new content. Use a comma or a full stop. Existing pages are not rewritten for this
- Headings are short and say plainly what the section is
- Transcripts and quotes stay word for word, including the reporter's questions
- Video copy uses "29 Vine Street"; the rest of the site keeps "29 Vine St"

## Tech stack
- Framework: Astro 6 — static output only
- Styling: Plain CSS with custom properties — NO Tailwind, NO CSS frameworks
- Hosting: Cloudflare Pages, built from Git (see Build and deploy)
- CMS: Decap CMS planned (for staff content editing via browser), not yet configured
- Forms: Jotform embeds for referral and volunteering. The Contact page form is the one exception (see Forms)
- No database and no server-side rendering. The only server code is the Cloudflare Pages Function in functions/api/contact.js

## Build and deploy
- The live site is published by the Cloudflare Pages project `oakdene-house-website` in Matt Baldwin's Cloudflare account (the account that also holds the oakdenehouse.org.au domain). That project builds from this repository, mattmbaldwin/oakdene-house-website, main branch
- Simon is a collaborator with write access here. To publish: work on a branch in this repository (not a fork), open a pull request into main, and Simon reviews and merges it. Cloudflare publishes automatically within a few minutes of the merge. Simon-HubEasy/oakdene-house-website is an old fork and is no longer used for publishing
- Zero-difference rule (website-editor project): a stage that changes how the site is edited must not change what it shows. The Zero difference workflow builds the PR's merge-base and head and compares every page as a parsed DOM with scripts/check-zero-diff.mjs; run it by hand with `node scripts/check-zero-diff.mjs origin/main HEAD`. It skips head branches cms/** (Decap editor saves) and sync/** (HubEasy sync PRs), which change content on purpose
- A second Pages project, `oakdene-house-website-exk` in Simon's own Cloudflare account, builds Simon's old fork and posts preview links on pull requests (oakdene-house-website-exk.pages.dev). It is a test copy only and serves no custom domains. A Pages project can only use the apex domain if it is in the same Cloudflare account as the domain
- Build command: npm run build. Output folder: dist/. Framework preset: Astro. No wrangler.toml. Pull requests run two GitHub workflows: Build (npm ci, npm run build, npm test, on every PR) and Zero difference (see above)
- Create Pages projects through Workers & Pages > Create application > Pages (Import an existing Git repository). The default Create flow makes a Worker, which runs `wrangler deploy` and does not run functions/api/contact.js
- public/_redirects holds the 301 redirects for moved pages
- Sitemap: @astrojs/sitemap builds sitemap-index.xml and sitemap-0.xml from every page. Pages left out are listed in SITEMAP_EXCLUDE in astro.config.mjs. Any new noindex, thank-you or error page must be added there
- public/robots.txt allows all crawlers, skips /api/ and names the sitemap. Cloudflare's Bot Preference Sync is on for the zone, so the live file starts with Cloudflare's AI-crawler lines followed by ours
- Analytics: Google Analytics 4 (property G-LGB2GV15KV) is installed through Cloudflare's Google tag gateway, set up in the Cloudflare dashboard on 8 September 2026. The tag is served first-party from /metrics/ and defines window.gtag; there is no GA script in the repo. Do not add GA4 in Zaraz as well: a Zaraz GA4 tool was removed on purpose to stop double-counting. Custom events go through trackEvent() in src/scripts/analytics.ts, which calls gtag and does nothing if it is not loaded. Events: video_play (video_title, video_location) and video_transcript_click (video_location). video_location is homepage, watch_page, story_page (The Oakdene Story page) or resources_page. To report on the parameters, register video_title and video_location as event-scoped custom dimensions in GA4
- Roll back by redeploying the previous production deployment in the Cloudflare dashboard, or by reverting the merge commit on the live branch

## Commands
Node 22.12 or later.
- npm install
- npm run dev (local server at localhost:4321)
- npm run build (outputs to dist/)
- npm run preview (serves dist/)

## Checks
- npm test runs the zero-difference check's self-tests (node:test, scripts/*.test.mjs). There are no lint or type check scripts
- For each video build, the test step runs ad hoc checks through npx: Lighthouse and @axe-core/cli against the preview server, using the pre-installed Chromium
- Never report a build as done without running npm run build and the build's test step

## Forms
- Jotform embeds: services/referral.astro and community-programs/volunteering/index.astro
- Contact page: posts to /api/contact, a Cloudflare Pages Function (functions/api/contact.js) that checks Cloudflare Turnstile and sends the message by email through Resend
- The Pages Function needs these environment variables in the Cloudflare Pages project (Settings > Variables and secrets): CONTACT_EMAIL_FROM and CONTACT_EMAIL_TO as text, RESEND_API_KEY and TURNSTILE_SECRET_KEY as secrets. Locally they go in .dev.vars (see .dev.vars.example, never commit real values)
- Turnstile widget site key: 0x4AAAAAADFd373EZuMIVXX0 (in src/pages/contact.astro). Its Hostnames list must include every address the form runs on: oakdenehouse.org.au and www.oakdenehouse.org.au, plus oakdene-house-website-exk.pages.dev if the test copy's Contact form is used
- Don't build any new form backends. New forms are Jotform embeds

## Design philosophy
This site must feel warm, human and trustworthy — not corporate, not clinical, not generic. Avoid AI-slop aesthetics. Specific rules:
- Use real photography on every page — never default to placeholder divs when real images exist
- Create visual hierarchy with weight and space, not just size
- Use the teal palette with genuine depth — dark sections, light sections, white sections — not just white throughout
- Cards should feel considered, not just boxes with shadows
- Hover states and transitions should be subtle and smooth (0.2s ease)
- Mobile must feel as considered as desktop — not just "responsive"
- Section layouts should vary — not every section is a card grid
- Use the Oakdene tree imagery and brand story on the About pages — it is central to the identity
- Staff photos should be treated with care and dignity
- The "Need Help Now" page should feel calm and reassuring, not alarming

## Brand tokens — use these exact values everywhere
These match the custom properties in src/styles/global.css. Use the variables (var(--color-primary) and so on), not hard-coded values. Don't use the colours in the video pack (#004E60, #003147, #B9D2E9); they are not the site's colours. Social clip bands use #003E51.
- Primary: #003E51 (deep teal)
- Secondary: #C6D6E3 (blue-grey)
- Light tint: #F0F5F8
- White: #FFFFFF
- Body text: #333333
- Muted text: #666666
- Link colour: #003E51
- Link hover: #005A76
- Font: DM Sans (Google Fonts) — weights 400, 500, 600, 700
- Body size: 16px, line-height 1.6
- H1: 40–48px, weight 700
- H2: 28–32px, weight 600
- H3: 22–24px, weight 600
- Button radius: 6px
- Card radius: 10px
- Card shadow: 0 2px 12px rgba(0,62,81,0.08)
- Card shadow hover: 0 4px 20px rgba(0,62,81,0.14)
- Max content width: 1200px
- Section padding desktop: 80px top and bottom
- Section padding mobile: 48px top and bottom

## Button styles
- Primary: bg #003E51, text white, hover bg #005A76
- Secondary: transparent bg, border 2px solid #003E51, text #003E51, hover bg #003E51 text white
- White primary (on dark backgrounds): bg white, text #003E51
- White outline (on dark backgrounds): transparent bg, border 2px solid white, text white

## Real image paths — use these, never invent paths
All images are in public/images/ and served from /images/

### Logos
- Main site logo: /images/logos/oakdene-hero-logo.png
- Foundation logo colour: /images/logos/oakdene-house/oakdene_logo_awrgb_hi.jpg
- Foundation logo greyscale: /images/logos/oakdene-house/oakdene_logo_aw_greyscale_hi.jpg
- Boutique logo transparent: /images/logos/boutique/oakdene-boutique-logo-transparent.png
- Boutique logo solid: /images/logos/boutique/oakdene-boutique.png
- Kitchen logo transparent: /images/logos/kitchen/oakdene-kitchen-white-logo-no-background.png
- Kitchen logo white bg: /images/logos/kitchen/oakdene-kitchen-logo-white-background.png
- Laundrette logo: /images/logos/laundrette/oakdene-laundrette-logo.jpg

### Hero images (use on home page and key landing pages)
- /images/hero/hero-centre-1.jpg
- /images/hero/hero-centre-2.jpg
- /images/hero/hero-centre-3.jpg

### Service images
- Kitchen photos: /images/kitchen/ (13 images)
- Laundrette photos: /images/laundrette/ (13 images)
- Boutique photos: /images/boutique/ (26 images)
- Centre exterior + interior: /images/centre/ (full-res only)
- Oakdene tree: /images/about/ (4 images — use on About/Story page)
- Staff photos: /images/team/ (11 images)
- Generic community photos: /images/generic/ (23 images total)
- Patrons: /images/patrons/ (14 images — Bo Bernhard x12, Tom Roberts x2)

### Icons
- Filled icon set: /images/icons/filled/ (1,001 icons — use for service page icons)

## Organisation details — use these exactly, never guess
- Name: Oakdene House Foundation
- Phone: (02) 8717 0999
- Email: admin@oakdenehouse.org.au
- Address: 29 Vine St, Fairfield NSW 2165
- Postal: PO Box 988, Fairfield NSW 1860
- ABN: 90 151 950 926
- Kitchen/Laundrette/Clothing contact: kitchen@oakdenehouse.org.au / 0415 156 100
- Boutique contact: boutique@oakdenehouse.org.au / 0415 156 100
- CEO: Simon Jarvis
- Office hours: Monday to Friday, 9am–5pm. Some programs run outside these hours (each program page lists its times)

## Service operating details — confirmed, use exactly
### Oakdene Kitchen
- Days: Tuesday, Wednesday, Thursday
- Hours: 12pm–2pm
- Location: 9/2 Dale Street, Fairfield
- Cost: Free
- Eligibility: Centrelink Income Statement + photo ID, under $1,200/fortnight
- Important note: If you use Oakdene Kitchen support, you will no longer be able to be a member of Fairfield RSL
- Motto: "Feed the people, stay alive"

### Staple Food Packs
- Day: Fridays only
- Hours: 12pm–1pm
- Starting: 17 April 2026
- Cost: Free
- Includes: Fresh fruit and vegetables, canned goods, long life milk, cereal, hygiene items (subject to availability)
- Rules: One pack per household, same eligibility as Kitchen

### Oakdene Laundrette
- Days: Tuesday to Thursday
- Hours: 12pm–2:30pm, last entry 1pm
- Location: 1 Dale Street, Fairfield
- Cost: Free
- Per visit: One wash, one dry, detergent provided
- Group bookings available outside hours for non-profits (4 machines, 2-hour sessions, free)

### Used Clothing Store
- Days: Tuesday, Wednesday, Thursday
- Hours: 12pm–2pm
- Location: Inside Laundrette, 1 Dale Street, Fairfield
- Cost: Free
- Rules: 3 items per visit, one visit per week, no trying on, no returns, one person in room at a time, door must remain open

### Ladies Boutique
- Days: Tuesday and Thursday
- Hours: 10am–4pm
- Access: By appointment only
- Cost: $2 clothing / $5 salon
- Contact: boutique@oakdenehouse.org.au
- Motto: "Support for Women by Women"
- Access promise: No woman will be turned away due to financial difficulty

### Life Choices Program
- Format: 6-week group program
- Monday 11:00am–12:15pm in-person
- Tuesday 11:00am–12:15pm Ladies Only, online / Zoom only
- Tuesday 1:00pm–2:15pm Men Only, in-person
- Tuesday 4:00pm–5:30pm online / Zoom only
- Wednesday 11:00am–12:30pm in-person
- Thursday 11:00am–12:30pm in-person
- Friday 5:00pm–6:30pm in-person
- Source of truth: the `schedule` array in src/pages/services/life-choices-program.astro. If this list and the page disagree, the page is right; update this list.
- AA and GA meeting times live in `aaSchedule` and `gaSchedule` in src/pages/services/aa-ga-meetings.astro. Do not copy them here.

## Impact stats — use these exact numbers
Both sets are confirmed by Simon. Updated 9 October 2026: individuals figure is 5,000+ on both the homepage and About page.

Homepage set (src/pages/index.astro):
- 5,000+ Meals and food packs delivered annually
- $250,000 Value of supplies provided annually
- 5,000+ Individuals impacted
- 25 Local organisation partnerships

Second set (available for other pages):
- 5,000+ People supported each year
- 100+ Community events and workshops
- 1,000+ Hours of one-to-one support
- 5,000+ Meals and practical supports delivered

## Real testimonials — use these exactly, never invent quotes
1. "Oakdene made things feel manageable again. The support was practical, respectful, and steady when life felt very heavy." — Community Member
2. "I did not feel judged. I felt like someone actually listened and helped me work out what to do next." — Anonymous
3. "Oakdene gave me a place to start when everything felt too hard to manage on my own." — Anonymous
4. "Being around others and having somewhere to go helped me get some structure back. It made a bigger difference than I expected." — Program Participant

## Crisis helpline numbers — use these exactly
- Lifeline: 13 11 14
- Beyond Blue: 1300 224 636
- GambleAware NSW (gambling help): 1800 858 858
- 1800RESPECT: 1800 737 732
- AA Help Line: 1300 222 222
- Salvation Army: 1300 36 36 22

## Peer support contacts (AA & GA Meetings page)
- Alcoholics Anonymous (AA) Australia: aa.org.au, 24-hour helpline 1300 22 22 22
- Gamblers Anonymous (GA) NSW: ga.nsw.org.au, 0455 717 543

## File and folder conventions
- All page files: lowercase with hyphens (e.g. life-choices-program.astro)
- All component files: PascalCase (e.g. ServiceCard.astro)
- Shared client-side scripts: src/scripts/ (TypeScript modules imported by component and page <script> tags)
- Page words and images (website editor, stage W4 onwards): one YAML file per page in src/content/pages/, named after the URL path with -- for each / (services--aa-ga-meetings.yaml). Each file names its `layout:`, whose Zod schema is in src/content/schemas.mjs (with the shared field types: heading, prose, link, button, image, seo). The .astro page keeps the markup and reads the file with pageContent() from src/lib/pages.ts; paragraphs go through Prose.astro. After changing a schema run npm run build:cms. Done so far: life-choices-program, aa-ga-meetings, group-dbt-therapy
- All content files: JSON in src/content/. Exception: the video watch page reads video.json and transcript.txt from docs/video-launch/content/ at build time, so the launch pack stays the single source
- Images served from /images/ (files live in public/images/)
- PDFs in public/downloads/
- Never use inline styles — always CSS classes or custom properties
- Never use !important
- Always use semantic HTML (nav, main, section, article, footer, header)
- All images must have descriptive alt text
- All external links open in a new tab with rel="noopener noreferrer"

## Component conventions
- Every page uses BaseLayout.astro
- BaseLayout accepts: title, description (optional), ogImage (optional, defaults to /images/hero/hero-centre-1.jpg), noindex (optional boolean), ogType (optional, defaults to 'website'). It has a named slot "head" for page-specific head content such as JSON-LD (use slot="head" on the element)
- Hero.astro accepts: heading, subheading, image, imageAlt, buttons array of {text, href, variant: 'white' | 'white-outline'}
- CTABand.astro accepts: heading, subheading, primaryBtn {text, href}, secondaryBtn {text, href}, dark boolean (defaults to true)
- ServiceCard.astro accepts: title, summary, href, image, imageAlt, imagePosition, icon, eyebrow (all but the first three optional)
- InfoTable.astro accepts: rows array of {label, value} objects, caption (optional)
- TestimonialBlock.astro accepts: quotes array of {quote, attribution} from testimonials.json
- StatsGrid.astro accepts: stats array of {number, label}
- FAQAccordion.astro accepts: faqs array of {question, answer} (home page: from src/content/faqs.yaml via src/lib/faqs.ts; answers are prose rendered by src/lib/prose.ts)
- VideoPlayer.astro accepts: youtubeId, title, thumbnail, label (the play button's screen reader label), loading ('lazy' default, 'eager' above the fold). Loads the youtube-nocookie.com player only when the play button is pressed

## Page structure — current routes
All in src/pages/. URLs use trailing slashes.

### Main pages
- / (index.astro)
- /about/ with subpages /about/the-oakdene-story/, /about/our-team/, /about/our-board/ (noindex), /about/our-centre/
- /about/the-oakdene-story/video/ (video watch page)
- /services/ with subpages: individual-counselling, gambling-counselling, financial-counselling, group-dbt-therapy, life-choices-program, outpatients-program, aa-ga-meetings, referral (Jotform) and referral/thank-you
- /community-programs/ with subpages: oakdene-kitchen, staple-food-packs, oakdene-laundrette, used-clothing-store, ladies-boutique
- /community-programs/volunteering/ (Jotform) with subpages community-volunteers, corporate-volunteering and thank-you
- /resources/ with subpages flyers-and-brochures and information-sheets
- /service-directory/
- /need-help-now/
- /contact/ (form posts to /api/contact)
- /faq/

### Utility pages
- 404.astro, thankyou.astro
- accessibility.astro, privacy-policy.astro, terms-of-use.astro
- support-us.astro (noindex, Donate calls to action removed sitewide)

### Moved pages (301 redirects in public/_redirects)
- /forms/ goes to /contact/
- /volunteering/ and its subpages go to /community-programs/volunteering/
- /services/oakdene-kitchen/, staple-food-packs, oakdene-laundrette, used-clothing-store and ladies-boutique go to the matching /community-programs/ page
- When a page moves, add its old URL to public/_redirects

## Things to never do
- Never use Tailwind or any CSS utility framework
- Never add a database or server-side rendering
- Never build a new form backend. New forms are Jotform embeds (the Contact page function is the only exception)
- Never invent organisation details, phone numbers or addresses
- Never use lorem ipsum — always use real Oakdene content
- Never add jQuery
- Never create files outside the established structure without explaining why
- Never use placeholder divs when real images exist in public/images/
- Never reproduce the same card-grid layout on every section

## Jotform links
Live Jotform embeds are on the referral and volunteering pages. For any new form not yet built in Jotform, use href="#form-placeholder" and comment: <!-- TODO: Replace with live Jotform URL -->

## Google Maps
Contact page needs a Google Maps embed for 29 Vine St, Fairfield NSW 2165. Use a placeholder comment: <!-- TODO: Add Google Maps embed code -->

## Decap CMS
Config in public/admin/config.yml. Staff edit via /admin/ in browser.

## Build status checklist
- [x] CLAUDE.md created
- [x] Astro project scaffolded
- [x] Global CSS created
- [x] BaseLayout built
- [x] Header built
- [x] Footer built
- [x] Home page built
- [x] About section built (4 subpages)
- [x] Services section built (11 subpages)
- [x] Community Programs built
- [x] Volunteering built (2 subpages)
- [x] Resources built (2 subpages)
- [x] Service Directory built
- [x] Forms page built
- [x] Need Help Now built
- [x] Contact page built
- [x] 404 and Thank You pages built
- [ ] Decap CMS configured
- [ ] Images optimised for web
- [x] Deployed to Cloudflare Pages (from mattmbaldwin/oakdene-house-website; see Build and deploy)
