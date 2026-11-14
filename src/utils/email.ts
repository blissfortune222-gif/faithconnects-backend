import "dotenv/config";
import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY?.trim();

if (!resendApiKey) {
  console.error("[RESEND] Missing RESEND_API_KEY environment variable.");
}

const resend = resendApiKey ? new Resend(resendApiKey) : null;

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

interface PasswordResetEmailParams {
  to: string;
  name?: string;
  otp: string;
}

export const sendPasswordResetOTPEmail = async ({
  to,
  name,
  otp,
}: PasswordResetEmailParams) => {
  if (!resend) {
    throw new Error("Resend API key is not configured.");
  }

  if (!to?.trim()) {
    throw new Error("Recipient email address is required.");
  }

  if (!otp?.trim()) {
    throw new Error("Password reset OTP is required.");
  }

  const safeName = escapeHtml(name?.trim() || "there");
  const safeOTP = escapeHtml(otp.trim());

  const mailOptions = {
    from: "FaithConnect <familyconnects@resend.dev>",
    to: to.trim(),
    subject: "Your FaithConnect Password Reset Code",
    html: `
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

        <p>This verification code expires in 5 minutes.</p>

        <p>
          If you did not request a password reset, you can ignore
          this email.
        </p>

        <p style="color: #aaa;">
          FaithConnect · Faith. Love. Purpose.
        </p>
      </div>
    `,
  };

  try {
    console.log("[RESEND] Sending password reset email...");
    console.log("[RESEND] Recipient:", to.trim());

    const { data, error } = await resend.emails.send(mailOptions);

    if (error) {
      console.error("[RESEND] Email request failed:", error);
      throw new Error(error.message || "Failed to send password reset email.");
    }

    console.log("[RESEND] Email request accepted successfully.");
    console.log("[RESEND] Email ID:", data?.id);

    return data;
  } catch (error) {
    console.error("[RESEND] PASSWORD RESET EMAIL ERROR:", error);
    throw error;
  }
};
