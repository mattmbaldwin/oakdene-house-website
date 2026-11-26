// The one prose renderer for editable website text (website-editor stage W6, issue #14).
//
// It accepts exactly what the Decap editor's markdown widget can produce once it is limited to bold, italic
// and link, and nothing else:
//
//   **bold**            -> <strong>bold</strong>
//   *italic*            -> <em>italic</em>
//   ***both***          -> <em><strong>both</strong></em>
//   [text](href)        -> <a href="href">text</a>
//   [text](href){new}   -> <a href="href" target="_blank" rel="noopener noreferrer">text</a>
//   a line break        -> <br>   (a plain newline, "\" + newline, or two trailing spaces + newline)
//   \* \_ \[ ...        -> the literal character (the editor escapes punctuation this way)
//
// Quotes are left exactly as typed: no smart quotes, no other typographic substitution, so moving text from a
// page template into a data file cannot change what the page shows.
//
// Scoped styles: HTML injected with set:html does not get Astro's data-astro-cid-* scope attribute, so a page's
// scoped CSS (for example `.faq-content-inner a`) would stop matching. Prose.astro passes the calling page's
// scope attribute in `scopeAttributes`, and every element made here carries it, exactly as if the markup had been
// written in the page itself.
//
// Anything else (headings, lists, quotes, code, images, raw HTML, entities, underscore emphasis, paragraph
// breaks, stray brackets or asterisks) throws, naming the source, so the build fails instead of the page
// silently showing stray markup.

const ESCAPABLE = '\\`*_{}[]()#+-.!<>|~';
const HREF = /^(?:https?:\/\/[^\s<>"]+|mailto:[^\s<>"]+|tel:\+?[0-9]+|\/[^\s<>"]*|#[^\s<>"]*)$/;

export class ProseError extends Error {
  constructor(source: string, message: string, md: string) {
    const shown = md.length > 80 ? `${md.slice(0, 77)}...` : md;
    super(`${source}: ${message} in ${JSON.stringify(shown)}`);
    this.name = 'ProseError';
  }
}

function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/**
 * Render editor prose to HTML. `source` names where the text came from (file and field) for error messages.
 * Throws ProseError on any Markdown outside the allowed set.
 */
export interface ProseOptions {
  /** Astro scope attributes (data-astro-cid-xxxx) to put on every element, after its other attributes. */
  scopeAttributes?: string[];
}

export function renderProse(md: string, source = 'prose', options: ProseOptions = {}): string {
  if (typeof md !== 'string') throw new ProseError(source, `expected text, got ${typeof md}`, String(md));
  const fail = (message: string): never => {
    throw new ProseError(source, message, md);
  };
  const scope = options.scopeAttributes ?? [];
  for (const a of scope) {
    if (!/^data-astro-cid-[a-z0-9]+$/.test(a)) fail(`"${a}" is not an Astro scope attribute`);
  }
  const ctx: Ctx = { fail, attrs: scope.map((a) => ` ${a}`).join('') };

  const text = md.replace(/\r\n?/g, '\n').trim();
  if (/\n[ \t]*\n/.test(text)) fail('paragraph breaks (blank lines) are not supported; use a single line break');

  const lines = text.split('\n');
  lines.forEach((line, n) => {
    const first = n === 0 ? line : line.replace(/^[ \t]+/, '');
    if (n > 0 && /^( {4,}|\t)/.test(line)) fail('indented code is not supported');
    if (/^#{1,6}(\s|$)/.test(first)) fail('headings are not supported');
    if (/^>/.test(first)) fail('block quotes are not supported');
    if (/^[-*+][ \t]/.test(first)) fail('lists are not supported');
    if (/^\d+[.)][ \t]/.test(first)) fail('numbered lists are not supported');
    if (/^([-*_])([ \t]*\1){2,}[ \t]*$/.test(first)) fail('horizontal rules are not supported');
    if (n > 0 && /^(=+|-+)[ \t]*$/.test(first)) fail('underlined headings are not supported');
  });

  return renderInline(text, ctx, false);
}

interface Ctx {
  fail: (message: string) => never;
  attrs: string;
}

/** Index of the next unescaped `marker` at or after `from` that is not part of a longer run of `*`. */
function findClose(s: string, from: number, marker: string): number {
  for (let i = from; i < s.length; i++) {
    if (s[i] === '\\') {
      i++;
      continue;
    }
    if (s.startsWith(marker, i)) {
      const before = s[i - 1];
      const after = s[i + marker.length];
      // `*` must not be half of `**`; `**` may be followed by `*` only when closing `***`.
      if (marker === '*' && (after === '*' || before === '*')) continue;
      if (marker === '**' && after === '*') continue;
      return i;
    }
  }
  return -1;
}

function checkSpan(inner: string, what: string, fail: (m: string) => never): void {
  if (inner.length === 0 || /^\s|\s$/.test(inner)) fail(`${what} must wrap text with no space inside the markers`);
}

function renderInline(s: string, ctx: Ctx, inLink: boolean): string {
  const { fail, attrs } = ctx;
  let out = '';
  let i = 0;
  while (i < s.length) {
    const c = s[i];

    if (c === '\\') {
      const next = s[i + 1];
      if (next === '\n') {
        out += `<br${attrs}>`;
        i += 2;
        continue;
      }
      if (next !== undefined && ESCAPABLE.includes(next)) {
        out += escapeText(next);
        i += 2;
        continue;
      }
      fail('a backslash must escape punctuation');
    }

    if (c === '\n') {
      out = out.replace(/ +$/, '');
      out += `<br${attrs}>`;
      i++;
      while (s[i] === ' ' || s[i] === '\t') i++;
      continue;
    }

    if (s.startsWith('***', i)) {
      const end = s.indexOf('***', i + 3);
      if (end < 0) fail('unclosed ***');
      const inner = s.slice(i + 3, end);
      checkSpan(inner, 'bold italic', fail);
      out += `<em${attrs}><strong${attrs}>${renderInline(inner, ctx, inLink)}</strong></em>`;
      i = end + 3;
      continue;
    }

    if (s.startsWith('**', i)) {
      const end = findClose(s, i + 2, '**');
      if (end < 0) fail('unclosed **');
      const inner = s.slice(i + 2, end);
      checkSpan(inner, 'bold', fail);
      out += `<strong${attrs}>${renderInline(inner, ctx, inLink)}</strong>`;
      i = end + 2;
      continue;
    }

    if (c === '*') {
      const end = findClose(s, i + 1, '*');
      if (end < 0) fail('unclosed *');
      const inner = s.slice(i + 1, end);
      checkSpan(inner, 'italic', fail);
      out += `<em${attrs}>${renderInline(inner, ctx, inLink)}</em>`;
      i = end + 1;
      continue;
    }

    if (c === '[') {
      if (inLink) fail('links cannot contain links');
      let close = -1;
      for (let j = i + 1; j < s.length; j++) {
        if (s[j] === '\\') {
          j++;
          continue;
        }
        if (s[j] === '[') fail('unescaped [ inside link text');
        if (s[j] === ']') {
          close = j;
          break;
        }
      }
      if (close < 0) fail('unmatched [ (write \\[ for a literal bracket)');
      if (s[close + 1] !== '(') fail('[text] must be followed by (address)');
      const hrefEnd = s.indexOf(')', close + 2);
      if (hrefEnd < 0) fail('unclosed link address');
      const label = s.slice(i + 1, close);
      const href = s.slice(close + 2, hrefEnd);
      if (label.trim().length === 0) fail('link text is empty');
      if (!HREF.test(href)) fail(`link address ${JSON.stringify(href)} is not allowed (use /path, #anchor, https://, mailto: or tel:)`);
      i = hrefEnd + 1;
      let extra = '';
      if (s[i] === '{') {
        if (!s.startsWith('{new}', i)) fail('the only link marker is {new}');
        extra = ' target="_blank" rel="noopener noreferrer"';
        i += 5;
      }
      out += `<a href="${escapeAttr(href)}"${extra}${attrs}>${renderInline(label, ctx, true)}</a>`;
      continue;
    }

    if (c === ']') fail('unmatched ] (write \\] for a literal bracket)');
    if (c === '`') fail('code is not supported');
    if (c === '!' && s[i + 1] === '[') fail('images are not supported');
    if (c === '~' && s[i + 1] === '~') fail('strikethrough is not supported');
    if (c === '<' && /[A-Za-z\/!?]/.test(s[i + 1] ?? '')) fail('HTML is not supported');
    if (c === '&' && /^&(#[0-9]+|#x[0-9a-fA-F]+|[A-Za-z][A-Za-z0-9]*);/.test(s.slice(i))) {
      fail('HTML entities are not supported; type the character itself');
    }
    if (c === '_') {
      const before = s[i - 1] ?? '';
      const after = s[i + 1] ?? '';
      if (!/[A-Za-z0-9]/.test(before) && after !== '' && !/\s/.test(after)) {
        fail('underscore emphasis is not supported; use *italic* or write \\_ for a literal underscore');
      }
    }

    out += escapeText(c);
    i++;
  }
  return out;
}
