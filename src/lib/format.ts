import { Marked } from 'marked';

// Turns short text written in the content editor into safe HTML.
// Editors type plain text; these become links automatically:
//   [link text](/page/ or https://...)  a link
//   name@example.org.au                 an email link
//   (02) 8717 0999, 0415 156 100, 13 11 14, 1800 858 858   a phone link
// Everything else is escaped, so stray < or & can't break the page.

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

const PHONE = /(\(0\d\) ?\d{4} ?\d{4}|\b0\d{3} ?\d{3} ?\d{3}\b|\b1[38]00 ?\d{3} ?\d{3}\b|\b13 ?\d{2} ?\d{2}\b)/g;
const EMAIL = /\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g;
const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;

function linkAttrs(href: string): string {
  return /^https?:\/\//.test(href) ? ' target="_blank" rel="noopener noreferrer"' : '';
}

function autolink(text: string): string {
  return text
    .replace(EMAIL, '<a href="mailto:$1">$1</a>')
    .replace(PHONE, (m) => `<a href="tel:${m.replace(/\D/g, '')}">${m}</a>`);
}

/** One line of editor text to HTML (no paragraphs). */
export function inline(text: string = ''): string {
  // Split out [text](url) links first so their contents aren't auto-linked twice.
  let out = '';
  let last = 0;
  for (const match of text.matchAll(LINK)) {
    out += autolink(escapeHtml(text.slice(last, match.index)));
    const href = match[2];
    const safeHref = /^(https?:\/\/|\/|mailto:|tel:|#)/.test(href) ? href : '#';
    out += `<a href="${escapeHtml(safeHref)}"${linkAttrs(safeHref)}>${escapeHtml(match[1])}</a>`;
    last = (match.index ?? 0) + match[0].length;
  }
  return out + autolink(escapeHtml(text.slice(last)));
}

// Longer editor text (paragraphs, lists, bold, links) written in Markdown.
// Links to other websites open in a new tab, as everywhere else on the site.

const marked = new Marked({
  gfm: true,
  renderer: {
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
      return `<a href="${escapeHtml(href)}"${titleAttr}${linkAttrs(href)}>${text}</a>`;
    },
  },
});

/** Markdown from the editor to HTML (paragraphs, lists, links). */
export function markdown(text: string = ''): string {
  return marked.parse(text, { async: false }) as string;
}

/** Markdown inside a single line or element (bold, italics, links), no paragraphs. */
export function inlineMarkdown(text: string = ''): string {
  return marked.parseInline(text, { async: false }) as string;
}
