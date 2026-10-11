// Finishes GitHub sign-in for the content editor. GitHub sends the person
// back here with a code; we swap it for an access token and hand the token
// to the Decap CMS window that opened the pop-up. See auth.js for env vars.

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieState = (request.headers.get('Cookie') || '').match(/(?:^|;\s*)cms_oauth_state=([^;]+)/)?.[1];

  if (!code || !state || !cookieState || state !== cookieState) {
    return page(origin, 'error', { message: 'Sign-in expired or was started from another site. Close this window and try again.' });
  }
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return page(origin, 'error', { message: 'Sign-in is not set up yet: the GitHub app settings are missing.' });
  }

  let result;
  try {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'oakdene-cms' },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${origin}/api/callback`,
      }),
    });
    result = await response.json();
  } catch {
    return page(origin, 'error', { message: 'Could not reach GitHub. Close this window and try again.' });
  }

  if (!result.access_token) {
    console.error('GitHub token exchange failed:', result.error);
    return page(origin, 'error', { message: 'GitHub did not accept the sign-in. Close this window and try again.' });
  }

  return page(origin, 'success', { token: result.access_token, provider: 'github' });
}

// The pop-up tells the CMS window it is ready, then sends the result only to
// a window on this same site.
function page(origin, status, content) {
  const message = `authorization:github:${status}:${JSON.stringify(content)}`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Signing in</title></head>
<body><p>${status === 'success' ? 'Signed in. This window will close.' : escapeHtml(content.message)}</p>
<script>
  (function () {
    var origin = ${JSON.stringify(origin)};
    var message = ${JSON.stringify(message)};
    function receive(e) {
      if (e.origin !== origin) return;
      window.opener.postMessage(message, origin);
      window.removeEventListener('message', receive);
      ${status === 'success' ? 'setTimeout(function () { window.close(); }, 500);' : ''}
    }
    window.addEventListener('message', receive);
    if (window.opener) window.opener.postMessage('authorizing:github', origin);
  })();
</script></body></html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      // Clear the one-time state cookie.
      'Set-Cookie': 'cms_oauth_state=; Path=/api/; Max-Age=0; HttpOnly; Secure; SameSite=Lax',
    },
  });
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
