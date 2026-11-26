// GET /api/callback: finishes website-editor sign-in (Decap CMS at /admin). Stage W7, issue #15.
//
// GitHub redirects the sign-in pop-up here with `code` and `state`. This function:
//   1. checks `state` against the cookie set by /api/auth (400, and no token, if it is missing or different);
//   2. exchanges `code` for a token using GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET;
//   3. refuses a token that carries any scope other than `public_repo`;
//   4. returns a page that hands the token to the /admin window that opened the pop-up, using Decap's message
//      format and postMessage targeted at this site's own origin only, so no other site can receive it.
//
// Decap's handshake: the pop-up posts "authorizing:github" to the opener, the opener echoes it back, then the pop-up
// posts "authorization:github:success:{json}" (or ":error:") to the opener.

const STATE_COOKIE = '__Host-oakdene_cms_state';
const ALLOWED_SCOPES = new Set(['public_repo']);
const TOKEN_URL = 'https://github.com/login/oauth/access_token';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const origin = url.origin;
  const params = url.searchParams;

  const expected = readCookie(request.headers.get('Cookie'), STATE_COOKIE);
  const given = params.get('state');
  if (!expected || !given || !sameString(expected, given)) {
    return page(400, origin, { error: 'Sign-in could not be verified (state mismatch). Close this window and try again.' });
  }

  if (params.get('error')) {
    return page(400, origin, { error: `GitHub did not sign you in: ${params.get('error_description') || params.get('error')}` });
  }

  const code = params.get('code');
  if (!code) {
    return page(400, origin, { error: 'GitHub did not return a sign-in code. Close this window and try again.' });
  }

  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return page(500, origin, { error: 'Editor sign-in is not set up yet: the GitHub client ID or secret is missing.' });
  }

  let result;
  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'oakdene-website-editor' },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${origin}/api/callback`,
      }),
    });
    result = res.ok ? await res.json() : { error: `HTTP ${res.status}` };
  } catch {
    result = { error: 'network error' };
  }

  if (!result || result.error || typeof result.access_token !== 'string' || !result.access_token) {
    const reason = result?.error_description || result?.error || 'no token returned';
    return page(502, origin, { error: `GitHub sign-in failed: ${reason}` });
  }

  const scopes = String(result.scope ?? '')
    .split(/[\s,]+/)
    .filter(Boolean);
  const extra = scopes.filter((s) => !ALLOWED_SCOPES.has(s));
  if (extra.length) {
    return page(403, origin, {
      error: `Sign-in refused: the GitHub token has more access than the editor allows (${extra.join(', ')}). Revoke the app's access in GitHub settings and sign in again.`,
    });
  }

  return page(200, origin, { token: result.access_token });
}

/**
 * The pop-up page. Posts Decap's success or error message to the opener at `origin` only.
 * The script carries a per-response nonce; nothing else may run on the page.
 */
function page(status, origin, { token, error }) {
  const message = token
    ? `authorization:github:success:${JSON.stringify({ token, provider: 'github' })}`
    : `authorization:github:error:${JSON.stringify({ message: error })}`;
  const nonce = randomHex(16);
  // JSON with "<" escaped cannot close the <script> element early.
  const js = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
  const heading = token ? 'Signed in' : 'Sign-in failed';
  const note = token ? 'You can close this window if it does not close itself.' : escapeHtml(error);

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>${heading}</title></head>
<body><h1>${heading}</h1><p>${note}</p>
<script nonce="${nonce}">
(function () {
  var origin = ${js(origin)};
  var message = ${js(message)};
  if (!window.opener) return;
  function receive(e) {
    if (e.origin !== origin || e.source !== window.opener) return;
    window.removeEventListener('message', receive);
    window.opener.postMessage(message, origin);
  }
  window.addEventListener('message', receive);
  window.opener.postMessage('authorizing:github', origin);
})();
</script></body></html>`;

  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
      // Clear the one-time state cookie whatever happened.
      'Set-Cookie': `${STATE_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex',
    },
  });
}

function readCookie(header, name) {
  if (!header) return null;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i !== -1 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

function sameString(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function randomHex(n) {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
