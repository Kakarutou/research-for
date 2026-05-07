import nodemailer from 'nodemailer';

function getTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
}

export async function sendVerificationEmail(
  to: string,
  username: string,
  code: string
): Promise<boolean> {
  const transporter = getTransporter();

  if (!transporter) {
    console.log(`\n📧 [DEV] Email verification code → ${to} : ${code}\n`);
    return true;
  }

  try {
    await transporter.sendMail({
      from: `"Research For" <${process.env.GMAIL_USER}>`,
      to,
      subject: '[Research For] Email Verification Code',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;border:1px solid #e4e4e7;border-radius:16px;">
          <div style="font-size:22px;font-weight:700;color:#18181b;margin-bottom:8px;">Research For</div>
          <div style="font-size:14px;color:#71717a;margin-bottom:28px;">Stock · Crypto Intelligence</div>
          <div style="font-size:15px;color:#3f3f46;margin-bottom:24px;">
            Hello <strong>${username}</strong>,<br/>
            Enter the code below to complete your registration.
          </div>
          <div style="background:#f4f4f5;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
            <div style="font-family:monospace;font-size:36px;font-weight:700;color:#18181b;letter-spacing:12px;">${code}</div>
          </div>
          <div style="font-size:12px;color:#a1a1aa;">This code is valid for 10 minutes. If you did not request this, please ignore this email.</div>
        </div>
      `,
    });
    return true;
  } catch (e) {
    console.error('Mail send error:', e);
    return false;
  }
}
