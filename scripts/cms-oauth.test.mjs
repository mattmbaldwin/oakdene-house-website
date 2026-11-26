// Website-editor sign-in functions (stage W7, issue #15): functions/api/auth.js and functions/api/callback.js.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet as auth } from '../functions/api/auth.js';
import { onRequestGet as callback } from '../functions/api/callback.js';

const ORIGIN = 'https://oakdenehouse.org.au';
const ENV = { GITHUB_CLIENT_ID: 'client-id', GITHUB_CLIENT_SECRET: 'client-secret' };
const STATE = 'a'.repeat(64);
const COOKIE = `__Host-oakdene_cms_state=${STATE}`;
const TOKEN = 'gho_exampletoken123';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** Replace fetch with a fake GitHub token endpoint; records every call. */
function fakeGitHub(body, status = 200) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  };
  return calls;
}

function callbackRequest(query, cookie = COOKIE) {
  const headers = cookie ? { Cookie: cookie } : {};
  return new Request(`${ORIGIN}/api/callback?${new URLSearchParams(query)}`, { headers });
}

test('auth: redirects to GitHub for public_repo only, with state in a locked-down cookie', async () => {
  // Decap passes its configured scope; a caller asking for more still gets public_repo only.
  const res = await auth({ request: new Request(`${ORIGIN}/api/auth?provider=github&scope=repo`), env: ENV });
  assert.equal(res.status, 302);
  const loc = new URL(res.headers.get('Location'));
  assert.equal(loc.origin + loc.pathname, 'https://github.com/login/oauth/authorize');
  assert.equal(loc.searchParams.get('scope'), 'public_repo');
  assert.equal(loc.searchParams.get('client_id'), 'client-id');
  assert.equal(loc.searchParams.get('redirect_uri'), `${ORIGIN}/api/callback`);
  const state = loc.searchParams.get('state');
  assert.match(state, /^[0-9a-f]{64}$/);
  const cookie = res.headers.get('Set-Cookie');
  assert.ok(cookie.startsWith(`__Host-oakdene_cms_state=${state};`), cookie);
  for (const attr of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/']) assert.ok(cookie.includes(attr), `${attr} in ${cookie}`);
});

test('auth: each sign-in gets a fresh state', async () => {
  const one = await auth({ request: new Request(`${ORIGIN}/api/auth`), env: ENV });
  const two = await auth({ request: new Request(`${ORIGIN}/api/auth`), env: ENV });
  assert.notEqual(new URL(one.headers.get('Location')).searchParams.get('state'), new URL(two.headers.get('Location')).searchParams.get('state'));
});

test('auth: 500 and no redirect when the client ID is not configured', async () => {
  const res = await auth({ request: new Request(`${ORIGIN}/api/auth`), env: {} });
  assert.equal(res.status, 500);
  assert.equal(res.headers.get('Location'), null);
});

test('callback: state mismatch returns 400, never calls GitHub, never posts a token', async () => {
  const calls = fakeGitHub({ access_token: TOKEN, scope: 'public_repo' });
  for (const [query, cookie] of [
    [{ code: 'c', state: 'b'.repeat(64) }, COOKIE], // different state
    [{ code: 'c', state: STATE }, null], // no cookie
    [{ code: 'c' }, COOKIE], // no state in the URL
  ]) {
    const res = await callback({ request: callbackRequest(query, cookie), env: ENV });
    const html = await res.text();
    assert.equal(res.status, 400);
    assert.ok(!html.includes(TOKEN));
    assert.ok(!html.includes('authorization:github:success'));
    assert.ok(html.includes('authorization:github:error'));
  }
  assert.equal(calls.length, 0);
});

test('callback: missing code returns 400 and never calls GitHub', async () => {
  const calls = fakeGitHub({ access_token: TOKEN, scope: 'public_repo' });
  const res = await callback({ request: callbackRequest({ state: STATE }), env: ENV });
  assert.equal(res.status, 400);
  assert.ok(!(await res.text()).includes('authorization:github:success'));
  assert.equal(calls.length, 0);
});

test('callback: success exchanges the code and posts the token to the site origin only', async () => {
  const calls = fakeGitHub({ access_token: TOKEN, token_type: 'bearer', scope: 'public_repo' });
  const res = await callback({ request: callbackRequest({ code: 'the-code', state: STATE }), env: ENV });
  assert.equal(res.status, 200);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://github.com/login/oauth/access_token');
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    client_id: 'client-id',
    client_secret: 'client-secret',
    code: 'the-code',
    redirect_uri: `${ORIGIN}/api/callback`,
  });

  const html = await res.text();
  const expectedMessage = `authorization:github:success:${JSON.stringify({ token: TOKEN, provider: 'github' })}`;
  assert.ok(html.includes(`var message = ${JSON.stringify(expectedMessage)};`), 'Decap success message');
  assert.ok(html.includes(`var origin = ${JSON.stringify(ORIGIN)};`));
  // Every postMessage call targets the fixed origin variable, never "*" or the sender's origin.
  const targets = [...html.matchAll(/postMessage\([^,]+,\s*([^)]+)\)/g)].map((m) => m[1].trim());
  assert.deepEqual(targets, ['origin', 'origin']);
  assert.ok(!html.includes("'*'") && !html.includes('"*"'));
  // The token is only handed over after a message from the opener at that origin.
  assert.match(html, /e\.origin !== origin/);
  assert.ok(!html.includes('client-secret'));

  const nonce = html.match(/<script nonce="([0-9a-f]+)">/)[1];
  assert.equal(res.headers.get('Content-Security-Policy').includes(`script-src 'nonce-${nonce}'`), true);
  assert.equal(res.headers.get('Cache-Control'), 'no-store');
  assert.match(res.headers.get('Set-Cookie'), /Max-Age=0/);
});

test('callback: a token with more than public_repo is refused', async () => {
  fakeGitHub({ access_token: TOKEN, scope: 'public_repo,repo' });
  const res = await callback({ request: callbackRequest({ code: 'c', state: STATE }), env: ENV });
  assert.equal(res.status, 403);
  assert.ok(!(await res.text()).includes(TOKEN));
});

test('callback: a GitHub error is reported without a token', async () => {
  fakeGitHub({ error: 'bad_verification_code', error_description: 'The code passed is incorrect or expired.' });
  const res = await callback({ request: callbackRequest({ code: 'c', state: STATE }), env: ENV });
  assert.equal(res.status, 502);
  const html = await res.text();
  assert.ok(html.includes('authorization:github:error'));
  assert.ok(!html.includes('authorization:github:success'));
});

test('callback: a "</script>" in GitHub\'s error text cannot break out of the page script', async () => {
  fakeGitHub({ error: 'x', error_description: '</script><script>alert(1)</script>' });
  const res = await callback({ request: callbackRequest({ code: 'c', state: STATE }), env: ENV });
  const html = await res.text();
  assert.equal(html.split('</script>').length, 2, 'exactly one closing script tag');
});
