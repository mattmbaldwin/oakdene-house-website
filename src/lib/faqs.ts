// Loads src/content/faqs.yaml: the one list of questions for the FAQ page and the home page (stage W6, #14).
// Pages import the file with `?raw` and pass the text here, so this module stays plain and testable.
import yaml from 'js-yaml';
import { renderProse } from './prose.ts';

export const FAQS_FILE = 'src/content/faqs.yaml';

export interface FaqSection {
  id: string;
  heading: string;
}

export interface Faq {
  question: string;
  answer: string;
  answerHtml: string;
  section: string;
  showOnFaqPage: boolean;
  showOnHome: boolean;
  order: number;
}

export interface FaqData {
  sections: FaqSection[];
  faqs: Faq[];
}

const FAQ_KEYS = ['question', 'answer', 'section', 'showOnFaqPage', 'showOnHome', 'order'];

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Parse and check the FAQ file. Throws, naming the file and entry, on any missing, extra or wrong field. */
export function loadFaqs(text: string, file = FAQS_FILE): FaqData {
  const fail = (message: string): never => {
    throw new Error(`${file}: ${message}`);
  };
  const doc: unknown = yaml.load(text);
  if (!isObject(doc)) fail('expected a mapping with "sections" and "faqs"');
  const root = doc as Record<string, unknown>;
  const extraRoot = Object.keys(root).filter((k) => k !== 'sections' && k !== 'faqs');
  if (extraRoot.length) fail(`unknown top-level field(s): ${extraRoot.join(', ')}`);
  if (!Array.isArray(root.sections)) fail('"sections" must be a list');
  if (!Array.isArray(root.faqs)) fail('"faqs" must be a list');

  const sections = (root.sections as unknown[]).map((s, i): FaqSection => {
    if (!isObject(s) || typeof s.id !== 'string' || typeof s.heading !== 'string' || Object.keys(s).length !== 2) {
      return fail(`sections[${i}] must have exactly a text "id" and a text "heading"`);
    }
    if (!/^[a-z][a-z0-9-]*$/.test(s.id)) fail(`sections[${i}].id "${s.id}" must be lower-case letters, digits or hyphens`);
    return { id: s.id, heading: s.heading };
  });
  const sectionIds = new Set(sections.map((s) => s.id));
  if (sectionIds.size !== sections.length) fail('section ids must be unique');

  const faqs = (root.faqs as unknown[]).map((f, i): Faq => {
    if (!isObject(f)) return fail(`faqs[${i}] must be a mapping`);
    const where = `faqs[${i}]${typeof f.question === 'string' ? ` ("${f.question}")` : ''}`;
    const extra = Object.keys(f).filter((k) => !FAQ_KEYS.includes(k));
    if (extra.length) fail(`${where}: unknown field(s): ${extra.join(', ')}`);
    if (typeof f.question !== 'string' || f.question.trim() === '') fail(`${where}: "question" must be text`);
    if (typeof f.answer !== 'string' || f.answer.trim() === '') fail(`${where}: "answer" must be text`);
    if (typeof f.section !== 'string') fail(`${where}: "section" must be text`);
    if (typeof f.showOnFaqPage !== 'boolean') fail(`${where}: "showOnFaqPage" must be true or false`);
    if (typeof f.showOnHome !== 'boolean') fail(`${where}: "showOnHome" must be true or false`);
    if (typeof f.order !== 'number' || !Number.isInteger(f.order)) fail(`${where}: "order" must be a whole number`);
    if (f.showOnFaqPage && !sectionIds.has(f.section as string)) {
      fail(`${where}: section "${f.section}" is not one of the listed sections`);
    }
    return {
      question: f.question as string,
      answer: f.answer as string,
      answerHtml: renderProse(f.answer as string, `${file} ${where} answer`),
      section: f.section as string,
      showOnFaqPage: f.showOnFaqPage as boolean,
      showOnHome: f.showOnHome as boolean,
      order: f.order as number,
    };
  });

  return { sections, faqs };
}

const byOrder = (a: Faq, b: Faq): number => a.order - b.order;

/** FAQ-page sections in file order, each with its shown questions sorted by `order`. Empty sections are dropped. */
export function faqPageSections(data: FaqData): Array<FaqSection & { faqs: Faq[] }> {
  return data.sections
    .map((s) => ({ ...s, faqs: data.faqs.filter((f) => f.showOnFaqPage && f.section === s.id).sort(byOrder) }))
    .filter((s) => s.faqs.length > 0);
}

/** Questions shown on the home page, sorted by `order`. */
export function homeFaqs(data: FaqData): Faq[] {
  return data.faqs.filter((f) => f.showOnHome).sort(byOrder);
}
