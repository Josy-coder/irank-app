import Resend from "@auth/core/providers/resend";
import { Resend as ResendAPI } from "resend";
import { alphabet, generateRandomString } from "oslo/crypto";

export const ResendOTP = Resend({
  id: "resend-otp",
  apiKey: process.env.AUTH_RESEND_KEY,
  async generateVerificationToken() {

    return generateRandomString(6, alphabet("0-9"));
  },
  async sendVerificationRequest({ identifier: email, provider, token, url }) {
    const resend = new ResendAPI(provider.apiKey);

    const isPasswordReset = url?.includes("reset-password");
    const subject = isPasswordReset ? "Reset your iRankHub Password" : "Verify your iRankHub Email";
    const heading = isPasswordReset ? "Reset your password" : "Verify your email";
    const description = isPasswordReset
      ? "Use the verification code below to reset your password:"
      : "Use the verification code below to complete your email verification:";

    const { error } = await resend.emails.send({
      from: "iRankHub <noreply@irankdebate.com>",
      to: [email],
      subject: subject,
      html: `
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
          <img src="https://irankdebate.com/logo.png" alt="iRankHub Logo" style="display: block; margin: 0 auto 20px; width: 120px;">
          <div style="background-color: #f9f9f9; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <h2 style="color: #333; margin-top: 0;">${heading}</h2>
            <p style="color: #666; line-height: 1.5;">${description}</p>
            <div style="background-color: #e9e9e9; border-radius: 4px; padding: 15px; margin: 20px 0; text-align: center;">
              <span style="font-size: 24px; font-family: monospace; font-weight: bold; letter-spacing: 4px;">${token}</span>
            </div>
            <p style="color: #666; font-size: 14px;">This code will expire in 10 minutes. If you didn't request this code, you can safely ignore this email.</p>
          </div>
          <div style="color: #999; font-size: 13px; text-align: center;">
            <p>&copy; iRankHub. All rights reserved.</p>
            <p>Kigali, Rwanda</p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error("Failed to send verification email", error);
      throw new Error("Failed to send verification email");
    }
  },
});