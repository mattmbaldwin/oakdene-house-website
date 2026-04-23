// Stub endpoint — returns fake success for any POST.
// Replace with Resend integration in Phase 3 Task 1b.
export async function onRequestPost() {
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
