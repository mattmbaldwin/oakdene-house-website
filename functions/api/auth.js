// GET /api/auth: starts website-editor sign-in (Decap CMS at /admin). Stage W7, issue #15.
//
// Decap opens this in a pop-up. It redirects to GitHub's OAuth consent screen for Simon's GitHub OAuth app, asking
// for the `public_repo` scope only, whatever the caller asks for: the token must not reach private repositories.
// A random `state` value goes into a short-lived cookie and into the GitHub URL; /api/callback checks they match.
//
// Required env vars (Cloudflare Pages > Settings > Variables and secrets):
//   GITHUB_CLIENT_ID      — the OAuth app's client ID (text)
//   GITHUB_CLIENT_SECRET  — the OAuth app's client secret (secret; read by /api/callback)
// The OAuth app's callback URL is https://oakdenehouse.org.au/api/callback. GitHub only accepts that host, so
// sign-in works on the live site, not on *.pages.dev previews.

const STATE_COOKIE = '__Host-oakdene_cms_state';
const SCOPE = 'public_repo';
const STATE_MAX_AGE = 600; // seconds: the pop-up has ten minutes to come back

export async function onRequestGet({ request, env }) {
  if (!env.GITHUB_CLIENT_ID) {
    return plain(500, 'Editor sign-in is not set up yet: GITHUB_CLIENT_ID is missing in the Cloudflare Pages settings.');
  }

  const origin = new URL(request.url).origin;
  const state = randomState();

  const authorize = new URL('https://github.com/login/oauth/authorize');
  authorize.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  authorize.searchParams.set('redirect_uri', `${origin}/api/callback`);
  authorize.searchParams.set('scope', SCOPE);
  authorize.searchParams.set('state', state);
  authorize.searchParams.set('allow_signup', 'false');

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorize.toString(),
      'Set-Cookie': `${STATE_COOKIE}=${state}; Path=/; Max-Age=${STATE_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`,
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex',
    },
  });
}

/** 32 random bytes, hex encoded. */
function randomState() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function plain(status, message) {
  return new Response(message, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  });
}
