// Zod schemas for the content files the website editor (/admin) can change. Website-editor stage W7, issue #15.
//
// These schemas are the one source of truth for two things:
//   1. `src/content.config.ts` registers each file as an Astro content collection, so `astro build` checks the
//      data against its schema.
//   2. `scripts/build-cms-config.mjs` turns the `cmsCollections` list below into the Decap CMS config at
//      `public/admin/config.yml`. `npm run build` fails if that file no longer matches these schemas.
//
// Plain JavaScript (not TypeScript) so the generator runs under plain Node without a compile step.
//
// How a field shows in the editor:
//   .meta({ title })        the field label (otherwise the key, turned into words)
//   .meta({ description })  the hint shown under the field
//   prose()                 a text field that accepts bold, italic and links only (see src/lib/prose.ts)
//   longText()              a multi-line plain-text box
// Objects are strict: a key in the data file that the schema does not list fails the build, so every value in an
// editable file is always reachable from the editor.
//
// Program schedules (src/content/program-schedules.json) are deliberately NOT listed: HubEasy is their source.
//
// Page files (W4, then W8 to W12) are one `kind: 'pages'` collection; see "Pages" below.

import { z } from 'astro/zod';

/** Required one-line text. */
export const text = (title, description) => z.string().min(1).meta(meta(title, description));

/** Required multi-line plain text (no formatting). */
export const longText = (title, description) =>
  z.string().min(1).meta({ ...meta(title, description), cms: { widget: 'text' } });

/** Required prose: bold, italic and links only. The site renders it with renderProse(). */
export const prose = (title, description) =>
  z.string().min(1).meta({ ...meta(title, description), cms: { widget: 'markdown' } });

function meta(title, description) {
  const m = {};
  if (title) m.title = title;
  if (description) m.description = description;
  return m;
}

// ---------------------------------------------------------------------------------------------------------------
// Opening hours (stage W5, issue #13): src/content/opening-hours.json
// Each existing phrasing on the site is its own named string, so changing one never rewords another page.

const SHOWN_ON = 'Shown word for word';

export const openingHoursSchema = z
  .strictObject({
    kitchen: z
      .strictObject({
        days: text('Days', `${SHOWN_ON} in the Oakdene Kitchen info panel, e.g. "Tuesday, Wednesday, Thursday".`),
        hours: text('Hours', `${SHOWN_ON} in the Oakdene Kitchen info panel, e.g. "12pm–2pm".`),
        seoDays: text('Days in the search description', 'Used in the Kitchen page search-engine description.'),
        homeSummary: text('Home page summary', `${SHOWN_ON} on the home page Kitchen card.`),
        programsSummary: text('Community Programs summary', `${SHOWN_ON} on the Community Programs page card.`),
        contactSummary: text('Contact page summary', `${SHOWN_ON} in the Contact page hours table.`),
      })
      .meta({ title: 'Oakdene Kitchen' }),
    laundrette: z
      .strictObject({
        days: text('Days', `${SHOWN_ON} in the Laundrette info panel.`),
        hours: text('Hours', `${SHOWN_ON} in the Laundrette info panel.`),
        lastEntry: text('Last entry', `${SHOWN_ON} in the Laundrette info panel, e.g. "1pm".`),
        seoDescription: text('Search description', 'The Laundrette sentence used in the search-engine description.'),
        groupBookingDays: text('Group booking days', `${SHOWN_ON} in the group bookings paragraph.`),
        contactSummary: text('Contact page summary', `${SHOWN_ON} in the Contact page hours table.`),
      })
      .meta({ title: 'Oakdene Laundrette' }),
    staplePacks: z
      .strictObject({
        day: text('Day', `${SHOWN_ON} in the Staple Food Packs info panel, e.g. "Every Friday".`),
        hours: text('Hours', `${SHOWN_ON} in the Staple Food Packs info panel.`),
        seoDay: text('Day in the search description', 'Used in the Staple Food Packs search-engine description.'),
        distributionDay: text('Distribution day', `${SHOWN_ON} in "Packs are distributed …".`),
        alsoRunningDay: text('"Also running on" day', `${SHOWN_ON} in "Also running on …".`),
        contactSummary: text('Contact page summary', `${SHOWN_ON} in the Contact page hours table.`),
      })
      .meta({ title: 'Staple Food Packs' }),
    clothingStore: z
      .strictObject({
        days: text('Days', `${SHOWN_ON} in the Used Clothing Store info panel.`),
        hours: text('Hours', `${SHOWN_ON} in the Used Clothing Store info panel.`),
        contactSummary: text('Contact page summary', `${SHOWN_ON} in the Contact page hours table.`),
      })
      .meta({ title: 'Used Clothing Store' }),
    office: z
      .strictObject({
        days: text('Days', `${SHOWN_ON} on the Contact page office hours card.`),
        hours: text('Hours', `${SHOWN_ON} on the Contact page office hours card.`),
        availability: text('Availability sentence', `${SHOWN_ON} on the Need Help Now and thank-you pages.`),
      })
      .meta({ title: 'Office' }),
  })
  .meta({ title: 'Opening hours' });

// ---------------------------------------------------------------------------------------------------------------
// FAQs (stage W6, issue #14): src/content/faqs.yaml

export const faqsSchema = z
  .strictObject({
    sections: z
      .array(
        z
          .strictObject({
            id: z
              .string()
              .regex(/^[a-z][a-z0-9-]*$/)
              .meta({ title: 'Section id', description: 'Lower-case letters, digits or hyphens. FAQs refer to it.' }),
            heading: text('Heading', 'The section heading on the FAQ page.'),
          })
          .meta({ title: 'Section' }),
      )
      .meta({ title: 'FAQ page sections', cms: { summary: '{{fields.heading}}' } }),
    faqs: z
      .array(
        z
          .strictObject({
            question: text('Question'),
            answer: prose('Answer', 'Bold, italic and links only. Press Shift+Enter for a line break, not Enter.'),
            section: z
              .string()
              .meta({ title: 'Section id', description: 'One of the section ids above, e.g. "general".' }),
            showOnFaqPage: z.boolean().meta({ title: 'Show on the FAQ page' }),
            showOnHome: z.boolean().meta({ title: 'Show on the home page' }),
            order: z
              .number()
              .int()
              .meta({ title: 'Order', description: 'Lower numbers show first, within a section and on the home page.' }),
          })
          .meta({ title: 'FAQ' }),
      )
      .meta({ title: 'Questions', cms: { summary: '{{fields.question}}' } }),
  })
  .meta({ title: 'Frequently asked questions' });

// ---------------------------------------------------------------------------------------------------------------
// Pages (stage W4, issue #12): one YAML file per page in src/content/pages/, named after its URL path with "--" for
// each "/" (services/aa-ga-meetings -> services--aa-ga-meetings.yaml).
//
// Each file says which layout it uses (`layout:`), and each layout has its own schema built from the shared field
// types below. Layout, sections, colours and fonts stay in the .astro page; the YAML holds only words and images.
// Every batch after W4 (W8 to W12) reuses these field types and adds its layouts to `pageLayouts`.

/** Where a link or button may point. Kept identical to the HREF rule in src/lib/prose.ts. */
export const HREF_PATTERN = '^(?:https?://[^\\s<>"]+|mailto:[^\\s<>"]+|tel:\\+?[0-9]+|/[^\\s<>"]*|#[^\\s<>"]*)$';

const HREF_HINT = 'A page on this site (/contact/), a web address (https://…), mailto: or tel:.';

/** A heading: required one-line plain text. */
export const heading = (title = 'Heading', description) => text(title, description);

/** A web address or site path for a link or button. */
export const href = (title = 'Link', description = HREF_HINT) =>
  z.string().min(1).regex(new RegExp(HREF_PATTERN)).meta(meta(title, description));

/** A path to an image under public/, e.g. /images/centre/outside.png. Edited with the image picker. */
export const imagePath = (title = 'Image file', description) =>
  z
    .string()
    .min(1)
    .regex(/^\/[^\s"<>]+$/)
    .meta({ ...meta(title, description), cms: { widget: 'image' } });

/** An image shown on the page: the file and its alt text. */
export const image = (title = 'Image') =>
  z
    .strictObject({
      src: imagePath('Image file'),
      alt: text('Alt text', 'Describes the image for people who use screen readers.'),
    })
    .meta({ title });

/** A text link: what it says and where it goes. */
export const link = (title = 'Link') =>
  z.strictObject({ label: text('Text'), href: href('Goes to') }).meta({ title });

/** The button styles the site's CSS defines (`btn btn--primary`, `btn--secondary`, `btn--white`). */
export const BUTTON_STYLES = ['primary', 'secondary', 'white'];

/** A button link: label, where it goes and which of the site's button styles it uses. */
export const button = (title = 'Button') =>
  z
    .strictObject({
      label: text('Text'),
      href: href('Goes to'),
      style: z.enum(BUTTON_STYLES).meta({ title: 'Style', description: 'primary (filled), secondary (outline) or white.' }),
    })
    .meta({ title });

/** Search-engine and social-sharing details for the page. */
export const seo = () =>
  z
    .strictObject({
      title: text('Page title', 'Shown in the browser tab and as the search result heading.'),
      description: longText('Search description', 'The summary search engines show under the title.'),
      image: imagePath('Sharing image', 'The picture shown when the page is shared on social media.').optional(),
    })
    .meta({ title: 'Search and sharing' });

/** One or more paragraphs, each rendered as its own <p>. */
export const paragraphs = (title = 'Paragraphs', description = 'Bold, italic and links only. One entry per paragraph.') =>
  z.array(prose('Paragraph')).min(1).meta(meta(title, description));

/** A bulleted list: one entry per point. */
export const listItems = (title = 'List items') =>
  z.array(prose('Item')).min(1).meta({ ...meta(title, 'Bold, italic and links only. One entry per point.') });

/** The top banner: breadcrumb label, page heading and the line under it. */
export const hero = () =>
  z
    .strictObject({
      breadcrumb: text('Breadcrumb', 'The last item in the "Home / Services / …" trail.'),
      heading: heading('Page heading'),
      lead: prose('Line under the heading'),
    })
    .meta({ title: 'Banner' });

/** A section's small label (eyebrow), heading and optional line under it. */
export const sectionHeading = ({ lead = false } = {}) => {
  const fields = { eyebrow: text('Small label above the heading'), heading: heading() };
  if (lead) fields.lead = prose('Line under the heading');
  return z.strictObject(fields).meta({ title: 'Section heading' });
};

/** The coloured call-to-action band at the foot of a page. Its button styles are fixed by the band's design. */
export const ctaBand = ({ subheading = false } = {}) => {
  const fields = { heading: heading() };
  if (subheading) fields.subheading = longText('Line under the heading');
  fields.primary = link('First button');
  fields.secondary = link('Second button');
  return z.strictObject(fields).meta({ title: 'Call to action band' });
};

const layoutField = (name) => z.literal(name).meta({ title: 'Layout' });

/** Contact links (phone and email) shown on a page. */
const contactLinks = () =>
  z.strictObject({ phone: link('Phone link'), email: link('Email link') }).meta({ title: 'Contact links' });

// Layout: services/life-choices-program.astro
export const lifeChoicesProgramLayout = z
  .strictObject({
    layout: layoutField('life-choices-program'),
    seo: seo(),
    hero: hero(),
    overview: z
      .strictObject({
        heading: sectionHeading(),
        paragraphs: paragraphs(),
        expectHeading: heading('"What participants can expect" heading'),
        expectItems: listItems('What participants can expect'),
        whoLabel: text('"Who it\'s for" label'),
        whoText: prose('"Who it\'s for" text'),
        image: image(),
      })
      .meta({ title: 'Overview' }),
    schedule: z
      .strictObject({ heading: sectionHeading({ lead: true }) })
      .meta({ title: 'Session times', description: 'The table itself comes from HubEasy and is not edited here.' }),
    join: z
      .strictObject({
        heading: sectionHeading(),
        steps: z
          .array(z.strictObject({ heading: heading(), body: prose('Text') }).meta({ title: 'Step' }))
          .min(1)
          .meta({ title: 'Steps', description: 'Numbered 01, 02, 03 … in this order.', cms: { summary: '{{fields.heading}}' } }),
        contact: contactLinks(),
      })
      .meta({ title: 'How to join' }),
    cta: ctaBand(),
  })
  .meta({ title: 'Life Choices Program page' });

// Layout: services/aa-ga-meetings.astro
export const aaGaMeetingsLayout = z
  .strictObject({
    layout: layoutField('aa-ga-meetings'),
    seo: seo(),
    hero: hero(),
    overview: z
      .strictObject({
        heading: sectionHeading(),
        paragraphs: paragraphs(),
        meetingsHeading: heading('"Meetings hosted" heading'),
        meetings: listItems('Meetings hosted'),
        expectHeading: heading('"What to expect" heading'),
        expectItems: listItems('What to expect'),
        helpHeading: heading('"Find help outside Oakdene" heading'),
        helpIntro: prose('"Find help outside Oakdene" introduction'),
        helpItems: listItems('Outside contacts'),
        image: image(),
        scheduleNote: z
          .strictObject({ heading: heading(), text: prose('Text'), contact: contactLinks() })
          .meta({ title: 'Meeting times note (beside the image)' }),
      })
      .meta({ title: 'Overview' }),
    about: z
      .strictObject({
        heading: sectionHeading(),
        cards: z
          .array(z.strictObject({ heading: heading(), paragraphs: paragraphs() }).meta({ title: 'Card' }))
          .min(1)
          .meta({ title: 'Cards', cms: { summary: '{{fields.heading}}' } }),
      })
      .meta({ title: 'About the programs' }),
    schedule: z
      .strictObject({
        heading: sectionHeading({ lead: true }),
        gaHeading: heading('Gamblers Anonymous table heading'),
        aaHeading: heading('Alcoholics Anonymous table heading'),
      })
      .meta({ title: 'Meeting times', description: 'The tables themselves come from HubEasy and are not edited here.' }),
    cta: ctaBand(),
  })
  .meta({ title: 'AA & GA Meetings page' });

// Layout: services/group-dbt-therapy.astro
export const groupDbtTherapyLayout = z
  .strictObject({
    layout: layoutField('group-dbt-therapy'),
    seo: seo(),
    hero: hero(),
    overview: z
      .strictObject({
        heading: sectionHeading(),
        paragraphs: paragraphs(),
        details: z
          .strictObject({
            caption: text('Table caption'),
            rows: z
              .array(z.strictObject({ label: text('Label'), value: text('Value') }).meta({ title: 'Row' }))
              .min(1)
              .meta({ title: 'Rows', cms: { summary: '{{fields.label}}' } }),
          })
          .meta({ title: 'Service details table' }),
      })
      .meta({ title: 'Overview' }),
    schedule: z
      .strictObject({ heading: sectionHeading({ lead: true }) })
      .meta({ title: 'Group times', description: 'The table itself comes from HubEasy and is not edited here.' }),
    skills: z
      .strictObject({
        heading: sectionHeading({ lead: true }),
        items: z
          .array(z.strictObject({ heading: heading(), body: prose('Text') }).meta({ title: 'Skill' }))
          .min(1)
          .meta({ title: 'Skill areas', cms: { summary: '{{fields.heading}}' } }),
      })
      .meta({ title: 'What the group covers' }),
    who: z
      .strictObject({
        heading: sectionHeading(),
        intro: prose('Introduction'),
        items: listItems('Experiences the group may help with'),
        closing: prose('Closing note'),
      })
      .meta({ title: 'Who it can help' }),
    expect: z
      .strictObject({ heading: sectionHeading(), paragraphs: paragraphs() })
      .meta({ title: 'What to expect' }),
    cta: ctaBand({ subheading: true }),
  })
  .meta({ title: 'Group DBT Therapy page' });

// --- W8 (issue #16): Services pages ---------------------------------------------------------------------------
// services, financial-counselling, gambling-counselling, individual-counselling, outpatients-program,
// referral and referral/thank-you. Add further batches' layouts in their own marked block, not inside this one.

/** A label and a value shown as a pair, e.g. "Cost" / "Free". */
const fact = () => z.strictObject({ label: text('Label'), value: text('Value') }).meta({ title: 'Fact' });

/** A heading and a sentence or two under it (an icon card). */
const textCard = (icon) => {
  const fields = {};
  if (icon) fields.icon = z.enum(icon).meta({ title: 'Icon', description: 'Pick one of the site icons.' });
  fields.heading = heading();
  fields.body = prose('Text');
  return z.strictObject(fields).meta({ title: 'Card' });
};

const cards = (icon, title = 'Cards') =>
  z.array(textCard(icon)).min(1).meta({ title, cms: { summary: '{{fields.heading}}' } });

// Layout: services.astro
export const servicesLayout = z
  .strictObject({
    layout: layoutField('services'),
    seo: seo(),
    hero: z
      .strictObject({ heading: heading('Page heading'), lead: prose('Line under the heading'), button: button() })
      .meta({ title: 'Banner' }),
    categories: z
      .strictObject({
        heading: sectionHeading({ lead: true }),
        items: cards(['heart', 'people', 'arrow'], 'Categories'),
      })
      .meta({ title: 'What we offer' }),
    services: z
      .strictObject({
        heading: sectionHeading(),
        items: z
          .array(
            z
              .strictObject({
                title: text('Service name'),
                summary: text('Summary'),
                href: href('Goes to'),
                eyebrow: text('Small label above the name'),
                image: image(),
              })
              .meta({ title: 'Service' }),
          )
          .min(1)
          .meta({ title: 'Service cards', cms: { summary: '{{fields.title}}' } }),
      })
      .meta({ title: 'All services' }),
    steps: z
      .strictObject({
        heading: sectionHeading({ lead: true }),
        items: z
          .array(z.strictObject({ heading: heading(), body: prose('Text') }).meta({ title: 'Step' }))
          .min(1)
          .meta({ title: 'Steps', description: 'Numbered 01, 02, 03 … in this order.', cms: { summary: '{{fields.heading}}' } }),
      })
      .meta({ title: 'How to get started' }),
    who: z
      .strictObject({ heading: sectionHeading(), paragraphs: paragraphs(), button: button() })
      .meta({ title: 'Who we support' }),
    cta: ctaBand(),
  })
  .meta({ title: 'Services page' });

// Layout: services/financial-counselling.astro
export const financialCounsellingLayout = z
  .strictObject({
    layout: layoutField('financial-counselling'),
    seo: seo(),
    hero: hero(),
    overview: z
      .strictObject({
        heading: sectionHeading(),
        paragraphs: paragraphs(),
        helpHeading: heading('"What a Financial Counsellor can help with" heading'),
        helpItems: listItems('What a Financial Counsellor can help with'),
        access: z
          .strictObject({ heading: heading(), text: prose('Text'), primary: button('First button'), secondary: button('Second button') })
          .meta({ title: 'How to access' }),
        details: z
          .strictObject({
            caption: text('Table caption'),
            rows: z
              .array(z.strictObject({ label: text('Label'), value: prose('Value', 'Bold, italic and links only.') }).meta({ title: 'Row' }))
              .min(1)
              .meta({ title: 'Rows', cms: { summary: '{{fields.label}}' } }),
          })
          .meta({ title: 'Service details table' }),
      })
      .meta({ title: 'Overview' }),
    approach: z
      .strictObject({
        heading: sectionHeading(),
        paragraphs: paragraphs(),
        qualifiedHeading: heading('"Qualified and Professional Support" heading'),
        qualifiedParagraphs: paragraphs('Paragraphs under that heading'),
        accredited: z
          .strictObject({ text: text('Text'), logo: image('Logo') })
          .meta({ title: 'Accreditation badge' }),
      })
      .meta({ title: 'Our approach' }),
    cta: ctaBand({ subheading: true }),
  })
  .meta({ title: 'Financial Counselling page' });

// Layout: services/gambling-counselling.astro
export const gamblingCounsellingLayout = z
  .strictObject({
    layout: layoutField('gambling-counselling'),
    seo: seo(),
    hero: hero(),
    overview: z
      .strictObject({
        heading: sectionHeading(),
        paragraphs: paragraphs(),
        facts: z.array(fact()).min(1).meta({ title: 'Key facts', cms: { summary: '{{fields.label}}' } }),
        contact: contactLinks(),
        image: image(),
        helpline: z
          .strictObject({ heading: text('Heading'), text: prose('Text'), number: link('Phone number') })
          .meta({ title: '24-hour support line box' }),
      })
      .meta({ title: 'Overview' }),
    impact: z
      .strictObject({ heading: sectionHeading({ lead: true }), items: cards(null, 'Areas of impact') })
      .meta({ title: 'How we help' }),
    cta: ctaBand({ subheading: true }),
  })
  .meta({ title: 'Gambling Counselling page' });

// Layout: services/individual-counselling.astro
export const individualCounsellingLayout = z
  .strictObject({
    layout: layoutField('individual-counselling'),
    seo: seo(),
    hero: hero(),
    overview: z
      .strictObject({
        heading: sectionHeading(),
        paragraphs: paragraphs(),
        supportHeading: heading('"What counselling can support" heading'),
        supports: listItems('What counselling can support'),
        approach: z
          .strictObject({
            heading: heading(),
            text: prose('Text'),
            facts: z.array(fact()).min(1).meta({ title: 'Key facts', cms: { summary: '{{fields.label}}' } }),
            contact: contactLinks(),
          })
          .meta({ title: '"Our approach" card' }),
      })
      .meta({ title: 'Overview' }),
    expect: z
      .strictObject({ heading: sectionHeading(), items: cards(['chat', 'lock', 'pulse', 'shield'], 'What to expect') })
      .meta({ title: 'What to expect' }),
    cta: ctaBand(),
  })
  .meta({ title: 'Individual Counselling page' });

// Layout: services/outpatients-program.astro
export const outpatientsProgramLayout = z
  .strictObject({
    layout: layoutField('outpatients-program'),
    seo: seo(),
    hero: hero(),
    overview: z
      .strictObject({
        heading: sectionHeading(),
        paragraphs: paragraphs(),
        offerHeading: heading('"What we offer" heading'),
        offerings: listItems('What we offer'),
        image: image(),
        contact: z
          .strictObject({ heading: heading(), phone: link('Phone link'), email: link('Email link'), button: button() })
          .meta({ title: '"Get in touch" card' }),
      })
      .meta({ title: 'Overview' }),
    approach: z
      .strictObject({ heading: sectionHeading(), items: cards(['shield', 'people', 'clock'], 'Approach points') })
      .meta({ title: 'Our approach' }),
    cta: ctaBand(),
  })
  .meta({ title: 'Outpatients Program page' });

// Layout: services/referral.astro (the referral form itself is embedded from Jotform and is not edited here)
export const referralLayout = z
  .strictObject({
    layout: layoutField('referral'),
    seo: seo(),
    hero: hero(),
    form: z
      .strictObject({
        intro: prose('Introduction'),
        privacy: prose('Privacy note'),
      })
      .meta({ title: 'Above the form', description: 'The form itself is embedded from Jotform and is not edited here.' }),
    urgent: z
      .strictObject({ heading: heading(), text: prose('Text'), button: button() })
      .meta({ title: '"Need urgent help?" box' }),
    call: z
      .strictObject({
        heading: heading(),
        text: prose('Text'),
        phone: link('Phone link'),
        orLabel: text('Word between phone and email'),
        email: link('Email link'),
      })
      .meta({ title: '"Prefer to call?" box' }),
    cta: ctaBand({ subheading: true }),
  })
  .meta({ title: 'Make a Referral page' });

// Layout: services/referral/thank-you.astro
export const referralThankYouLayout = z
  .strictObject({
    layout: layoutField('referral-thank-you'),
    seo: seo(),
    hero: z
      .strictObject({
        parentBreadcrumb: text('Breadcrumb: previous page', 'The "Make a Referral" link in the "Home / Services / …" trail.'),
        breadcrumb: text('Breadcrumb', 'The last item in the trail.'),
        heading: heading('Page heading'),
      })
      .meta({ title: 'Banner' }),
    body: z
      .strictObject({ text: prose('Text'), primary: button('First button'), secondary: button('Second button') })
      .meta({ title: 'Message' }),
  })
  .meta({ title: 'Referral thank-you page' });
// --- end W8 ---------------------------------------------------------------------------------------------------

// ========================================================================================================// BEGIN W9 (issue #17): Community Programs layouts (src/pages/community-programs/**).
// Other batches add their own marked blocks; keep this one together so merges stay small.
// ===============================================================================================================

const HOURS_TOKEN = '{hours}';
const HOURS_HINT = 'Keep {hours} where the opening hours go. It is filled in from Opening hours.';
const needsHours = (s) => s.includes(HOURS_TOKEN);
const HOURS_MESSAGE = 'must keep {hours}, the place the opening hours from Opening hours are filled in';

/** One-line text that must keep the {hours} marker. */
const hoursText = (title, description = HOURS_HINT) =>
  z.string().min(1).refine(needsHours, { message: HOURS_MESSAGE }).meta(meta(title, description));

/** Prose that must keep the {hours} marker. */
const hoursProse = (title, description = HOURS_HINT) =>
  z.string().min(1).refine(needsHours, { message: HOURS_MESSAGE }).meta({ ...meta(title, description), cms: { widget: 'markdown' } });

/** Search details where the description holds the {hours} marker. */
const seoWithHours = () =>
  z
    .strictObject({
      title: text('Page title', 'Shown in the browser tab and as the search result heading.'),
      description: z
        .string()
        .min(1)
        .refine(needsHours, { message: HOURS_MESSAGE })
        .meta({ title: 'Search description', description: `The summary search engines show. ${HOURS_HINT}`, cms: { widget: 'text' } }),
      image: imagePath('Sharing image', 'The picture shown when the page is shared on social media.').optional(),
    })
    .meta({ title: 'Search and sharing' });

/** The top banner with two buttons under the line (their look is fixed by the banner). */
const heroWithButtons = ({ breadcrumb = true } = {}) => {
  const fields = {};
  if (breadcrumb) fields.breadcrumb = text('Breadcrumb', 'The last item in the "Home / Community Programs / …" trail.');
  fields.heading = heading('Page heading');
  fields.lead = prose('Line under the heading');
  fields.primary = link('First button');
  fields.secondary = link('Second button');
  return z.strictObject(fields).meta({ title: 'Banner' });
};

/** A fixed-length list (the page's design has a set number of slots, each with its own icon or number). */
const slots = (item, n, title, description) =>
  z.array(item).length(n).meta({ ...meta(title, description), cms: { summary: '{{fields.heading}}' } });

/** A row of photos: each one a file and its alt text. */
const photos = (n, title = 'Photos') => z.array(image('Photo')).length(n).meta(meta(title, `${n} photos, shown in this order.`));

/**
 * The "Service details" table. `hoursRows` are the labels of the rows whose value comes from Opening hours (always
 * first); `rows` are the rest, with links written in prose, e.g. [name@x.org](mailto:name@x.org).
 */
const serviceDetails = (hoursRows = []) => {
  const fields = { caption: text('Table caption') };
  if (hoursRows.length) {
    fields.hoursLabels = z
      .strictObject(Object.fromEntries(hoursRows.map((k) => [k, text(`Label for ${k}`)])))
      .meta({ title: 'Opening hours row labels', description: 'The values come from Opening hours and are not edited here.' });
  }
  fields.rows = z
    .array(z.strictObject({ label: text('Label'), value: prose('Value') }).meta({ title: 'Row' }))
    .min(1)
    .meta({ title: 'Rows', cms: { summary: '{{fields.label}}' } });
  return z.strictObject(fields).meta({ title: 'Service details table' });
};

const callout = () => z.strictObject({ heading: heading(), text: prose('Text') });

// Layout: community-programs/index.astro
export const communityProgramsLayout = z
  .strictObject({
    layout: layoutField('community-programs'),
    seo: seo(),
    hero: heroWithButtons({ breadcrumb: false }),
    programs: z
      .strictObject({
        heading: sectionHeading({ lead: true }),
        cards: slots(
          z.strictObject({ heading: heading(), description: prose('Text') }).meta({ title: 'Card' }),
          4,
          'Program areas',
          'Four cards, each with its own icon.',
        ),
      })
      .meta({ title: 'Our programs' }),
    why: z
      .strictObject({
        image: image(),
        heading: sectionHeading(),
        paragraphs: paragraphs(),
        button: link('Button'),
      })
      .meta({ title: 'Why programs matter' }),
    gains: z
      .strictObject({
        heading: sectionHeading(),
        items: z.array(text('Label')).length(4).meta({ title: 'Labels', description: 'Four items, each with its own icon.' }),
      })
      .meta({ title: 'What people gain' }),
    testimonials: z
      .strictObject({
        heading: sectionHeading(),
        quotes: z
          .array(z.strictObject({ text: prose('Quote'), attribution: text('Attribution') }).meta({ title: 'Quote' }))
          .min(1)
          .meta({ title: 'Quotes', cms: { summary: '{{fields.attribution}}' } }),
      })
      .meta({ title: 'What participants say' }),
    services: z
      .strictObject({
        heading: sectionHeading({ lead: true }),
        cards: z
          .array(
            z
              .strictObject({
                title: heading('Title'),
                summary: text('Summary'),
                href: href('Goes to'),
                image: image(),
                eyebrow: text('Small label'),
              })
              .meta({ title: 'Service card' }),
          )
          .min(1)
          .meta({ title: 'Cards', cms: { summary: '{{fields.title}}' } }),
      })
      .refine((v) => needsHours(v.cards[0].summary), {
        message: `must keep {hours} (the Kitchen opening days are filled in from Opening hours)`,
        path: ['cards', 0, 'summary'],
      })
      .meta({ title: 'Practical support services', description: 'The first card (Oakdene Kitchen) must keep {hours} in its summary.' }),
    involvement: z
      .strictObject({
        heading: sectionHeading(),
        cards: slots(
          z.strictObject({ heading: heading(), body: prose('Text'), button: link('Button') }).meta({ title: 'Card' }),
          3,
          'Cards',
        ),
      })
      .meta({ title: 'How to take part' }),
    cta: ctaBand(),
  })
  .meta({ title: 'Community Programs page' });

// Layout: community-programs/ladies-boutique.astro
export const ladiesBoutiqueLayout = z
  .strictObject({
    layout: layoutField('ladies-boutique'),
    seo: seo(),
    hero: heroWithButtons(),
    intro: z
      .strictObject({
        heading: sectionHeading(),
        paragraphs: paragraphs(),
        motto: text('Motto'),
        details: serviceDetails(),
      })
      .meta({ title: 'Introduction' }),
    offerings: z
      .strictObject({
        heading: sectionHeading(),
        cards: slots(
          z.strictObject({ heading: heading(), description: prose('Text') }).meta({ title: 'Card' }),
          4,
          'Cards',
          'Four cards, each with its own icon.',
        ),
      })
      .meta({ title: 'What we offer' }),
    gallery: photos(4),
    eligibility: z
      .strictObject({
        heading: sectionHeading(),
        automatic: z
          .strictObject({ heading: heading(), intro: prose('Introduction'), items: listItems('Conditions') })
          .meta({ title: 'Automatic eligibility' }),
        stress: z
          .strictObject({ heading: heading(), intro: prose('Introduction'), items: listItems('Indicators') })
          .meta({ title: 'Financial stress assessment' }),
        visitNote: prose('Visit limit note'),
        how: z
          .strictObject({ heading: heading(), text: prose('Text') })
          .meta({ title: 'How to access' }),
        promise: z
          .strictObject({ heading: heading(), text: prose('Text') })
          .meta({ title: 'Access promise' }),
      })
      .meta({ title: 'Eligibility and access' }),
    referral: z
      .strictObject({ heading: sectionHeading() })
      .meta({ title: 'Referral form', description: 'The form itself is a Jotform and is not edited here.' }),
    cta: ctaBand(),
  })
  .meta({ title: 'Ladies Boutique page' });

// Layout: community-programs/oakdene-kitchen.astro
export const oakdeneKitchenLayout = z
  .strictObject({
    layout: layoutField('oakdene-kitchen'),
    seo: seoWithHours(),
    hero: heroWithButtons(),
    intro: z
      .strictObject({
        heading: sectionHeading(),
        paragraph: prose('Introduction'),
        whoLabel: text('"Who it\'s for" label'),
        whoText: prose('"Who it\'s for" text'),
        offerHeading: heading('"What we offer" heading'),
        offerItems: listItems('What we offer'),
        details: serviceDetails(['days', 'hours']),
        motto: text('Motto', 'Shown word for word, quote marks included.'),
      })
      .meta({ title: 'Introduction' }),
    photos: photos(3),
    how: z
      .strictObject({
        heading: sectionHeading(),
        intro: prose('Introduction'),
        eligibility: z.strictObject({ heading: heading(), items: listItems('Requirements') }).meta({ title: 'Eligibility' }),
        note: callout().meta({ title: 'Important note' }),
        guidelines: callout().meta({ title: 'Community guidelines' }),
      })
      .meta({ title: 'How it works' }),
    volunteer: z
      .strictObject({
        image: image(),
        heading: sectionHeading(),
        paragraphs: paragraphs(),
        primary: link('First button'),
        secondary: link('Second button'),
      })
      .meta({ title: 'Volunteer with the Kitchen' }),
    cta: ctaBand(),
  })
  .meta({ title: 'Oakdene Kitchen page' });

// Layout: community-programs/oakdene-laundrette.astro
export const oakdeneLaundretteLayout = z
  .strictObject({
    layout: layoutField('oakdene-laundrette'),
    seo: seoWithHours(),
    hero: hero(),
    intro: z
      .strictObject({
        heading: sectionHeading(),
        paragraph: prose('Introduction'),
        includedHeading: heading('"What\'s included" heading'),
        includedItems: listItems("What's included"),
        details: serviceDetails(['days', 'hours', 'lastEntry']),
      })
      .meta({ title: 'Introduction' }),
    photos: photos(3),
    how: z
      .strictObject({
        heading: sectionHeading(),
        steps: z.array(prose('Step')).min(1).meta({ title: 'Steps', description: 'Numbered 1, 2, 3 … in this order.' }),
        eligibility: z.strictObject({ heading: heading(), text: prose('Text') }).meta({ title: 'Eligibility' }),
      })
      .meta({ title: 'How it works' }),
    group: z
      .strictObject({
        heading: sectionHeading(),
        text: hoursProse('Introduction'),
        points: z.array(prose('Point')).length(4).meta({ title: 'Booking details', description: 'Four points, each with its own icon.' }),
        button: link('Button'),
      })
      .meta({ title: 'Group laundry bookings' }),
    cta: ctaBand(),
  })
  .meta({ title: 'Oakdene Laundrette page' });

// Layout: community-programs/staple-food-packs.astro
export const stapleFoodPacksLayout = z
  .strictObject({
    layout: layoutField('staple-food-packs'),
    seo: seoWithHours(),
    hero: hero(),
    intro: z
      .strictObject({
        heading: sectionHeading(),
        paragraph: prose('Introduction'),
        distribution: hoursProse('Distribution sentence'),
        includedHeading: heading('"What\'s included" heading'),
        includedItems: listItems("What's included"),
        creditLabel: text('Supplier credit'),
        creditLogo: image('Supplier logo'),
        details: serviceDetails(['day', 'hours']),
      })
      .meta({ title: 'Introduction' }),
    banner: image('Photo'),
    rules: z
      .strictObject({
        heading: sectionHeading(),
        packRules: z.strictObject({ heading: heading(), items: listItems('Rules') }).meta({ title: 'Pack rules' }),
        eligibility: z
          .strictObject({ heading: heading(), intro: prose('Introduction'), items: listItems('Requirements') })
          .meta({ title: 'Eligibility' }),
        also: hoursProse('Note under the cards'),
      })
      .meta({ title: 'Rules and eligibility' }),
    cta: ctaBand(),
  })
  .meta({ title: 'Staple Food Packs page' });

// Layout: community-programs/used-clothing-store.astro
export const usedClothingStoreLayout = z
  .strictObject({
    layout: layoutField('used-clothing-store'),
    seo: seo(),
    hero: hero(),
    intro: z
      .strictObject({
        heading: sectionHeading(),
        paragraphs: paragraphs(),
        guidelinesHeading: heading('Visit guidelines heading'),
        guidelines: listItems('Visit guidelines'),
        details: serviceDetails(['days', 'hours']),
        eligibility: z.strictObject({ heading: heading(), text: prose('Text') }).meta({ title: 'Eligibility' }),
      })
      .meta({ title: 'Introduction' }),
    photos: photos(2),
    also: z
      .strictObject({
        heading: heading(),
        text: prose('Text'),
        primary: link('First button'),
        secondary: link('Second button'),
      })
      .meta({ title: 'Also on the same days' }),
    cta: ctaBand(),
  })
  .meta({ title: 'Used Clothing Store page' });

// Layout: community-programs/volunteering/index.astro
export const volunteeringLayout = z
  .strictObject({
    layout: layoutField('volunteering'),
    seo: seo(),
    hero: hero(),
    why: z
      .strictObject({
        heading: sectionHeading(),
        paragraph: prose('Introduction'),
        reasons: listItems('Reasons'),
        button: link('Button'),
        image: image(),
      })
      .meta({ title: 'Why volunteer' }),
    types: z
      .strictObject({
        heading: sectionHeading(),
        learnMoreLabel: text('Card button text'),
        cards: z
          .array(
            z
              .strictObject({ heading: heading(), description: prose('Text'), href: href('Goes to'), image: image() })
              .meta({ title: 'Card' }),
          )
          .min(1)
          .meta({ title: 'Cards', cms: { summary: '{{fields.heading}}' } }),
      })
      .meta({ title: 'Ways to volunteer' }),
    expect: z
      .strictObject({
        heading: sectionHeading(),
        steps: slots(
          z.strictObject({ heading: heading(), body: prose('Text') }).meta({ title: 'Step' }),
          4,
          'Steps',
          'Numbered 01 to 04 in this order.',
        ),
      })
      .meta({ title: 'What to expect' }),
    form: z
      .strictObject({ heading: heading('Heading'), intro: prose('Introduction') })
      .meta({ title: 'Application form', description: 'The form itself is a Jotform and is not edited here.' }),
    cta: ctaBand(),
  })
  .meta({ title: 'Volunteering page' });

// Layout: community-programs/volunteering/community-volunteers.astro
export const communityVolunteersLayout = z
  .strictObject({
    layout: layoutField('community-volunteers'),
    seo: seo(),
    hero: hero(),
    overview: z
      .strictObject({
        heading: sectionHeading(),
        paragraphs: paragraphs(),
        rolesHeading: heading('"Possible volunteer roles" heading'),
        roles: listItems('Roles'),
        photos: photos(2),
      })
      .meta({ title: 'Overview' }),
    lookFor: z
      .strictObject({
        heading: sectionHeading(),
        items: listItems('What we look for'),
        note: prose('Note'),
        button: link('Button'),
      })
      .meta({ title: 'What we look for' }),
    cta: ctaBand({ subheading: true }),
  })
  .meta({ title: 'Community Volunteers page' });

// Layout: community-programs/volunteering/corporate-volunteering.astro
export const corporateVolunteeringLayout = z
  .strictObject({
    layout: layoutField('corporate-volunteering'),
    seo: seo(),
    hero: hero(),
    overview: z
      .strictObject({
        heading: sectionHeading(),
        paragraphs: paragraphs(),
        oppsHeading: heading('"Potential opportunities" heading'),
        opportunities: listItems('Opportunities'),
        image: image(),
        contact: z
          .strictObject({ heading: heading(), text: prose('Text'), primary: link('First button'), secondary: link('Second button') })
          .meta({ title: 'Get in touch' }),
      })
      .meta({ title: 'Overview' }),
    why: z
      .strictObject({
        heading: sectionHeading(),
        items: slots(
          z.strictObject({ heading: heading(), body: prose('Text') }).meta({ title: 'Reason' }),
          3,
          'Reasons',
          'Three cards, each with its own icon.',
        ),
      })
      .meta({ title: 'Why Oakdene' }),
    cta: ctaBand({ subheading: true }),
  })
  .meta({ title: 'Corporate Volunteering page' });

// Layout: community-programs/volunteering/thank-you.astro
export const volunteerThankYouLayout = z
  .strictObject({
    layout: layoutField('volunteer-thank-you'),
    seo: seo(),
    hero: z.strictObject({ breadcrumb: text('Breadcrumb'), heading: heading('Page heading') }).meta({ title: 'Banner' }),
    body: z
      .strictObject({ text: prose('Message'), primary: link('First button'), secondary: link('Second button') })
      .meta({ title: 'Message' }),
  })
  .meta({ title: 'Volunteer thank-you page' });

// END W9

// ===== W10 BEGIN (stage W10, issue #18: home, contact, support-us, need-help-now, resources x3, service-directory) =====
// Kept in one block because other stages edit this file; the only lines W10 adds elsewhere are the three spreads
// named "w10…" in `pageLayouts` and `pageFiles`, and the `site` entry in `cmsCollections`.

/** The home-style banner (Hero.astro): heading, line under it, background image and buttons. */
const heroBanner = () =>
  z
    .strictObject({
      heading: heading('Page heading'),
      subheading: longText('Line under the heading'),
      image: image('Background image'),
      buttons: z
        .array(
          z
            .strictObject({
              label: text('Text'),
              href: href('Goes to'),
              style: z.enum(['white', 'white-outline']).meta({ title: 'Style', description: 'white (filled) or white-outline.' }),
            })
            .meta({ title: 'Button' }),
        )
        .meta({ title: 'Buttons', cms: { summary: '{{fields.label}}' } }),
    })
    .meta({ title: 'Banner' });

/** A banner with no image: page heading and the line under it. */
const plainBanner = () =>
  z.strictObject({ heading: heading('Page heading'), lead: longText('Line under the heading') }).meta({ title: 'Banner' });

/** The call-to-action band, where a page may leave out the line under the heading or the second button. */
const ctaBandW10 = ({ subheading = false, secondary = true } = {}) => {
  const fields = { heading: heading() };
  if (subheading) fields.subheading = longText('Line under the heading');
  fields.primary = link('First button');
  if (secondary) fields.secondary = link('Second button');
  return z.strictObject(fields).meta({ title: 'Call to action band' });
};

const cardsOf = (shape, title) =>
  z.array(z.strictObject(shape).meta({ title: 'Item' })).min(1).meta({ title, cms: { summary: '{{fields.title}}' } });

const SUMMARY_NOTE = 'Shown word for word.';

// Layout: index.astro
export const homeLayout = z
  .strictObject({
    layout: layoutField('home'),
    seo: seo(),
    hero: heroBanner(),
    pathways: z
      .strictObject({
        heading: heading('"How can we help?" heading'),
        items: cardsOf({ title: heading('Title'), summary: longText('Summary'), href: href('Goes to') }, 'Quick links'),
      })
      .meta({ title: 'Quick links' }),
    mission: z
      .strictObject({
        heading: heading(),
        paragraphs: paragraphs(),
        button: link('Button'),
        image: image(),
      })
      .meta({ title: 'Mission' }),
    impact: z
      .strictObject({
        ariaLabel: text('Section label for screen readers'),
        eyebrow: text('Small label above the heading'),
        heading: heading(),
        stats: z
          .array(z.strictObject({ number: text('Number'), label: text('Label') }).meta({ title: 'Figure' }))
          .min(1)
          .meta({ title: 'Figures', cms: { summary: '{{fields.number}}' } }),
        note: longText('Note under the figures'),
      })
      .meta({ title: 'Our impact' }),
    services: z
      .strictObject({
        heading: sectionHeading(),
        counselling: z.strictObject({ title: heading('Title'), summary: longText('Summary'), href: href('Goes to'), image: image() }).meta({ title: 'First card' }),
        lifeChoices: z.strictObject({ title: heading('Title'), summary: longText('Summary'), href: href('Goes to'), image: image() }).meta({ title: 'Second card' }),
        kitchen: z
          .strictObject({
            title: heading('Title'),
            summary: longText('Summary', 'The Oakdene Kitchen opening hours (from Opening hours) and a full stop are added after this text.'),
            href: href('Goes to'),
            image: image(),
          })
          .meta({ title: 'Third card' }),
        boutique: z.strictObject({ title: heading('Title'), summary: longText('Summary'), href: href('Goes to'), image: image() }).meta({ title: 'Fourth card' }),
        button: link('Button under the cards'),
      })
      .meta({ title: 'Services' }),
    steps: z
      .strictObject({
        heading: sectionHeading(),
        listLabel: text('List label for screen readers'),
        items: z
          .array(z.strictObject({ title: heading('Title'), body: longText('Text') }).meta({ title: 'Step' }))
          .min(1)
          .meta({ title: 'Steps', description: 'Numbered 1, 2, 3 … in this order.', cms: { summary: '{{fields.title}}' } }),
        image: image(),
      })
      .meta({ title: 'How support works' }),
    testimonials: z.strictObject({ heading: sectionHeading() }).meta({ title: 'Testimonials', description: 'The quotes come from testimonials.json and are not edited here.' }),
    faq: z.strictObject({ heading: sectionHeading() }).meta({ title: 'Questions', description: 'The questions come from the FAQs form.' }),
    video: z
      .strictObject({
        heading: sectionHeading({ lead: true }),
        playLabel: text('Play button label for screen readers'),
        transcriptLabel: text('Transcript button'),
      })
      .meta({ title: 'Video', description: 'The video itself comes from the video launch pack and is not edited here.' }),
    cta: ctaBandW10({ subheading: true }),
  })
  .meta({ title: 'Home page' });

// Layout: contact.astro
export const contactLayout = z
  .strictObject({
    layout: layoutField('contact'),
    seo: seo(),
    hero: heroBanner(),
    cards: z
      .strictObject({
        srHeading: text('Hidden heading for screen readers'),
        phone: z.strictObject({ heading: heading(), link: link('Phone link'), note: text('Note') }).meta({ title: 'Phone card' }),
        email: z.strictObject({ heading: heading(), link: link('Email link'), note: text('Note') }).meta({ title: 'Email card' }),
        visit: z.strictObject({ heading: heading(), address: text('Address'), note: text('Note') }).meta({ title: 'Visit card' }),
        hours: z
          .strictObject({
            heading: heading(),
            note: text('Note under the hours', 'The days and hours come from Opening hours.'),
          })
          .meta({ title: 'Opening hours card' }),
      })
      .meta({ title: 'Contact cards' }),
    serviceContacts: z
      .strictObject({
        heading: sectionHeading(),
        cards: z
          .array(z.strictObject({ title: heading('Heading'), email: link('Email link'), phone: link('Phone link') }).meta({ title: 'Contact' }))
          .min(1)
          .meta({ title: 'Contacts', cms: { summary: '{{fields.title}}' } }),
      })
      .meta({ title: 'Service-specific contacts' }),
    hours: z
      .strictObject({
        heading: sectionHeading(),
        kitchen: text('Kitchen label', 'Its hours come from Opening hours.'),
        staplePacks: text('Staple Food Packs label', 'Its hours come from Opening hours.'),
        laundrette: text('Laundrette label', 'Its hours come from Opening hours.'),
        clothingStore: text('Used Clothing Store label', 'Its hours come from Opening hours.'),
        boutique: z.strictObject({ label: text('Label'), value: text('Hours') }).meta({ title: 'Ladies Boutique' }),
        counselling: z.strictObject({ label: text('Label'), value: text('Hours') }).meta({ title: 'Counselling' }),
        lifeChoices: z.strictObject({ label: text('Label'), value: prose('Hours') }).meta({ title: 'Life Choices Program' }),
      })
      .meta({ title: 'Service hours' }),
    extra: z
      .strictObject({
        srHeading: text('Hidden heading for screen readers'),
        language: z.strictObject({ heading: heading(), text: longText('Text') }).meta({ title: 'Language support' }),
        postal: z
          .strictObject({
            heading: heading(),
            line1: text('Address line 1'),
            line2: text('Address line 2'),
            abn: text('ABN line'),
          })
          .meta({ title: 'Postal address' }),
      })
      .meta({ title: 'Additional information' }),
    map: z
      .strictObject({
        heading: sectionHeading(),
        title: text('Map title for screen readers'),
        label: text('Map label for screen readers'),
        directionsLabel: text('Directions link'),
      })
      .meta({ title: 'Map' }),
    form: z
      .strictObject({
        heading: heading('Form heading'),
        intro: prose('Introduction'),
        successHeading: text('Message after sending'),
        successText: prose('Text under the message after sending'),
        honeypotLabel: text('Hidden spam-trap label', 'Not shown to visitors. Leave as is unless asked.'),
        firstName: text('First name label'),
        lastName: text('Last name label'),
        email: text('Email label'),
        phone: text('Phone label'),
        optional: text('"Optional" marker'),
        reason: text('Reason label'),
        reasonPlaceholder: text('Reason placeholder'),
        reasons: z
          .strictObject({
            general: text('General enquiry'),
            counselling: text('Counselling or support'),
            communityPrograms: text('Community programs'),
            programInterest: text('Program interest'),
            volunteering: text('Volunteering'),
            partnership: text('Partnership or organisation enquiry'),
            donation: text('Donation or fundraising'),
            media: text('Media enquiry'),
            other: text('Other'),
          })
          .meta({ title: 'Reasons for enquiry' }),
        message: text('Message label'),
        consent: prose('Consent tick box'),
        submit: text('Send button', 'After a failed send the form script puts the words "Send message" back on the button; that is not editable here.'),
      })
      .meta({ title: 'Enquiry form', description: 'Error messages shown by the form are not edited here.' }),
    cta: ctaBandW10({ subheading: true }),
  })
  .meta({ title: 'Contact page' });

// Layout: support-us.astro
export const supportUsLayout = z
  .strictObject({
    layout: layoutField('support-us'),
    seo: seo(),
    hero: heroBanner(),
    intro: z.strictObject({ srHeading: text('Hidden heading for screen readers'), text: longText('Text') }).meta({ title: 'Introduction' }),
    donate: z.strictObject({ srHeading: text('Hidden heading for screen readers'), heading: heading('Donation box heading') }).meta({ title: 'Donate' }),
    otherWays: z
      .strictObject({
        ariaLabel: text('Section label for screen readers'),
        heading: heading(),
        directDeposit: z
          .strictObject({
            heading: heading(),
            rows: z
              .array(z.strictObject({ label: text('Label'), value: text('Value') }).meta({ title: 'Row' }))
              .min(1)
              .meta({ title: 'Details', cms: { summary: '{{fields.label}}' } }),
          })
          .meta({ title: 'Direct deposit' }),
        cheque: z.strictObject({ heading: heading(), text: prose('Text') }).meta({ title: 'Cheque' }),
        workplace: z.strictObject({ heading: heading(), text: prose('Text') }).meta({ title: 'Workplace giving' }),
        will: z.strictObject({ heading: heading(), text: prose('Text') }).meta({ title: 'Gift in your will' }),
        corporate: z.strictObject({ heading: heading(), text: prose('Text') }).meta({ title: 'Corporate partnership' }),
      })
      .meta({ title: 'Other ways to give' }),
    assurance: z
      .strictObject({
        srHeading: text('Hidden heading for screen readers'),
        lines: z.array(longText('Line')).min(1).meta({ title: 'Lines (shown in italics)' }),
        credentials: text('Credentials line'),
      })
      .meta({ title: 'Assurance' }),
    faq: z
      .strictObject({
        heading: heading(),
        items: z
          .array(z.strictObject({ question: text('Question'), answer: longText('Answer') }).meta({ title: 'Question' }))
          .min(1)
          .meta({ title: 'Questions', cms: { summary: '{{fields.question}}' } }),
      })
      .meta({ title: 'Questions about donations' }),
    cta: ctaBandW10({ subheading: true, secondary: false }),
  })
  .meta({ title: 'Support Us page' });

// Layout: need-help-now.astro
export const needHelpNowLayout = z
  .strictObject({
    layout: layoutField('need-help-now'),
    seo: seo(),
    banner: z
      .strictObject({ ariaLabel: text('Section label for screen readers'), heading: heading('Page heading'), lead: longText('Line under the heading') })
      .meta({ title: 'Banner' }),
    emergency: z
      .strictObject({
        label: text('Label'),
        callPrefix: text('Word before the number'),
        number: link('Emergency number'),
      })
      .meta({ title: 'Immediate danger' }),
    helplines: z
      .strictObject({
        heading: heading(),
        lead: longText('Line under the heading'),
        items: z
          .array(
            z
              .strictObject({
                name: text('Name'),
                description: text('Description'),
                phone: text('Number as shown'),
                href: href('Phone link', 'tel: followed by digits only, e.g. tel:131114.'),
              })
              .meta({ title: 'Helpline' }),
          )
          .min(1)
          .meta({ title: 'Helplines', cms: { summary: '{{fields.name}}' } }),
      })
      .meta({ title: 'Crisis support lines' }),
    talk: z
      .strictObject({
        heading: heading(),
        intro: longText('Introduction'),
        phone: link('Phone link'),
        phoneAriaLabel: text('Phone link label for screen readers'),
        emailLabel: text('Word before the email'),
        email: link('Email link'),
        languageNote: longText('Language note'),
        hoursHeading: text('Hours box heading'),
        availabilityLead: text('Hours sentence', 'The opening hours (from Opening hours) and a full stop are added after this text.'),
        outsideHours: longText('Outside-hours note'),
      })
      .meta({ title: 'Talk to Oakdene' }),
    note: z.strictObject({ ariaLabel: text('Section label for screen readers'), text: prose('Note') }).meta({ title: 'Final note' }),
  })
  .meta({ title: 'Need Help Now page' });

// Layout: resources.astro
export const resourcesLayout = z
  .strictObject({
    layout: layoutField('resources'),
    seo: seo(),
    banner: z.strictObject({ ariaLabel: text('Section label for screen readers'), heading: heading('Page heading'), lead: longText('Line under the heading') }).meta({ title: 'Banner' }),
    featured: z
      .strictObject({
        heading: sectionHeading({ lead: true }),
        comingSoon: text('"Coming soon" label'),
        items: z
          .array(
            z
              .strictObject({
                title: heading('Title'),
                description: longText('Description'),
                icon: z.enum(['book', 'share', 'map', 'heart']).meta({ title: 'Icon' }),
              })
              .meta({ title: 'Resource' }),
          )
          .min(1)
          .meta({ title: 'Resources', cms: { summary: '{{fields.title}}' } }),
      })
      .meta({ title: 'Featured resources' }),
    available: z
      .strictObject({
        heading: sectionHeading(),
        links: z
          .array(z.strictObject({ label: text('Text'), href: href('Goes to') }).meta({ title: 'Link' }))
          .min(1)
          .meta({ title: 'Links', cms: { summary: '{{fields.label}}' } }),
        videosLabel: text('Videos drop-down label'),
        ourStory: z
          .strictObject({
            title: text('Title'),
            playLabel: text('Play button label for screen readers'),
            blurb: longText('Text'),
            transcriptLabel: text('Transcript link'),
          })
          .meta({ title: 'Our story video', description: 'The video itself comes from the video launch pack.' }),
        secondVideo: z
          .strictObject({
            youtubeId: text('YouTube video id'),
            title: text('Title'),
            thumbnail: imagePath('Thumbnail image'),
            playLabel: text('Play button label for screen readers'),
          })
          .meta({ title: 'Second video' }),
        channelLabel: text('YouTube channel link'),
        note: prose('Note under the list'),
      })
      .meta({ title: 'Available resources' }),
    cta: ctaBandW10(),
  })
  .meta({ title: 'Resources page' });

// Layouts: resources/flyers-and-brochures.astro and resources/information-sheets.astro (same fields, own markup)
const resourcePlaceholderLayout = (name, title) =>
  z
    .strictObject({
      layout: layoutField(name),
      seo: seo(),
      hero: hero(),
      comingSoon: z
        .strictObject({
          heading: heading(),
          text: longText('Text'),
          contact: link('First button'),
          back: link('Second button'),
        })
        .meta({ title: 'Coming soon box' }),
      cta: ctaBandW10({ subheading: true, secondary: name === 'information-sheets' }),
    })
    .meta({ title });
export const flyersAndBrochuresLayout = resourcePlaceholderLayout('flyers-and-brochures', 'Flyers and Brochures page');
export const informationSheetsLayout = resourcePlaceholderLayout('information-sheets', 'Information Sheets page');

// Layout: service-directory.astro (the listing comes from oakdene-service-directory.json, written by its sync)
export const serviceDirectoryLayout = z
  .strictObject({
    layout: layoutField('service-directory'),
    seo: seo(),
    hero: z
      .strictObject({
        ariaLabel: text('Section label for screen readers'),
        heading: heading('Page heading'),
        lead: longText('Line under the heading', 'Keep {total}: it is replaced by the number of listed services.'),
      })
      .meta({ title: 'Banner' }),
    filter: z
      .strictObject({
        ariaLabel: text('Search bar label for screen readers'),
        searchLabel: text('Search label'),
        searchPlaceholder: text('Search placeholder'),
        categoryLabel: text('Category label'),
        allCategories: text('"All categories" choice', 'Keep {total}: it is replaced by the number of services.'),
        locationLabel: text('Location label'),
        allLocations: text('"All locations" choice'),
      })
      .meta({ title: 'Search and filters' }),
    cards: z
      .strictObject({
        srHeading: text('Hidden heading for screen readers'),
        byPrefix: text('Word before the organisation'),
        noContact: text('No contact details message'),
        website: text('Website link'),
        acnc: text('Charity register link'),
        emptyState: prose('Message when no service matches'),
      })
      .meta({ title: 'Service cards' }),
    disclaimer: z
      .strictObject({
        ariaLabel: text('Section label for screen readers'),
        text: longText('Text', 'Keep {date}: it is replaced by the date the directory was last verified.'),
      })
      .meta({ title: 'Disclaimer' }),
    otherDirectories: z.strictObject({ heading: sectionHeading({ lead: true }) }).meta({ title: 'Wider directories', description: 'The list itself comes from the directory sync.' }),
    cta: ctaBandW10({ subheading: false }),
  })
  .meta({ title: 'Service Directory page' });

const w10Layouts = {
  home: homeLayout,
  contact: contactLayout,
  'support-us': supportUsLayout,
  'need-help-now': needHelpNowLayout,
  resources: resourcesLayout,
  'flyers-and-brochures': flyersAndBrochuresLayout,
  'information-sheets': informationSheetsLayout,
  'service-directory': serviceDirectoryLayout,
};
const w10PageFiles = [
  { name: 'index', label: 'Home', layout: 'home' },
  { name: 'contact', label: 'Contact', layout: 'contact' },
  { name: 'support-us', label: 'Support Us', layout: 'support-us' },
  { name: 'need-help-now', label: 'Need Help Now', layout: 'need-help-now' },
  { name: 'resources', label: 'Resources', layout: 'resources' },
  { name: 'resources--flyers-and-brochures', label: 'Flyers and Brochures', layout: 'flyers-and-brochures' },
  { name: 'resources--information-sheets', label: 'Information Sheets', layout: 'information-sheets' },
  { name: 'service-directory', label: 'Service Directory', layout: 'service-directory' },
];

// Site-wide text (src/content/site.yaml): header, footer. Link addresses and menu structure stay in the components;
// only the words are here.
const navLabel = (title) => text(title);
export const siteSchema = z
  .strictObject({
    header: z
      .strictObject({
        logo: z
          .strictObject({ alt: text('Logo alt text'), homeLabel: text('Logo link label for screen readers') })
          .meta({ title: 'Logo' }),
        nav: z
          .strictObject({
            home: navLabel('Home'),
            about: navLabel('About'),
            services: navLabel('Addiction Support'),
            community: navLabel('Community Programs'),
            resources: navLabel('Resources'),
            directory: navLabel('Service Directory'),
            contact: navLabel('Contact'),
          })
          .meta({ title: 'Main menu' }),
        servicesMenu: z
          .strictObject({
            individualCounselling: navLabel('Individual Counselling'),
            gamblingCounselling: navLabel('Gambling Counselling'),
            lifeChoices: navLabel('Life Choices Program'),
            groupDbt: navLabel('Group DBT Therapy'),
            outpatients: navLabel('Outpatients Program'),
            aaGa: navLabel('AA & GA Meetings'),
            financialCounselling: navLabel('Financial Counselling'),
          })
          .meta({ title: 'Addiction Support menu' }),
        communityMenu: z
          .strictObject({
            kitchen: navLabel('Oakdene Kitchen'),
            staplePacks: navLabel('Staple Food Packs'),
            laundrette: navLabel('Oakdene Laundrette'),
            boutique: navLabel('Ladies Boutique'),
            clothingStore: navLabel('Used Clothing Store'),
            volunteering: navLabel('Volunteering'),
          })
          .meta({ title: 'Community Programs menu' }),
        buttons: z
          .strictObject({ getSupport: text('Get Support button'), needHelp: text('Need Help Now button') })
          .meta({ title: 'Header buttons' }),
      })
      .meta({ title: 'Header' }),
    footer: z
      .strictObject({
        about: z
          .strictObject({
            heading: heading(),
            aboutUs: navLabel('About Us'),
            ourStory: navLabel('Our Story'),
            ourTeam: navLabel('Our Team'),
            ourCentre: navLabel('Our Centre'),
          })
          .meta({ title: 'About column' }),
        services: z
          .strictObject({
            heading: heading(),
            individualCounselling: navLabel('Individual Counselling'),
            lifeChoices: navLabel('Life Choices Program'),
            groupDbt: navLabel('Group DBT Therapy'),
            gamblingCounselling: navLabel('Gambling Counselling'),
            outpatients: navLabel('Outpatients Program'),
            aaGa: navLabel('AA & GA Meetings'),
            all: navLabel('All Services'),
          })
          .meta({ title: 'Services column' }),
        community: z
          .strictObject({
            heading: heading(),
            kitchen: navLabel('Oakdene Kitchen'),
            laundrette: navLabel('Oakdene Laundrette'),
            boutique: navLabel('Ladies Boutique'),
            staplePacks: navLabel('Staple Food Packs'),
            volunteering: navLabel('Volunteering'),
            all: navLabel('All Community Programs'),
          })
          .meta({ title: 'Community Programs column' }),
        help: z
          .strictObject({
            heading: heading(),
            contact: navLabel('Contact'),
            needHelp: navLabel('Need Help Now'),
            referral: navLabel('Make a Referral'),
            faq: navLabel('FAQ'),
          })
          .meta({ title: 'Get Help column' }),
        contact: z
          .strictObject({
            heading: heading(),
            phone: link('Phone link'),
            email: link('Email link'),
            address: text('Street address'),
            poBox: text('Postal address'),
          })
          .meta({ title: 'Contact column' }),
        legal: z
          .strictObject({
            abn: text('ABN'),
            charity: text('Charity status'),
            privacy: navLabel('Privacy Policy'),
            terms: navLabel('Terms of Use'),
            accessibility: navLabel('Accessibility'),
          })
          .meta({ title: 'Bottom row' }),
        copyright: text('Copyright text', 'Shown after "© year". The year is added automatically.'),
        logoAlt: text('Logo alt text'),
        logoLabel: text('Logo link label for screen readers'),
      })
      .meta({ title: 'Footer' }),
  })
  .meta({ title: 'Site-wide text' });
// ===== W10 END =====
// ===== W11 (issue #19): About pages — BEGIN =====
// Layouts for src/pages/about.astro and src/pages/about/*. Keep this block together; other batches edit nearby.

/** The small banner used by the About sub-pages: breadcrumb label, heading and (optionally) the line under it. */
const aboutHero = ({ lead = true } = {}) => {
  const fields = { breadcrumb: text('Breadcrumb', 'The last item in the "Home / About / …" trail.'), heading: heading('Page heading') };
  if (lead) fields.lead = prose('Line under the heading');
  return z.strictObject(fields).meta({ title: 'Banner' });
};

/** A person card: name, role, photo with alt text and a short biography. */
const person = (title) =>
  z
    .strictObject({
      name: text('Name'),
      role: text('Role'),
      photo: image('Photo'),
      bio: prose('Biography'),
    })
    .meta({ title });

// Layout: about.astro
export const aboutLayout = z
  .strictObject({
    layout: layoutField('about'),
    seo: seo(),
    hero: z
      .strictObject({
        heading: heading('Page heading'),
        subheading: text('Line under the heading'),
        image: image('Banner photo'),
        primary: link('First button'),
        secondary: link('Second button'),
      })
      .meta({ title: 'Banner' }),
    subpages: z
      .array(
        z
          .strictObject({
            href: href('Goes to'),
            image: image('Photo'),
            heading: heading(),
            text: text('Text'),
            cta: text('Link text', 'The arrow after it is added automatically.'),
          })
          .meta({ title: 'Card' }),
      )
      .min(1)
      .meta({ title: 'Section cards', cms: { summary: '{{fields.heading}}' } }),
    who: z
      .strictObject({ heading: sectionHeading(), lead: prose('Paragraph') })
      .meta({ title: 'Who we are' }),
    impact: z
      .strictObject({
        heading: sectionHeading(),
        stats: z
          .array(z.strictObject({ number: text('Figure'), label: text('Label') }).meta({ title: 'Figure' }))
          .min(1)
          .meta({ title: 'Figures', cms: { summary: '{{fields.number}} {{fields.label}}' } }),
      })
      .meta({ title: 'Our year in numbers' }),
    drivers: z
      .strictObject({
        heading: sectionHeading(),
        mission: z.strictObject({ label: text('Label'), text: prose('Text') }).meta({ title: 'Mission' }),
        vision: z.strictObject({ label: text('Label'), text: prose('Text') }).meta({ title: 'Vision' }),
        valuesHeading: heading('"Our Values" heading'),
        dignity: z.strictObject({ heading: heading(), text: prose('Text') }).meta({ title: 'First value' }),
        practicalSupport: z.strictObject({ heading: heading(), text: prose('Text') }).meta({ title: 'Second value' }),
        connection: z.strictObject({ heading: heading(), text: prose('Text') }).meta({ title: 'Third value' }),
        hope: z.strictObject({ heading: heading(), text: prose('Text') }).meta({ title: 'Fourth value' }),
      })
      .meta({ title: 'Mission, vision and values', description: 'Each value keeps its own icon, so the four cannot be reordered.' }),
    approach: z
      .strictObject({ heading: sectionHeading(), paragraphs: paragraphs(), image: image() })
      .meta({ title: 'Our approach' }),
    work: z
      .strictObject({
        heading: sectionHeading(),
        items: listItems('What we do'),
        button: button('Button'),
        image: image(),
      })
      .meta({ title: 'What we do' }),
    cta: ctaBand(),
  })
  .meta({ title: 'About page' });

// Layout: about/our-board.astro (not shown to search engines: the noindex tag stays in the page)
export const ourBoardLayout = z
  .strictObject({
    layout: layoutField('our-board'),
    seo: seo(),
    hero: aboutHero({ lead: false }),
    holding: z
      .strictObject({
        heading: heading(),
        message: prose('Message', 'Bold, italic and links only. Keep the two links as links.'),
      })
      .meta({ title: 'Board profiles message' }),
  })
  .meta({ title: 'Our Board page' });

// Layout: about/our-centre.astro
export const ourCentreLayout = z
  .strictObject({
    layout: layoutField('our-centre'),
    seo: seo(),
    hero: aboutHero(),
    intro: z
      .strictObject({
        heading: sectionHeading(),
        paragraphs: paragraphs(),
        expectHeading: heading('"What visitors can expect" heading'),
        expectItems: listItems('What visitors can expect'),
        image: image(),
      })
      .meta({ title: 'The space' }),
    gallery: z
      .strictObject({
        heading: sectionHeading(),
        images: z.array(image('Photo')).min(1).meta({ title: 'Photos', cms: { summary: '{{fields.alt}}' } }),
      })
      .meta({ title: 'Gallery' }),
    location: z
      .strictObject({
        heading: sectionHeading(),
        mapTitle: text('Map description', 'Read by screen readers for the embedded Google map. The map itself stays in the page.'),
        mapLink: link('Link under the map'),
        address: text('Address'),
        phone: link('Phone link'),
        email: link('Email link'),
        parking: text('Parking'),
      })
      .meta({ title: 'Location and access' }),
    directions: z
      .strictObject({ heading: heading(), text: prose('Text'), button: link('Download button') })
      .meta({ title: 'Directions download' }),
    cta: ctaBand({ subheading: true }),
  })
  .meta({ title: 'Our Centre page' });

// Layout: about/our-team.astro
export const ourTeamLayout = z
  .strictObject({
    layout: layoutField('our-team'),
    seo: seo(),
    hero: aboutHero(),
    intro: z.strictObject({ heading: sectionHeading(), lead: prose('Paragraph') }).meta({ title: 'Introduction' }),
    team: z
      .array(person('Team member'))
      .min(1)
      .meta({ title: 'Team members', cms: { summary: '{{fields.name}}' } }),
    patrons: z
      .strictObject({
        heading: sectionHeading(),
        people: z
          .array(person('Patron'))
          .min(1)
          .meta({ title: 'Patrons', cms: { summary: '{{fields.name}}' } }),
      })
      .meta({ title: 'Our Patrons' }),
    closing: z
      .strictObject({
        heading: heading('Hidden heading', 'Read by screen readers only; not shown on the page.'),
        text: prose('Closing statement'),
      })
      .meta({ title: 'Closing statement' }),
    cta: ctaBand({ subheading: true }),
  })
  .meta({ title: 'Our Team page' });

// Layout: about/the-oakdene-story.astro (the film itself and its details come from docs/video-launch, not here)
export const oakdeneStoryLayout = z
  .strictObject({
    layout: layoutField('the-oakdene-story'),
    seo: seo(),
    hero: aboutHero(),
    story: z
      .strictObject({ heading: sectionHeading(), paragraphs: paragraphs(), image: image() })
      .meta({ title: 'The story' }),
    strip: z
      .array(imagePath('Photo'))
      .min(1)
      .meta({ title: 'Black and white photo strip', description: 'Decorative photos, hidden from screen readers.' }),
    film: z
      .strictObject({
        heading: sectionHeading({ lead: true }),
        playLabel: text('Play button label', 'Read by screen readers.'),
        transcriptLink: text('Transcript link text'),
      })
      .meta({ title: 'Watch our story' }),
    why: z
      .strictObject({
        label: text('Small label above the quote'),
        quote: text('Quote', 'The quotation marks are added automatically.'),
      })
      .meta({ title: 'Why it matters' }),
    cta: ctaBand(),
  })
  .meta({ title: 'The Oakdene Story page' });

// Layout: about/the-oakdene-story/video.astro (the video, its details and the transcript stay in code and docs/)
export const oakdeneStoryVideoLayout = z
  .strictObject({
    layout: layoutField('the-oakdene-story-video'),
    seo: seo(),
    hero: aboutHero(),
    breadcrumbParent: text('Middle breadcrumb', 'The "The Oakdene Story" step in the trail; it links back to that page.'),
    watch: z
      .strictObject({
        playLabel: text('Play button label', 'Read by screen readers.'),
        meta: z
          .string()
          .min(1)
          .regex(/\{duration\}/)
          .meta({
            title: 'Line under the video',
            description: 'Keep {duration} where the film length should appear; it is filled in automatically.',
          }),
        quote: text('Pull quote', 'The quotation marks are added automatically.'),
        quoteBy: text('Quote attribution'),
        credit: text('Video credit'),
      })
      .meta({ title: 'Video' }),
    transcript: z
      .strictObject({
        heading: heading(),
        show: text('"Show" button label'),
        hide: text('"Hide" button label'),
        primary: button('First button'),
        secondary: button('Second button'),
      })
      .meta({ title: 'Transcript', description: 'The transcript text comes from docs/video-launch and is not edited here.' }),
  })
  .meta({ title: 'Our story video page' });
// ===== W11 (issue #19): About pages — END =====
// ===============================================================================================================
// W12 (issue #20): privacy policy, terms of use, accessibility statement, thank-you and 404 pages. Own block so
// other batches' edits to this file do not collide.

/** A boxed note (`doc-address`): a bold heading line, then one line per <p>. */
const docBox = (title) =>
  z
    .strictObject({
      heading: text('Bold heading line'),
      lines: z.array(prose('Line')).min(1).meta({ title: 'Lines', description: 'Bold, italic and links only. One entry per line.' }),
    })
    .meta({ title });

/**
 * One piece of a legal section, in page order. Exactly one of the four fields is filled in:
 * a paragraph, a bulleted list, a boxed note or the contact card.
 */
const legalBlock = () =>
  z
    .strictObject({
      paragraph: prose('Paragraph', 'Fill in only one of Paragraph, List, Boxed note or Contact card.').optional(),
      items: z.array(prose('Item')).min(1).meta({ title: 'List', description: 'Bulleted list. One entry per point.' }).optional(),
      callout: docBox('Boxed note').optional(),
      contactCard: docBox('Contact card').optional(),
    })
    .refine((b) => Object.values(b).filter((v) => v !== undefined).length === 1, {
      message: 'fill in exactly one of paragraph, items, callout or contactCard',
    })
    .meta({ title: 'Block' });

/** A numbered or titled section of a legal page. `anchor` is the #link target some pages use; leave it as it is. */
const legalSection = ({ withAnchor }) => {
  const fields = {};
  if (withAnchor) {
    fields.id = z
      .string()
      .regex(/^[a-z][a-z0-9-]*$/)
      .meta({ title: 'Link anchor', description: 'Used in #links to this section. Change it only if you also change the links.' });
  }
  fields.heading = heading('Section heading');
  fields.blocks = z
    .array(legalBlock())
    .min(1)
    .meta({ title: 'Content', description: 'Paragraphs, lists and notes, in the order they appear.', cms: { summary: '{{fields.heading}}' } });
  return z.strictObject(fields).meta({ title: 'Section' });
};

/** The banner of a legal page: breadcrumb label and heading only. */
const legalHero = () =>
  z.strictObject({ breadcrumb: text('Breadcrumb', 'The last item in the "Home / …" trail.'), heading: heading('Page heading') }).meta({ title: 'Banner' });

// Layout: privacy-policy.astro
export const privacyPolicyLayout = z
  .strictObject({
    layout: layoutField('privacy-policy'),
    seo: seo(),
    hero: legalHero(),
    notice: z
      .strictObject({ label: text('Notice title'), text: prose('Line under the title') })
      .meta({ title: 'Opening notice' }),
    version: text('Version line', 'Shown in italics, e.g. "Version: April 2026".'),
    sections: z
      .array(legalSection({ withAnchor: false }))
      .min(1)
      .meta({ title: 'Sections', cms: { summary: '{{fields.heading}}' } }),
    contactCard: docBox('Privacy Officer contact card'),
    closing: prose('Closing line'),
  })
  .meta({ title: 'Privacy Policy page' });

// Layout: terms-of-use.astro
export const termsOfUseLayout = z
  .strictObject({
    layout: layoutField('terms-of-use'),
    seo: seo(),
    hero: legalHero(),
    effective: text('Effective date line', 'Shown in italics.'),
    abn: text('ABN line', 'Shown in italics.'),
    contentsHeading: text('Contents list heading'),
    sections: z
      .array(legalSection({ withAnchor: true }))
      .min(1)
      .meta({
        title: 'Sections',
        description: 'The contents list at the top is built from these section headings, in this order.',
        cms: { summary: '{{fields.heading}}' },
      }),
  })
  .meta({ title: 'Terms of Use page' });

// Layout: accessibility.astro
export const accessibilityLayout = z
  .strictObject({
    layout: layoutField('accessibility'),
    seo: seo(),
    hero: legalHero(),
    lastUpdated: text('Last updated line', 'Shown in italics.'),
    intro: prose('Opening paragraph'),
    sections: z
      .array(legalSection({ withAnchor: true }))
      .min(1)
      .meta({ title: 'Sections', cms: { summary: '{{fields.heading}}' } }),
  })
  .meta({ title: 'Accessibility page' });

// Layout: thankyou.astro (the opening hours in its second paragraph come from src/content/opening-hours.json)
export const thankYouLayout = z
  .strictObject({
    layout: layoutField('thankyou'),
    seo: seo(),
    heading: heading('Page heading'),
    sub: text('Line under the heading'),
    urgent: prose('Urgent enquiries paragraph', 'Ends with a full stop. The sentence about when the team is available follows it.'),
    availabilityLead: text(
      'Words before the office hours',
      'The hours themselves are edited under Opening hours, not here: "Our team is available <hours>."',
    ),
    steps: z
      .strictObject({
        heading: heading('"What happens next" heading'),
        items: z.array(prose('Step')).min(1).meta({ title: 'Steps', description: 'Numbered 1, 2, 3 … in this order.' }),
      })
      .meta({ title: 'What happens next' }),
    buttons: z.array(button()).min(1).meta({ title: 'Buttons', cms: { summary: '{{fields.label}}' } }),
  })
  .meta({ title: 'Thank-you page' });

// Layout: 404.astro
export const notFoundLayout = z
  .strictObject({
    layout: layoutField('not-found'),
    seo: seo(),
    code: text('Large number', 'The faint "404" above the heading.'),
    heading: heading('Page heading'),
    sub: text('Line under the heading'),
    body: text('Explanation'),
    buttons: z.array(button()).min(1).meta({ title: 'Buttons', cms: { summary: '{{fields.label}}' } }),
  })
  .meta({ title: '404 page' });
// ===== end W12 ===============================================================================================

/** Every page layout, by the value of its `layout:` field. */
export const pageLayouts = {
  'life-choices-program': lifeChoicesProgramLayout,
  'aa-ga-meetings': aaGaMeetingsLayout,
  'group-dbt-therapy': groupDbtTherapyLayout,
  // W8
  services: servicesLayout,
  'financial-counselling': financialCounsellingLayout,
  'gambling-counselling': gamblingCounsellingLayout,
  'individual-counselling': individualCounsellingLayout,
  'outpatients-program': outpatientsProgramLayout,
  referral: referralLayout,
  'referral-thank-you': referralThankYouLayout,

  // W9
  'community-programs': communityProgramsLayout,
  'ladies-boutique': ladiesBoutiqueLayout,
  'oakdene-kitchen': oakdeneKitchenLayout,
  'oakdene-laundrette': oakdeneLaundretteLayout,
  'staple-food-packs': stapleFoodPacksLayout,
  'used-clothing-store': usedClothingStoreLayout,
  'volunteering': volunteeringLayout,
  'community-volunteers': communityVolunteersLayout,
  'corporate-volunteering': corporateVolunteeringLayout,
  'volunteer-thank-you': volunteerThankYouLayout,
  ...w10Layouts,
  // W11 (#19)
  about: aboutLayout,
  'our-board': ourBoardLayout,
  'our-centre': ourCentreLayout,
  'our-team': ourTeamLayout,
  'the-oakdene-story': oakdeneStoryLayout,
  'the-oakdene-story-video': oakdeneStoryVideoLayout,
  // W12
  'privacy-policy': privacyPolicyLayout,
  'terms-of-use': termsOfUseLayout,
  accessibility: accessibilityLayout,
  thankyou: thankYouLayout,
  'not-found': notFoundLayout,
};

/** Any page file: the schema is chosen by its `layout:` field. Used by the Astro `pages` collection. */
export const pageSchema = z.discriminatedUnion('layout', Object.values(pageLayouts));

/** The page files the editor lists, in sidebar order. Every YAML file in PAGES_FOLDER must be listed here. */
export const PAGES_FOLDER = 'src/content/pages';
export const pageFiles = [
  { name: 'services--life-choices-program', label: 'Life Choices Program', layout: 'life-choices-program' },
  { name: 'services--aa-ga-meetings', label: 'AA & GA Meetings', layout: 'aa-ga-meetings' },
  { name: 'services--group-dbt-therapy', label: 'Group DBT Therapy', layout: 'group-dbt-therapy' },
  // W8
  { name: 'services', label: 'Services (overview)', layout: 'services' },
  { name: 'services--financial-counselling', label: 'Financial Counselling', layout: 'financial-counselling' },
  { name: 'services--gambling-counselling', label: 'Gambling Counselling', layout: 'gambling-counselling' },
  { name: 'services--individual-counselling', label: 'Individual Counselling', layout: 'individual-counselling' },
  { name: 'services--outpatients-program', label: 'Outpatients Program', layout: 'outpatients-program' },
  { name: 'services--referral', label: 'Make a Referral', layout: 'referral' },
  { name: 'services--referral--thank-you', label: 'Referral thank-you', layout: 'referral-thank-you' },

  // W9
  { name: 'community-programs--index', label: 'Community Programs', layout: 'community-programs' },
  { name: 'community-programs--ladies-boutique', label: 'Community Programs: Ladies Boutique', layout: 'ladies-boutique' },
  { name: 'community-programs--oakdene-kitchen', label: 'Community Programs: Oakdene Kitchen', layout: 'oakdene-kitchen' },
  { name: 'community-programs--oakdene-laundrette', label: 'Community Programs: Oakdene Laundrette', layout: 'oakdene-laundrette' },
  { name: 'community-programs--staple-food-packs', label: 'Community Programs: Staple Food Packs', layout: 'staple-food-packs' },
  { name: 'community-programs--used-clothing-store', label: 'Community Programs: Used Clothing Store', layout: 'used-clothing-store' },
  { name: 'community-programs--volunteering', label: 'Volunteering', layout: 'volunteering' },
  { name: 'community-programs--volunteering--community-volunteers', label: 'Volunteering: Community Volunteers', layout: 'community-volunteers' },
  { name: 'community-programs--volunteering--corporate-volunteering', label: 'Volunteering: Corporate Volunteering', layout: 'corporate-volunteering' },
  { name: 'community-programs--volunteering--thank-you', label: 'Volunteering: Thank You', layout: 'volunteer-thank-you' },
  ...w10PageFiles,
  // W11 (#19)
  { name: 'about', label: 'About', layout: 'about' },
  { name: 'about--our-board', label: 'About: Our Board', layout: 'our-board' },
  { name: 'about--our-centre', label: 'About: Our Centre', layout: 'our-centre' },
  { name: 'about--our-team', label: 'About: Our Team', layout: 'our-team' },
  { name: 'about--the-oakdene-story', label: 'About: The Oakdene Story', layout: 'the-oakdene-story' },
  { name: 'about--the-oakdene-story--video', label: 'About: Our story video', layout: 'the-oakdene-story-video' },
  // W12
  { name: 'privacy-policy', label: 'Privacy Policy', layout: 'privacy-policy' },
  { name: 'terms-of-use', label: 'Terms of Use', layout: 'terms-of-use' },
  { name: 'accessibility', label: 'Accessibility', layout: 'accessibility' },
  { name: 'thankyou', label: 'Thank-you page', layout: 'thankyou' },
  { name: '404', label: '404 (page not found)', layout: 'not-found' },
];

// ---------------------------------------------------------------------------------------------------------------
// The editor's collections, in the order they appear in the sidebar.
//
// kind 'file':   one data file edited as one form.        { name, label, file, format, schema }
// kind 'folder': one data file per entry, all with one schema. { name, label, folder, extension, schema, ...decap }
// kind 'pages':  one data file per page, each with its own layout schema.
//                { name, label, folder, format, layouts: { layout: schema }, files: [{ name, label, layout }] }

export const cmsCollections = [
  {
    kind: 'file',
    name: 'opening-hours',
    label: 'Opening hours',
    file: 'src/content/opening-hours.json',
    format: 'json',
    schema: openingHoursSchema,
  },
  {
    kind: 'file',
    name: 'faqs',
    label: 'FAQs',
    file: 'src/content/faqs.yaml',
    format: 'yaml',
    schema: faqsSchema,
  },
  {
    kind: 'pages',
    name: 'pages',
    label: 'Pages',
    folder: PAGES_FOLDER,
    format: 'yaml',
    layouts: pageLayouts,
    files: pageFiles,
  },
  { kind: 'file', name: 'site', label: 'Site-wide text', file: 'src/content/site.yaml', format: 'yaml', schema: siteSchema },
];
