export async function onRequestPost(context) {
  const { request, env } = context;

  // Parse request body
  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { success: false, error: 'Invalid request body.' });
  }

  const {
    first_name = '',
    last_name  = '',
    email      = '',
    phone      = '',
    reason     = '',
    message    = '',
    website    = '',
  } = body;

  // Honeypot: non-empty website field = bot — fake success, no email sent
  if (website) {
    return json(200, { success: true });
  }

  // Required field validation
  if (!str(first_name) || !str(last_name) || !str(email) || !str(reason) || !str(message)) {
    return json(400, { success: false, error: 'Missing required fields.' });
  }

  // Basic email format sanity check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return json(400, { success: false, error: 'Invalid email address.' });
  }

  const timestamp  = new Date().toISOString();
  const ua         = (request.headers.get('user-agent') || 'Unknown').slice(0, 200);
  const phoneDisplay = phone.trim() || 'Not provided';

  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<body style="font-family:sans-serif;color:#333;max-width:600px;margin:0 auto;padding:24px;">
  <h2 style="color:#003E51;margin-bottom:20px;">New enquiry from the Oakdene website</h2>
  <p><strong>Name:</strong> ${esc(first_name)} ${esc(last_name)}</p>
  <p><strong>Email:</strong> ${esc(email)}</p>
  <p><strong>Phone:</strong> ${esc(phoneDisplay)}</p>
  <p><strong>Reason:</strong> ${esc(reason)}</p>
  <p style="margin-bottom:8px;"><strong>Message:</strong></p>
  <p style="white-space:pre-wrap;background:#f5f5f5;padding:16px;border-radius:6px;line-height:1.6;">${esc(message)}</p>
  <hr style="border:none;border-top:1px solid #ddd;margin:24px 0;">
  <p style="color:#666;font-size:13px;line-height:1.6;">
    Submitted at: ${timestamp}<br>
    User agent: ${esc(ua)}
  </p>
</body>
</html>`;

  const textBody = `New enquiry from the Oakdene website

Name: ${first_name.trim()} ${last_name.trim()}
Email: ${email.trim()}
Phone: ${phoneDisplay}
Reason: ${reason.trim()}

Message:
${message.trim()}

---
Submitted at: ${timestamp}
User agent: ${ua}`;

  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from:     env.CONTACT_EMAIL_FROM,
        to:       env.CONTACT_EMAIL_TO,
        reply_to: email.trim(),
        subject:  `New contact form submission: ${reason.trim()}`,
        html:     htmlBody,
        text:     textBody,
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text();
      console.error(`Resend API error ${resendRes.status}:`, errBody);
      return json(500, { success: false, error: 'Failed to send email.' });
    }

    return json(200, { success: true });

  } catch (err) {
    console.error('Resend fetch error:', err);
    return json(500, { success: false, error: 'Failed to send email.' });
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function str(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
