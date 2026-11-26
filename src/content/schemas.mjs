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

/** Every page layout, by the value of its `layout:` field. */
export const pageLayouts = {
  'life-choices-program': lifeChoicesProgramLayout,
  'aa-ga-meetings': aaGaMeetingsLayout,
  'group-dbt-therapy': groupDbtTherapyLayout,
};

/** Any page file: the schema is chosen by its `layout:` field. Used by the Astro `pages` collection. */
export const pageSchema = z.discriminatedUnion('layout', Object.values(pageLayouts));

/** The page files the editor lists, in sidebar order. Every YAML file in PAGES_FOLDER must be listed here. */
export const PAGES_FOLDER = 'src/content/pages';
export const pageFiles = [
  { name: 'services--life-choices-program', label: 'Life Choices Program', layout: 'life-choices-program' },
  { name: 'services--aa-ga-meetings', label: 'AA & GA Meetings', layout: 'aa-ga-meetings' },
  { name: 'services--group-dbt-therapy', label: 'Group DBT Therapy', layout: 'group-dbt-therapy' },
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
];
