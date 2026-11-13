import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

interface PasswordResetOTPEmail {
  to: string;
  name: string;
  otp: string;
}

export const sendPasswordResetOTPEmail = async ({
  to,
  name,
  otp,
}: PasswordResetOTPEmail): Promise<void> => {
  await transporter.sendMail({
    from: `"FaithConnect" <${process.env.GMAIL_USER}>`,
    to,
    subject: "Your FaithConnect Password Reset Code",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: auto; padding: 30px; background: #0F0623; color: #ffffff; border-radius: 12px;">
        <h2 style="color: #FF4F9A;">FaithConnect</h2>

        <h3>Password Reset Request</h3>

        <p>Hello ${name || "there"},</p>

        <p>
          We received a request to reset your FaithConnect password.
          Use the verification code below to continue.
        </p>

        <div style="background: #21153A; padding: 22px; text-align: center; border-radius: 10px; margin: 25px 0;">
          <h1 style="color: #FF4F9A; letter-spacing: 10px; margin: 0;">
            ${otp}
          </h1>
        </div>

        <p>This code expires in <strong>5 minutes</strong>.</p>

        <p>
          If you did not request a password reset, you can safely
          ignore this email.
        </p>

        <p style="color: #aaaaaa; font-size: 12px;">
          © ${new Date().getFullYear()} FaithConnect. All rights reserved.
        </p>
      </div>
    `,
  });
};
