# Oakdene House Foundation — Website Project

## Project overview
This is the official website for Oakdene House Foundation, a community charity based in Fairfield, Western Sydney. The site supports people and families affected by addiction, hardship, homelessness, and life challenges. The tone is warm, human, practical and non-judgmental. Every design decision should reflect dignity and community.

## Tech stack
- Framework: Astro (latest stable) — static output only
- Styling: Plain CSS with custom properties — NO Tailwind, NO CSS frameworks
- Hosting: Cloudflare Pages
- CMS: Decap CMS (for staff content editing via browser)
- Forms: Jotform embeds — never build custom form backends
- No database, no server-side rendering, no API routes

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
- Patrons: /images/patrons/ (14 images — Bo Bernard x12, Tom Roberts x2)

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
- Day: Every Friday
- Hours: 12pm–2pm
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
- Tuesday 12:00pm–1:30pm in-person
- Tuesday 5:00pm–6:30pm Zoom
- Wednesday 12:00pm–1:30pm in-person
- Thursday 11:00am–12:30pm in-person
- Friday 5:00pm–6:30pm Zoom

## Impact stats — use these exact numbers
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
- Gambling Help: 1800 858 858
- 1800RESPECT: 1800 737 732
- AA Help Line: 1300 222 222
- Salvation Army: 1300 36 36 22

## File and folder conventions
- All page files: lowercase with hyphens (e.g. life-choices-program.astro)
- All component files: PascalCase (e.g. ServiceCard.astro)
- All content files: JSON in src/content/
- Images served from /images/ (files live in public/images/)
- PDFs in public/downloads/
- Never use inline styles — always CSS classes or custom properties
- Never use !important
- Always use semantic HTML (nav, main, section, article, footer, header)
- All images must have descriptive alt text
- All external links open in a new tab with rel="noopener noreferrer"

## Component conventions
- Every page uses BaseLayout.astro
- BaseLayout accepts: title, description, ogImage props
- Hero.astro accepts: heading, subheading, image, buttons array
- CTABand.astro accepts: heading, subheading, buttons array, dark boolean
- ServiceCard.astro accepts: title, summary, href, image, icon (optional)
- InfoTable.astro accepts: rows array of {label, value} objects
- TestimonialBlock.astro accepts: quotes array from testimonials.json

## Page structure — all pages to build
### Main navigation pages
1. Home (index.astro)
2. About (about.astro) — with subpages: the-oakdene-story, our-team, our-board, our-centre
3. Services (services.astro) — with 11 subpages
4. Community Programs (community-programs.astro)
5. Volunteering (volunteering.astro) — with subpages: community-volunteers, corporate-volunteering
6. Resources (resources.astro) — with subpages: flyers-and-brochures, information-sheets
7. Service Directory (service-directory.astro)
8. Forms (forms.astro)
9. Need Help Now (need-help-now.astro)
10. Contact (contact.astro)

### Utility pages
- 404.astro
- thankyou.astro

### Service subpages
- services/oakdene-kitchen.astro
- services/staple-food-packs.astro
- services/oakdene-laundrette.astro
- services/used-clothing-store.astro
- services/ladies-boutique.astro
- services/life-choices-program.astro
- services/outpatients-program.astro
- services/individual-counselling.astro
- services/gambling-counselling.astro
- services/aa-ga-meetings.astro
- services/financial-counselling.astro

## Things to never do
- Never use Tailwind or any CSS utility framework
- Never add a database or server-side rendering
- Never hardcode form backends — always Jotform embeds
- Never invent organisation details, phone numbers or addresses
- Never use lorem ipsum — always use real Oakdene content
- Never add jQuery
- Never create files outside the established structure without explaining why
- Never use placeholder divs when real images exist in public/images/
- Never reproduce the same card-grid layout on every section

## Jotform links
All form links placeholder until Jotform is built. Use href="#form-placeholder" and comment: <!-- TODO: Replace with live Jotform URL -->

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
- [ ] Deployed to Cloudflare Pages
