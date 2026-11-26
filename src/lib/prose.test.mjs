// Run with: node --test 'src/lib/*.test.mjs'
// Node 22.18+ loads the .ts modules directly (type stripping).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderProse, ProseError } from './prose.ts';
import { loadFaqs, faqPageSections, homeFaqs } from './faqs.ts';

// protects: the four allowed marks render to the exact HTML the pages used to hard-code.
// fails_when: a mark is dropped, mis-nested or wrapped in an extra element. no_claim: page layout.
test('renders bold, italic and plain links exactly', () => {
  assert.equal(renderProse('a **b** [c](/d)'), 'a <strong>b</strong> <a href="/d">c</a>');
  assert.equal(renderProse('*it* and ***both***'), '<em>it</em> and <em><strong>both</strong></em>');
  assert.equal(renderProse('**bold with *italic* inside**'), '<strong>bold with <em>italic</em> inside</strong>');
  assert.equal(renderProse('[**Call**](tel:+61287170999)'), '<a href="tel:+61287170999"><strong>Call</strong></a>');
  assert.equal(
    renderProse('Contact [admin@oakdenehouse.org.au](mailto:admin@oakdenehouse.org.au).'),
    'Contact <a href="mailto:admin@oakdenehouse.org.au">admin@oakdenehouse.org.au</a>.',
  );
});

// protects: new-tab links are an explicit per-link choice (terms-of-use opens a same-domain link in a new tab).
// fails_when: {new} is ignored, leaks into the text, or a plain link gains target/rel.
test('{new} adds target and rel; a plain link gets neither', () => {
  assert.equal(
    renderProse('[Terms](/terms-of-use/){new}'),
    '<a href="/terms-of-use/" target="_blank" rel="noopener noreferrer">Terms</a>',
  );
  assert.equal(renderProse('[Terms](/terms-of-use/)'), '<a href="/terms-of-use/">Terms</a>');
  assert.throws(() => renderProse('[x](/y){newtab}'), /only link marker is \{new\}/);
});

// protects: text moves from template to data without changing a character. fails_when: curly quotes or
// other typographic substitution appear. no_claim: how a browser later displays the character.
test('quotes, dashes and apostrophes stay exactly as typed', () => {
  assert.equal(renderProse("it's"), "it's");
  assert.equal(renderProse('"quoted" -- a—b ... (GP, etc.)'), '"quoted" -- a—b ... (GP, etc.)');
});

// protects: line breaks are the one block-level feature. fails_when: a newline is dropped or becomes a paragraph.
test('line breaks become <br>; escapes give literal characters; text is HTML-escaped', () => {
  assert.equal(renderProse('one\ntwo'), 'one<br>two');
  assert.equal(renderProse('one  \ntwo\\\nthree'), 'one<br>two<br>three');
  assert.equal(renderProse('5 \\* 3 \\[x\\] snake\\_case'), '5 * 3 [x] snake_case');
  assert.equal(renderProse('a & b < c > d'), 'a &amp; b &lt; c &gt; d');
  assert.equal(renderProse('first_name and a_b'), 'first_name and a_b');
});

// protects: anything outside the editor's allowed set stops the build and names its source.
// fails_when: unsupported Markdown renders silently. no_claim: every possible Markdown construct is listed.
test('anything else throws, naming the source', () => {
  const rejected = [
    '# h',
    '## heading',
    '> quote',
    '- item',
    '* item',
    '1. item',
    '---',
    'para one\n\npara two',
    'some `code`',
    '![alt](/img.png)',
    '<b>html</b>',
    '<https://example.org>',
    'AT&amp;T',
    '~~gone~~',
    '_italic_',
    '**unclosed',
    '*unclosed',
    '[no address]',
    'stray ]',
    '[x](javascript:alert(1))',
    '[x](/a b)',
    '[x]()',
    '[](/empty)',
    '** spaced **',
    'back\\slash',
    'line\n    indented code',
    'Title\n===',
  ];
  for (const md of rejected) {
    assert.throws(() => renderProse(md, 'src/content/x.yaml'), (err) => {
      assert.ok(err instanceof ProseError, `${JSON.stringify(md)} threw ${err}`);
      assert.match(err.message, /^src\/content\/x\.yaml: /);
      return true;
    }, `expected ${JSON.stringify(md)} to throw`);
  }
});

// protects: the data file and its loader keep the two lists the site shows today.
// fails_when: a question is lost, the home page shows a different 4, or an answer stops rendering.
test('faqs.yaml loads: 26 FAQ-page questions in 6 sections, the same 4 on the home page', () => {
  const data = loadFaqs(readFileSync(new URL('../content/faqs.yaml', import.meta.url), 'utf8'));
  assert.equal(data.faqs.length, 32);
  const sections = faqPageSections(data);
  assert.deepEqual(sections.map((s) => [s.id, s.faqs.length]), [['a', 6], ['b', 5], ['c', 5], ['d', 4], ['e', 4], ['f', 2]]);
  assert.deepEqual(homeFaqs(data).map((f) => f.question), [
    'Who can contact Oakdene?',
    'Do I need a formal referral?',
    'Is there a cost for services?',
    'Can Oakdene help me find another service?',
  ]);
  const links = data.faqs.flatMap((f) => [...f.answerHtml.matchAll(/<a href="([^"]+)">/g)].map((m) => m[1]));
  assert.equal(links.length, 11);
});

test('loadFaqs rejects unknown fields and unknown sections, naming the file', () => {
  const base = 'sections:\n  - id: a\n    heading: A\nfaqs:\n  - question: Q\n    answer: A\n    section: a\n    showOnFaqPage: true\n    showOnHome: false\n    order: 1\n';
  assert.equal(loadFaqs(base).faqs[0].answerHtml, 'A');
  assert.throws(() => loadFaqs(base + '    colour: red\n'), /^Error: src\/content\/faqs\.yaml: faqs\[0\] \("Q"\): unknown field/);
  assert.throws(() => loadFaqs(base.replace('section: a', 'section: z')), /section "z" is not one of the listed sections/);
  assert.throws(() => loadFaqs(base.replace('answer: A', 'answer: "# A"')), /faqs\.yaml faqs\[0\] \("Q"\) answer: headings/);
});

// protects: scoped page CSS keeps matching injected links. fails_when: an element made by the renderer lacks the
// calling page's data-astro-cid attribute, or a made-up attribute is accepted.
test('scopeAttributes are added to every element, after its own attributes', () => {
  const opts = { scopeAttributes: ['data-astro-cid-abc123'] };
  assert.equal(
    renderProse('a **b** *c* [d](/e){new}\nf', 'x', opts),
    'a <strong data-astro-cid-abc123>b</strong> <em data-astro-cid-abc123>c</em> ' +
      '<a href="/e" target="_blank" rel="noopener noreferrer" data-astro-cid-abc123>d</a><br data-astro-cid-abc123>f',
  );
  assert.throws(() => renderProse('x', 'x', { scopeAttributes: ['onclick'] }), /not an Astro scope attribute/);
});
