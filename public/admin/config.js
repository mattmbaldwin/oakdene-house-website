// Content editor (Decap CMS) settings, shared by both editing screens:
//   /admin/        full editor: everything, including every page's text
//   /admin/staff/  staff editor: programs, team and board, FAQs and
//                  testimonials, Service Directory and resources
// Both use drafts. A change is saved as a draft and goes live only when a
// full editor publishes it. The staff screen hides the Publish controls.
//
// Which GitHub repository the editor saves to depends on the address:
//   oakdenehouse.org.au          mattmbaldwin/oakdene-house-website (live site)
//   *.pages.dev (test copy)      Simon-HubEasy/oakdene-house-website
//   localhost                    local files, through `npx decap-server`
// Sign-in goes through /api/auth and /api/callback (functions/api/).

(function () {
  var mode = window.OAKDENE_CMS_MODE === 'staff' ? 'staff' : 'full';
  var host = window.location.hostname;
  var isLocal = host === 'localhost' || host === '127.0.0.1';
  var isLive = host === 'oakdenehouse.org.au' || host === 'www.oakdenehouse.org.au';

  var backend = {
    name: 'github',
    repo: isLive ? 'mattmbaldwin/oakdene-house-website' : 'Simon-HubEasy/oakdene-house-website',
    branch: 'main',
    base_url: window.location.origin,
    auth_endpoint: 'api/auth',
    auth_scope: 'public_repo',
    commit_messages: {
      create: 'Content: add {{collection}} "{{slug}}" (via content editor)',
      update: 'Content: update {{collection}} "{{slug}}" (via content editor)',
      delete: 'Content: delete {{collection}} "{{slug}}" (via content editor)',
      uploadMedia: 'Content: upload "{{path}}" (via content editor)',
      deleteMedia: 'Content: delete "{{path}}" (via content editor)',
    },
  };

  // ---------- Shared field helpers ----------
  function text(name, label, extra) { return Object.assign({ name: name, label: label, widget: 'string' }, extra || {}); }
  function longText(name, label, extra) { return Object.assign({ name: name, label: label, widget: 'text' }, extra || {}); }
  function rich(name, label, extra) {
    return Object.assign({
      name: name, label: label, widget: 'markdown',
      buttons: ['bold', 'italic', 'link', 'bulleted-list', 'numbered-list'],
      editor_components: [], modes: ['rich_text', 'raw'],
    }, extra || {});
  }
  function optional(field) { field.required = false; return field; }

  var HINT_LINKS = 'Email addresses and phone numbers become links by themselves. For another link type [link text](/page/).';

  var detailRows = {
    name: 'rows', label: 'Details', widget: 'list', label_singular: 'row', collapsed: false,
    summary: '{{fields.label}}: {{fields.value}}',
    fields: [text('label', 'Label', { hint: 'For example Days, Hours, Location' }), text('value', 'Value', { hint: HINT_LINKS })],
  };
  function programBlock(name, label) {
    return { name: name, label: label, widget: 'object', collapsed: true, fields: [
      { name: 'title', label: 'Title', widget: 'hidden' }, detailRows,
    ] };
  }

  // ---------- Collections ----------
  var programs = {
    name: 'programs', label: 'Program days and times', editor: { preview: false },
    files: [{
      name: 'programs', label: 'Program days and times', file: 'src/content/programs.json',
      description: 'The details table on each program page, and the hours table on the Contact page.',
      fields: [
        programBlock('oakdene_kitchen', 'Oakdene Kitchen'),
        programBlock('staple_food_packs', 'Staple Food Packs'),
        programBlock('oakdene_laundrette', 'Oakdene Laundrette'),
        programBlock('used_clothing_store', 'Used Clothing Store'),
        programBlock('ladies_boutique', 'Ladies Boutique'),
        programBlock('group_dbt_therapy', 'Group DBT Therapy'),
        programBlock('financial_counselling', 'Financial Counselling'),
        programBlock('our_centre', 'Our Centre: visiting details'),
        programBlock('contact_hours', 'Contact page: program hours'),
        { name: 'life_choices', label: 'Life Choices Program: weekly sessions', widget: 'object', collapsed: true, fields: [
          { name: 'title', label: 'Title', widget: 'hidden' },
          { name: 'schedule', label: 'Sessions', widget: 'list', label_singular: 'session', collapsed: false,
            summary: '{{fields.day}} {{fields.time}} ({{fields.format}})',
            fields: [
              { name: 'day', label: 'Day', widget: 'select', options: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
              text('time', 'Time', { hint: 'For example 11:00am – 12:15pm' }),
              text('format', 'Format', { hint: 'For example In-person, or Online / Zoom Only' }),
              optional(text('audience', 'Who it is for', { hint: 'Leave blank if open to everyone, or for example Ladies Only' })),
            ] },
        ] },
      ],
    }],
  };

  function person(photoFolder) {
    return [
      text('name', 'Name'),
      text('role', 'Role'),
      optional({ name: 'photo', label: 'Photo', widget: 'image', media_folder: '/public/images/' + photoFolder, public_folder: '/images/' + photoFolder,
        hint: 'A JPEG photo, ideally at least 800 pixels wide. Ask a full editor to run npm run images after adding a new photo.' }),
      optional(text('initials', 'Initials', { hint: 'Shown instead of a photo if there is none' })),
      optional(longText('bio', 'Biography')),
    ];
  }

  var people = {
    name: 'people', label: 'Team and board', editor: { preview: false },
    files: [
      { name: 'team', label: 'Our Team and patrons', file: 'src/content/team.json', fields: [
        { name: 'team', label: 'Team members', widget: 'list', label_singular: 'team member', summary: '{{fields.name}}, {{fields.role}}', fields: person('team') },
        { name: 'patrons', label: 'Patrons', widget: 'list', label_singular: 'patron', summary: '{{fields.name}}', fields: person('patrons') },
      ] },
      { name: 'board', label: 'Our Board', file: 'src/content/board.json',
        description: 'Until there are board members here, the Our Board page shows a holding message.',
        fields: [
          { name: 'members', label: 'Board members', widget: 'list', label_singular: 'board member', summary: '{{fields.name}}, {{fields.role}}', fields: person('board') },
        ] },
    ],
  };

  var faqs = {
    name: 'faqs', label: 'FAQs and testimonials', editor: { preview: false },
    files: [
      { name: 'faqs', label: 'FAQs', file: 'src/content/faqs.json', fields: [
        { name: 'categories', label: 'FAQ page categories', widget: 'list', label_singular: 'category', summary: '{{fields.title}}',
          hint: 'Letters (A, B, C) are added automatically in this order.',
          fields: [
            text('title', 'Category name'),
            { name: 'items', label: 'Questions', widget: 'list', label_singular: 'question', summary: '{{fields.question}}', fields: [
              text('question', 'Question'), rich('answer', 'Answer'),
            ] },
          ] },
        { name: 'homepage', label: 'Homepage FAQs (the first four are shown)', widget: 'list', label_singular: 'question', summary: '{{fields.question}}', fields: [
          text('question', 'Question'), longText('answer', 'Answer'), optional(text('category', 'Category')),
        ] },
      ] },
      { name: 'testimonials_file', label: 'Testimonials', file: 'src/content/testimonials.json',
        description: 'Use real quotes only, word for word, with the person\'s permission.',
        fields: [
          { name: 'testimonials', label: 'Testimonials', widget: 'list', label_singular: 'testimonial', summary: '{{fields.attribution}}: {{fields.quote}}', fields: [
            longText('quote', 'Quote'), text('attribution', 'Attribution', { hint: 'For example Anonymous, or Program Participant' }),
            { name: 'page', label: 'Shown on', widget: 'select', options: [{ label: 'Homepage', value: 'home' }, { label: 'Not shown (programs, kept for later)', value: 'programs' }] },
          ] },
        ] },
    ],
  };

  function resourceList(name, label) {
    return { name: name, label: label, widget: 'list', label_singular: 'resource', summary: '{{fields.title}}', fields: [
      text('title', 'Title'),
      optional(longText('description', 'Short description')),
      { name: 'file', label: 'File', widget: 'file', media_folder: '/public/downloads', public_folder: '/downloads', hint: 'Upload a PDF. The file size is shown on the page automatically.' },
    ] };
  }

  var resources = {
    name: 'resources', label: 'Resources', editor: { preview: false },
    files: [{ name: 'resources', label: 'Resources', file: 'src/content/resources.json',
      description: 'Each list shows on its page. While a list is empty, the page says the resources are coming soon.',
      fields: [resourceList('flyers', 'Flyers and Brochures page'), resourceList('information_sheets', 'Information Sheets page')] }],
  };

  var directoryGroup = { name: 'categoryGroup', label: 'Category group', widget: 'relation',
    collection: 'directory_settings', file: 'settings', search_fields: ['categoryGroups.*.name'], value_field: 'categoryGroups.*.name', display_fields: ['categoryGroups.*.name'] };
  var directoryCoverage = { name: 'coverage', label: 'Coverage', widget: 'relation', required: false,
    collection: 'directory_settings', file: 'settings', search_fields: ['coverageTiers.*.name'], value_field: 'coverageTiers.*.name', display_fields: ['coverageTiers.*.name'] };

  var directoryServices = {
    name: 'directory', label: 'Service Directory', label_singular: 'service', editor: { preview: false },
    folder: 'src/content/directory/services', extension: 'json', format: 'json', create: true,
    slug: '{{serviceName}}', identifier_field: 'serviceName', summary: '{{serviceName}} ({{category}})',
    sortable_fields: ['serviceName', 'category', 'categoryGroup'],
    view_groups: [{ label: 'Category group', field: 'categoryGroup' }],
    fields: [
      text('serviceName', 'Service name'),
      optional(text('organisation', 'Organisation')),
      text('category', 'Category', { hint: 'The finer category, for example Aboriginal Health' }),
      directoryGroup,
      optional(text('serviceType', 'Type of service')),
      { name: 'contact', label: 'Contact', widget: 'object', fields: [
        optional(text('phone', 'Phone')), optional(text('email', 'Email')), optional(text('website', 'Website', { hint: 'Full address starting with https://' })),
      ] },
      { name: 'location', label: 'Location', widget: 'object', fields: [
        optional(text('suburb', 'Suburb')), optional(text('lga', 'Local government area')), directoryCoverage,
      ] },
      { name: 'social', label: 'Social media', widget: 'object', collapsed: true, required: false, fields: [
        optional(text('facebook', 'Facebook')), optional(text('instagram', 'Instagram')), optional(text('linkedin', 'LinkedIn')),
      ] },
      { name: 'identifiers', label: 'ABN and ACNC', widget: 'object', collapsed: true, required: false, fields: [
        optional(text('abn', 'ABN')), optional(text('acncLink', 'ACNC link')),
      ] },
      { name: 'flags', label: 'Tags', widget: 'object', collapsed: true, fields: [
        { name: 'aod', label: 'Alcohol and other drugs service', widget: 'boolean', default: false },
        { name: 'legal', label: 'Legal service', widget: 'boolean', default: false },
      ] },
      optional(text('listedIn', 'Also listed in')),
    ],
  };

  var directorySettings = {
    name: 'directory_settings', label: 'Service Directory settings', editor: { preview: false },
    files: [{ name: 'settings', label: 'Service Directory settings', file: 'src/content/directory/settings.json', fields: [
      { name: 'meta', label: 'About the directory', widget: 'object', fields: [
        { name: 'lastVerified', label: 'Last checked', widget: 'datetime', date_format: 'D MMMM YYYY', time_format: false, format: 'YYYY-MM-DD',
          hint: 'Shown on the page as "Last checked". Update it after reviewing the listings.' },
        { name: 'version', label: 'Version', widget: 'hidden' }, { name: 'generatedAt', label: 'Generated', widget: 'hidden' },
        { name: 'source', label: 'Source', widget: 'hidden' }, { name: 'description', label: 'Description', widget: 'hidden' },
        { name: 'notes', label: 'Notes', widget: 'hidden' },
      ] },
      { name: 'categoryGroups', label: 'Category groups', widget: 'list', summary: '{{fields.name}}', fields: [
        text('name', 'Name'), { name: 'mappedCategories', label: 'Categories in this group', widget: 'list', field: text('category', 'Category') },
      ] },
      { name: 'coverageTiers', label: 'Coverage types', widget: 'list', summary: '{{fields.name}}', fields: [text('name', 'Name'), optional(text('definition', 'Meaning'))] },
      { name: 'lgaTiers', label: 'Local government areas', widget: 'list', summary: '{{fields.name}}', fields: [text('name', 'Name'), optional(text('description', 'Description'))] },
      { name: 'otherDirectories', label: 'Other directories', widget: 'list', summary: '{{fields.name}}', fields: [
        text('name', 'Name'), optional(text('operator', 'Run by')), text('url', 'Website'), optional(text('coverage', 'Coverage')),
        optional(text('bestFor', 'Best for')), optional(longText('notes', 'Notes')),
      ] },
    ] }],
  };

  // Full editor only: every page's text (added page by page).
  var pages = window.OAKDENE_CMS_PAGES || null;

  var collections = [programs, people, faqs, directoryServices, directorySettings, resources];
  if (mode === 'full' && pages) collections.unshift(pages);

  var config = {
    load_config_file: false,
    backend: backend,
    local_backend: isLocal,
    publish_mode: 'editorial_workflow',
    media_folder: 'public/images/uploads',
    public_folder: '/images/uploads',
    site_url: isLive ? 'https://oakdenehouse.org.au' : window.location.origin,
    display_url: isLive ? 'https://oakdenehouse.org.au' : window.location.origin,
    locale: 'en',
    collections: collections,
  };

  window.CMS_MANUAL_INIT = true;
  window.OAKDENE_CMS_CONFIG = config;
})();
