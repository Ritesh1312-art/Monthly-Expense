/* ============================================================
   PaisaGuru Mail Client — Zero-dependency Gmail SMTP
   ------------------------------------------------------------
   Pure Node.js (node:tls) — koi npm dependency nahi.
   Direct TLS/SSL on smtp.gmail.com:465 with AUTH LOGIN.
   ============================================================ */

import tls from 'node:tls';

export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const s = email.trim();
  if (s.length < 5 || s.length > 254) return false;
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(s);
}

export function maskEmail(email) {
  if (!email || typeof email !== 'string') return '';
  const parts = email.trim().split('@');
  if (parts.length !== 2) return email;
  const [name, domain] = parts;
  const visible = name.slice(0, Math.min(2, name.length));
  return visible + '***@' + domain;
}

export function mailOn() {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

let transportOverride = null;
export function _setTransport(fn) {
  transportOverride = fn;
}

/**
 * Pure TLS SMTP sender for Gmail
 */
export async function sendMail({ to, subject, html, text }) {
  if (transportOverride) {
    return transportOverride({ to, subject, html, text });
  }

  const user = process.env.GMAIL_USER;
  const pass = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');

  if (!user || !pass) {
    return { ok: false, error: 'mail_disabled', disabled: true };
  }

  return new Promise((resolve) => {
    let socket;
    try {
      socket = tls.connect({
        host: 'smtp.gmail.com',
        port: 465,
        timeout: 10000
      });
    } catch (e) {
      return resolve({ ok: false, error: e.message });
    }

    let buffer = '';
    let step = 0;
    let resolved = false;

    function finish(res) {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeoutTimer);
      try { socket.removeAllListeners(); socket.destroy(); } catch (e) {}
      resolve(res);
    }

    const timeoutTimer = setTimeout(() => {
      finish({ ok: false, error: 'smtp_timeout' });
    }, 15000);

    function sendLine(line) {
      try {
        socket.write(line + '\r\n');
      } catch (e) {
        finish({ ok: false, error: e.message });
      }
    }

    socket.setEncoding('utf8');

    socket.on('data', (chunk) => {
      buffer += chunk;
      // An SMTP reply ends when a line begins with 3 digits followed by a space
      const match = /(?:^|\r?\n)(\d{3})(?: (.*))?$/.exec(buffer.trimEnd());
      if (!match) return; // wait for more data

      const code = parseInt(match[1], 10);
      const fullResponse = buffer;
      buffer = '';

      if (step === 0) {
        if (code !== 220) return finish({ ok: false, error: 'bad_greeting', code, response: fullResponse });
        step = 1;
        sendLine('EHLO localhost');
      } else if (step === 1) {
        if (code !== 250) return finish({ ok: false, error: 'ehlo_failed', code });
        step = 2;
        sendLine('AUTH LOGIN');
      } else if (step === 2) {
        if (code !== 334) return finish({ ok: false, error: 'auth_init_failed', code });
        step = 3;
        sendLine(Buffer.from(user).toString('base64'));
      } else if (step === 3) {
        if (code !== 334) return finish({ ok: false, error: 'auth_user_failed', code });
        step = 4;
        sendLine(Buffer.from(pass).toString('base64'));
      } else if (step === 4) {
        if (code !== 235) return finish({ ok: false, error: 'auth_failed', code });
        step = 5;
        sendLine(`MAIL FROM:<${user}>`);
      } else if (step === 5) {
        if (code !== 250) return finish({ ok: false, error: 'mail_from_failed', code });
        step = 6;
        sendLine(`RCPT TO:<${to}>`);
      } else if (step === 6) {
        if (code !== 250) return finish({ ok: false, error: 'rcpt_to_failed', code });
        step = 7;
        sendLine('DATA');
      } else if (step === 7) {
        if (code !== 354) return finish({ ok: false, error: 'data_failed', code });
        step = 8;
        const bodyContent = html || text || '';
        const isHtml = Boolean(html);
        const headers = [
          `From: "PaisaGuru" <${user}>`,
          `To: <${to}>`,
          `Subject: ${subject || 'PaisaGuru OTP'}`,
          `MIME-Version: 1.0`,
          `Content-Type: ${isHtml ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8'}`
        ].join('\r\n');
        
        const safeBody = bodyContent.replace(/^\./gm, '..');
        sendLine(`${headers}\r\n\r\n${safeBody}\r\n.`);
      } else if (step === 8) {
        if (code !== 250) return finish({ ok: false, error: 'send_failed', code });
        step = 9;
        sendLine('QUIT');
        finish({ ok: true });
      }
    });

    socket.on('error', (err) => {
      finish({ ok: false, error: err.message });
    });

    socket.on('close', () => {
      finish({ ok: step >= 8 });
    });
  });
}

export async function sendOtpMail({ to, otp, minutes = 10, userName = '' }) {
  const subject = `PaisaGuru: ${otp} hai aapka Password Reset OTP`;
  const nameGreeting = userName ? `Namaste <b>${userName}</b>,` : 'Namaste,';
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>PaisaGuru Password Reset OTP</title></head>
<body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f4f7f6;padding:24px;color:#12211d;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px;border:1px solid #e2e8e6;">
    <h2 style="color:#0b6b5a;margin-top:0;">💰 PaisaGuru</h2>
    <p style="font-size:15px;line-height:1.5;">${nameGreeting}</p>
    <p style="font-size:15px;line-height:1.5;">Aapke PaisaGuru account ka password reset karne ke liye ye OTP istemal karein:</p>
    <div style="background:#f2fbf8;border:2px dashed #0b6b5a;border-radius:10px;padding:16px;text-align:center;margin:20px 0;">
      <span style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#0b6b5a;">${otp}</span>
    </div>
    <p style="font-size:13px;color:#66807a;line-height:1.5;">
      ⏳ Ye OTP <b>${minutes} minute</b> tak valid hai aur sirf ek baar use ho sakta hai.<br>
      ⚠️ Agar aapne password reset ki request nahi ki thi, to is email ko ignore karein. Aapka password surakshit hai.
    </p>
    <hr style="border:0;border-top:1px solid #e2e8e6;margin:20px 0;">
    <div style="font-size:12px;color:#93a4b3;text-align:center;">PaisaGuru — Aapka Personal Expense &amp; Investment Manager</div>
  </div>
</body>
</html>`;

  return sendMail({
    to,
    subject,
    html,
    text: `PaisaGuru Password Reset OTP: ${otp}. Ye OTP ${minutes} minute tak valid hai.`
  });
}
