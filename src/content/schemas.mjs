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
// Later stages (W4, W8 to W12) add page collections here with `kind: 'folder'`.

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
// The editor's collections, in the order they appear in the sidebar.
//
// kind 'file':   one data file edited as one form.        { name, label, file, format, schema }
// kind 'folder': one data file per entry (W4 page files). { name, label, folder, extension, schema, ...decap }

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
];
