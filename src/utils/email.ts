import "dotenv/config";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

const brevoApiKey = process.env.BREVO_API_KEY?.trim();
const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim();
const senderName = process.env.BREVO_SENDER_NAME?.trim() || "FaithConnect";

if (!brevoApiKey) {
  console.error("[BREVO] Missing BREVO_API_KEY environment variable.");
}

if (!senderEmail) {
  console.error("[BREVO] Missing BREVO_SENDER_EMAIL environment variable.");
}

// Escape HTML to prevent HTML injection in email content.
const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };

    return entities[character];
  });

interface EmailParams {
  to: string;
  name?: string;
  otp: string;
}

interface BrevoResponse {
  message?: string;
  code?: string;
  messageId?: string;
}

// Shared Brevo email sender.
const sendBrevoEmail = async ({
  to,
  subject,
  htmlContent,
  emailType,
}: {
  to: string;
  subject: string;
  htmlContent: string;
  emailType: string;
}) => {
  if (!brevoApiKey) {
    throw new Error("Brevo API key is not configured.");
  }

  if (!senderEmail) {
    throw new Error("Brevo sender email is not configured.");
  }

  if (!to?.trim()) {
    throw new Error("Recipient email address is required.");
  }

  try {
    console.log(`[BREVO] Sending ${emailType} email...`);
    console.log("[BREVO] Recipient:", to.trim());
    console.log("[BREVO] Sender:", senderEmail);

    const response = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": brevoApiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: senderName,
          email: senderEmail,
        },
        to: [
          {
            email: to.trim(),
          },
        ],
        subject,
        htmlContent,
      }),
    });

    const result = (await response.json()) as BrevoResponse;

    if (!response.ok) {
      console.error(`[BREVO] ${emailType} email request failed:`, {
        status: response.status,
        message: result.message,
        code: result.code,
      });

      throw new Error(result.message || `Failed to send ${emailType} email.`);
    }

    console.log(`[BREVO] ${emailType} email accepted successfully.`);
    console.log("[BREVO] Message ID:", result.messageId);

    return result;
  } catch (error) {
    console.error(`[BREVO] ${emailType.toUpperCase()} EMAIL ERROR:`, error);
    throw error;
  }
};

// ============================================
// SIGNUP OTP EMAIL
// ============================================

export const sendSignupOTPEmail = async ({ to, name, otp }: EmailParams) => {
  if (!otp?.trim()) {
    throw new Error("Signup OTP is required.");
  }

  const safeName = escapeHtml(name?.trim() || "there");
  const safeOTP = escapeHtml(otp.trim());

  const htmlContent = `
    <div style="
      font-family: Arial, sans-serif;
      max-width: 500px;
      margin: auto;
      padding: 30px;
      background: #130B25;
      color: #ffffff;
      border-radius: 12px;
    ">
      <h2 style="color: #FF4F9A;">
        Welcome to FaithConnect!
      </h2>

      <p>Hello ${safeName},</p>

      <p>
        Thank you for creating your FaithConnect account.
        We're excited to have you join our community.
      </p>

      <p>
        To complete your registration, enter the verification
        code below in your app:
      </p>

      <div style="
        background: #251638;
        padding: 20px;
        text-align: center;
        border-radius: 10px;
        margin: 25px 0;
      ">
        <h1 style="
          color: #FF4F9A;
          letter-spacing: 10px;
          font-size: 32px;
        ">
          ${safeOTP}
        </h1>
      </div>

      <p>
        <strong>This verification code expires in 5 minutes.</strong>
      </p>

      <p>
        If you did not create a FaithConnect account,
        you can safely ignore this email.
      </p>

      <p style="color: #aaa;">
        FaithConnect · Faith. Love. Purpose.
      </p>
    </div>
  `;

  return sendBrevoEmail({
    to,
    subject: "Verify Your FaithConnect Account",
    htmlContent,
    emailType: "signup verification",
  });
};

// ============================================
// PASSWORD RESET OTP EMAIL
// ============================================

export const sendPasswordResetOTPEmail = async ({
  to,
  name,
  otp,
}: EmailParams) => {
  if (!otp?.trim()) {
    throw new Error("Password reset OTP is required.");
  }

  const safeName = escapeHtml(name?.trim() || "there");
  const safeOTP = escapeHtml(otp.trim());

  const htmlContent = `
    <div style="
      font-family: Arial, sans-serif;
      max-width: 500px;
      margin: auto;
      padding: 30px;
      background: #130B25;
      color: #ffffff;
      border-radius: 12px;
    ">
      <h2 style="color: #FF4F9A;">
        FaithConnect Password Reset
      </h2>

      <p>Hello ${safeName},</p>

      <p>
        We received a request to reset your FaithConnect password.
        Use the verification code below:
      </p>

      <div style="
        background: #251638;
        padding: 20px;
        text-align: center;
        border-radius: 10px;
        margin: 25px 0;
      ">
        <h1 style="
          color: #FF4F9A;
          letter-spacing: 10px;
          font-size: 32px;
        ">
          ${safeOTP}
        </h1>
      </div>

      <p>
        <strong>This verification code expires in 5 minutes.</strong>
      </p>

      <p>
        If you did not request a password reset,
        you can safely ignore this email.
      </p>

      <p style="color: #aaa;">
        FaithConnect · Faith. Love. Purpose.
      </p>
    </div>
  `;

  return sendBrevoEmail({
    to,
    subject: "Your FaithConnect Password Reset Code",
    htmlContent,
    emailType: "password reset",
  });
};
