// Starts GitHub sign-in for the content editor (Decap CMS at /admin/).
// Decap opens this in a pop-up; we send the person to GitHub, which returns
// them to /api/callback.
//
// Required env vars (Cloudflare Pages project > Settings > Variables and secrets):
//   GITHUB_CLIENT_ID      — Client ID of the GitHub OAuth app for this site
//   GITHUB_CLIENT_SECRET  — Client secret of that app (secret; used in callback.js)
//
// The OAuth app's callback URL must be https://<this site>/api/callback.

export async function onRequestGet({ request, env }) {
  if (!env.GITHUB_CLIENT_ID) {
    return new Response('Sign-in is not set up yet: GITHUB_CLIENT_ID is missing.', { status: 500 });
  }

  const origin = new URL(request.url).origin;
  const state = crypto.randomUUID();

  const authorize = new URL('https://github.com/login/oauth/authorize');
  authorize.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  authorize.searchParams.set('redirect_uri', `${origin}/api/callback`);
  // public_repo is enough: the site repositories are public.
  authorize.searchParams.set('scope', 'public_repo');
  authorize.searchParams.set('state', state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorize.toString(),
      // Checked in callback.js so the sign-in can't be started by another site.
      'Set-Cookie': `cms_oauth_state=${state}; Path=/api/; Max-Age=600; HttpOnly; Secure; SameSite=Lax`,
      'Cache-Control': 'no-store',
    },
  });
}
