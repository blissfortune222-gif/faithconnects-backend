import "dotenv/config";
import nodemailer from "nodemailer";

const gmailUser = process.env.GMAIL_USER?.trim();
const gmailPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");

if (!gmailUser || !gmailPassword) {
  console.error("[SMTP] Missing Gmail SMTP credentials.");
  console.error("[SMTP] GMAIL_USER loaded:", Boolean(gmailUser));
  console.error("[SMTP] GMAIL_APP_PASSWORD loaded:", Boolean(gmailPassword));
}

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,

  auth: {
    user: gmailUser,
    pass: gmailPassword,
  },

  // Prevent SMTP requests from hanging indefinitely.
  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 20000,
});

export const sendPasswordResetOTPEmail = async ({
  to,
  name,
  otp,
}: {
  to: string;
  name?: string;
  otp: string;
}) => {
  if (!gmailUser || !gmailPassword) {
    throw new Error("Gmail SMTP credentials are not configured.");
  }

  const mailOptions = {
    from: `"FaithConnect" <${gmailUser}>`,
    to,
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

        <p>Hello ${name || "there"},</p>

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
            ${otp}
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
    console.log("[SMTP] Starting password reset email delivery...");
    console.log("[SMTP] Recipient:", to);
    console.log("[SMTP] Connecting to smtp.gmail.com:465...");

    const result = await transporter.sendMail(mailOptions);

    console.log("[SMTP] Email sent successfully.");
    console.log("[SMTP] Message ID:", result.messageId);
    console.log("[SMTP] Response:", result.response);

    return result;
  } catch (error: unknown) {
    const smtpError = error as {
      message?: string;
      code?: string;
      command?: string;
      response?: string;
      responseCode?: number;
    };

    console.error("[SMTP] PASSWORD RESET EMAIL FAILED:", {
      message: smtpError.message,
      code: smtpError.code,
      command: smtpError.command,
      response: smtpError.response,
      responseCode: smtpError.responseCode,
    });

    throw error;
  }
};
