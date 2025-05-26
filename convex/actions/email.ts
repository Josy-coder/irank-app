"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import nodemailer from "nodemailer";

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 3000, 5000];

interface EmailQueue {
  to: string;
  subject: string;
  html: string;
  attempts: number;
  lastAttempt?: number;
}

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
  });
}

async function sendEmailWithRetry(emailData: EmailQueue): Promise<boolean> {
  const transporter = createTransporter();

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || 'iRankHub <info@debaterwanda.org>',
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html,
      });

      console.log(`Email sent successfully to ${emailData.to} on attempt ${attempt}`);
      return true;
    } catch (error: any) {
      console.error(`Email attempt ${attempt} failed for ${emailData.to}:`, error.message);

      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAYS[attempt - 1];
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.error(`Failed to send email to ${emailData.to} after ${MAX_RETRIES} attempts`);
  return false;
}

async function sendBatchEmails(emails: EmailQueue[]): Promise<void> {
  const batchSize = 10;

  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);

    const promises = batch.map(email => sendEmailWithRetry(email));
    await Promise.allSettled(promises);

    if (i + batchSize < emails.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

export const sendWelcomeEmail = action({
  args: {
    email: v.string(),
    name: v.string(),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const html = getWelcomeEmailTemplate(args.name, args.role);

      const emailData: EmailQueue = {
        to: args.email,
        subject: "Welcome to iRankHub!",
        html,
        attempts: 0,
      };

      sendEmailWithRetry(emailData).catch(error => {
        console.error("Background email sending failed:", error);
      });

      return { success: true, message: "Welcome email queued for sending" };
    } catch (error: any) {
      console.error("Failed to queue welcome email:", error);
      return { success: false, error: "Failed to queue email" };
    }
  },
});

export const sendMagicLinkEmail = action({
  args: {
    email: v.string(),
    token: v.string(),
    purpose: v.union(
      v.literal("login"),
      v.literal("password_reset"),
      v.literal("email_verification"),
      v.literal("account_recovery")
    ),
  },
  handler: async (ctx, args) => {
    try {
      const baseUrl = process.env.CONVEX_SITE_URL || process.env.NEXT_PUBLIC_CONVEX_URL || "http://localhost:3000";
      let magicLinkUrl: string;
      let subject: string;

      switch (args.purpose) {
        case "login":
          magicLinkUrl = `${baseUrl}/auth/magic-link?token=${args.token}`;
          subject = "iRankHub - Magic Link Login";
          break;
        case "password_reset":
          magicLinkUrl = `${baseUrl}/auth/reset-password?token=${args.token}`;
          subject = "iRankHub - Reset Your Password";
          break;
        case "email_verification":
          magicLinkUrl = `${baseUrl}/auth/verify-email?token=${args.token}`;
          subject = "iRankHub - Verify Your Email";
          break;
        case "account_recovery":
          magicLinkUrl = `${baseUrl}/auth/recover-account?token=${args.token}`;
          subject = "iRankHub - Recover Your Account";
          break;
      }

      const html = getMagicLinkEmailTemplate(args.purpose, magicLinkUrl);

      const emailData: EmailQueue = {
        to: args.email,
        subject,
        html,
        attempts: 0,
      };

      sendEmailWithRetry(emailData).catch(error => {
        console.error("Background magic link email failed:", error);
      });

      return { success: true, message: "Magic link email queued for sending" };
    } catch (error: any) {
      console.error("Failed to queue magic link email:", error);
      return { success: false, error: "Failed to queue email" };
    }
  },
});

export const sendAccountApprovedEmail = action({
  args: {
    email: v.string(),
    name: v.string(),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const dashboardUrl = `${process.env.CONVEX_SITE_URL || 'http://localhost:3000'}/${args.role === 'school_admin' ? 'school' : args.role}/dashboard`;
      const html = getAccountApprovedEmailTemplate(args.name, args.role, dashboardUrl);

      const emailData: EmailQueue = {
        to: args.email,
        subject: "Your iRankHub Account Has Been Approved!",
        html,
        attempts: 0,
      };

      sendEmailWithRetry(emailData).catch(error => {
        console.error("Background approval email failed:", error);
      });

      return { success: true, message: "Approval email queued for sending" };
    } catch (error: any) {
      console.error("Failed to queue approval email:", error);
      return { success: false, error: "Failed to queue email" };
    }
  },
});

export const sendPasswordResetEmail = action({
  args: {
    email: v.string(),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const resetUrl = `${process.env.CONVEX_SITE_URL || 'http://localhost:3000'}/auth/reset-password?token=${args.token}`;
      const html = getPasswordResetEmailTemplate(resetUrl);

      const emailData: EmailQueue = {
        to: args.email,
        subject: "Reset Your iRankHub Password",
        html,
        attempts: 0,
      };

      sendEmailWithRetry(emailData).catch(error => {
        console.error("Background password reset email failed:", error);
      });

      return { success: true, message: "Password reset email queued for sending" };
    } catch (error: any) {
      console.error("Failed to queue password reset email:", error);
      return { success: false, error: "Failed to queue email" };
    }
  },
});

export const sendBulkNotificationEmails = action({
  args: {
    recipients: v.array(v.object({
      email: v.string(),
      name: v.string(),
      customData: v.optional(v.any()),
    })),
    subject: v.string(),
    template: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const emails: EmailQueue[] = args.recipients.map(recipient => ({
        to: recipient.email,
        subject: args.subject,
        html: getCustomEmailTemplate(args.template, recipient.name, recipient.customData),
        attempts: 0,
      }));

      sendBatchEmails(emails).catch(error => {
        console.error("Background batch email sending failed:", error);
      });

      return {
        success: true,
        message: `${emails.length} emails queued for sending`,
        count: emails.length
      };
    } catch (error: any) {
      console.error("Failed to queue batch emails:", error);
      return { success: false, error: "Failed to queue batch emails" };
    }
  },
});

function getMagicLinkEmailTemplate(purpose: string, magicLinkUrl: string): string {
  const baseUrl = process.env.CONVEX_SITE_URL || 'http://localhost:3000';

  const configs = {
    login: {
      heading: "Sign in to iRankHub",
      description: "Click the link below to sign in to your account:",
      buttonText: "Sign In",
    },
    password_reset: {
      heading: "Reset your password",
      description: "Click the link below to reset your password:",
      buttonText: "Reset Password",
    },
    email_verification: {
      heading: "Verify your email",
      description: "Click the link below to verify your email address:",
      buttonText: "Verify Email",
    },
    account_recovery: {
      heading: "Recover your account",
      description: "Click the link below to recover your account:",
      buttonText: "Recover Account",
    },
  };

  const config = configs[purpose as keyof typeof configs];

  return `
    <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif; background-color: #f8fafc;">
      <div style="background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        <div style="text-align: center; margin-bottom: 30px;">
          <img src="${baseUrl}/images/logo.png" alt="iRankHub Logo" style="width: 120px; height: auto;">
        </div>
        
        <div style="text-align: center;">
          <h1 style="color: #1a202c; font-size: 28px; margin-bottom: 16px; font-weight: 600;">
            ${config.heading}
          </h1>
          <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin-bottom: 32px;">
            ${config.description}
          </p>
          
          <div style="margin: 40px 0;">
            <a href="${magicLinkUrl}" style="
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 16px 32px;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 600;
              font-size: 16px;
              display: inline-block;
              box-shadow: 0 4px 14px 0 rgba(102, 126, 234, 0.39);
            ">
              ${config.buttonText}
            </a>
          </div>
          
          <div style="background-color: #f7fafc; border-radius: 8px; padding: 20px; margin: 32px 0;">
            <p style="color: #718096; font-size: 14px; margin: 0;">
              <strong>Security tip:</strong> This link will expire in 15 minutes for your security.
            </p>
          </div>
          
          <p style="color: #718096; font-size: 14px; line-height: 1.6;">
            If you didn't request this, you can safely ignore this email.
          </p>
        </div>
        
        <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 40px; text-align: center;">
          <p style="color: #a0aec0; font-size: 12px; margin: 0;">
            &copy; ${new Date().getFullYear()} iRankHub. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  `;
}

function getWelcomeEmailTemplate(name: string, role: string): string {
  const baseUrl = process.env.CONVEX_SITE_URL || 'http://localhost:3000';
  const dashboardUrl = `${baseUrl}/${role === 'school_admin' ? 'school' : role}/dashboard`;

  const roleMessages = {
    student: {
      title: "Welcome to the Global Debate Community!",
      description: "You're now part of a worldwide network of debaters. Start exploring tournaments and tracking your progress.",
      features: [
        "Participate in international tournaments",
        "Track your debate performance",
        "Connect with debaters worldwide",
        "Access educational resources"
      ]
    },
    school_admin: {
      title: "Welcome to iRankHub School Portal!",
      description: "Your school is now registered. Manage your debate teams and tournament participation with ease.",
      features: [
        "Register multiple debate teams",
        "Track student performance",
        "Manage tournament registrations",
        "View comprehensive analytics"
      ]
    },
    volunteer: {
      title: "Welcome to the iRankHub Judge Community!",
      description: "Thank you for joining our network of dedicated judges. Your expertise shapes future speakers and leaders.",
      features: [
        "Judge debates across various formats",
        "Track judging history and feedback",
        "Contribute to student development",
        "Access advanced judging tools"
      ]
    },
    admin: {
      title: "Welcome to iRankHub Administration!",
      description: "You now have administrative access to manage the platform and support our debate community.",
      features: [
        "Manage users and schools",
        "Configure tournaments and leagues",
        "Generate comprehensive reports",
        "Monitor platform health"
      ]
    }
  };

  const roleConfig = roleMessages[role as keyof typeof roleMessages] || roleMessages.student;

  return `
    <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif; background-color: #f8fafc;">
      <div style="background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        <div style="text-align: center; margin-bottom: 30px;">
          <img src="${baseUrl}/images/logo.png" alt="iRankHub Logo" style="width: 120px; height: auto;">
        </div>
        
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1a202c; font-size: 28px; margin-bottom: 8px; font-weight: 600;">
            ${roleConfig.title}
          </h1>
          <p style="color: #4a5568; font-size: 18px; margin: 0;">
            Hello ${name}!
          </p>
        </div>
        
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 24px; margin-bottom: 30px;">
          <p style="color: white; font-size: 16px; line-height: 1.6; margin: 0; text-align: center;">
            ${roleConfig.description}
          </p>
        </div>
        
        <div style="margin-bottom: 30px;">
          <h2 style="color: #2d3748; font-size: 20px; margin-bottom: 16px;">What you can do:</h2>
          <ul style="color: #4a5568; font-size: 14px; line-height: 1.8; padding-left: 20px;">
            ${roleConfig.features.map(feature => `<li style="margin-bottom: 8px;">${feature}</li>`).join('')}
          </ul>
        </div>
        
        <div style="text-align: center; margin: 40px 0;">
          <a href="${dashboardUrl}" style="
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 16px 32px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            display: inline-block;
            box-shadow: 0 4px 14px 0 rgba(102, 126, 234, 0.39);
          ">
            Go to Dashboard
          </a>
        </div>
        
        <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 40px; text-align: center;">
          <p style="color: #a0aec0; font-size: 12px; margin: 0;">
            &copy; ${new Date().getFullYear()} iRankHub. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  `;
}

function getAccountApprovedEmailTemplate(name: string, role: string, dashboardUrl: string): string {
  const baseUrl = process.env.CONVEX_SITE_URL || 'http://localhost:3000';

  return `
    <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif; background-color: #f8fafc;">
      <div style="background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        <div style="text-align: center; margin-bottom: 30px;">
          <img src="${baseUrl}/images/logo.png" alt="iRankHub Logo" style="width: 120px; height: auto;">
        </div>
        
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
            <svg width="40" height="40" fill="white" viewBox="0 0 24 24">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <h1 style="color: #1a202c; font-size: 28px; margin-bottom: 8px; font-weight: 600;">
            Account Approved!
          </h1>
          <p style="color: #4a5568; font-size: 18px; margin: 0;">
            Hello ${name}!
          </p>
        </div>
        
        <div style="background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); border-radius: 12px; padding: 24px; margin-bottom: 30px;">
          <p style="color: white; font-size: 16px; line-height: 1.6; margin: 0; text-align: center;">
            Great news! Your ${role.replace('_', ' ')} account has been approved by our administrators. 
            You now have full access to all iRankHub features.
          </p>
        </div>
        
        <div style="text-align: center; margin: 40px 0;">
          <a href="${dashboardUrl}" style="
            background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
            color: white;
            padding: 16px 32px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            display: inline-block;
            box-shadow: 0 4px 14px 0 rgba(72, 187, 120, 0.39);
          ">
            Access Your Dashboard
          </a>
        </div>
        
        <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 40px; text-align: center;">
          <p style="color: #a0aec0; font-size: 12px; margin: 0;">
            &copy; ${new Date().getFullYear()} iRankHub. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  `;
}

function getPasswordResetEmailTemplate(resetUrl: string): string {
  const baseUrl = process.env.CONVEX_SITE_URL || 'http://localhost:3000';

  return `
    <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif; background-color: #f8fafc;">
      <div style="background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        <div style="text-align: center; margin-bottom: 30px;">
          <img src="${baseUrl}/images/logo.png" alt="iRankHub Logo" style="width: 120px; height: auto;">
        </div>
        
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1a202c; font-size: 28px; margin-bottom: 16px; font-weight: 600;">
            Reset Your Password
          </h1>
          <p style="color: #4a5568; font-size: 16px; line-height: 1.6;">
            We received a request to reset your password. Click the button below to create a new password.
          </p>
        </div>
        
        <div style="text-align: center; margin: 40px 0;">
          <a href="${resetUrl}" style="
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 16px 32px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            display: inline-block;
            box-shadow: 0 4px 14px 0 rgba(102, 126, 234, 0.39);
          ">
            Reset Password
          </a>
        </div>
        
        <div style="background-color: #fef5e7; border: 1px solid #f6ad55; border-radius: 8px; padding: 16px; margin: 32px 0;">
          <p style="color: #744210; font-size: 14px; margin: 0;">
            <strong>Security Notice:</strong> This link will expire in 1 hour for your security. 
            If you didn't request this reset, please ignore this email.
          </p>
        </div>
        
        <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 40px; text-align: center;">
          <p style="color: #a0aec0; font-size: 12px; margin: 0;">
            &copy; ${new Date().getFullYear()} iRankHub. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  `;
}

function getCustomEmailTemplate(template: string, name: string, customData?: any): string {

  return `
    <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
      <h1>Hello ${name},</h1>
      <div>${template}</div>
    </div>
  `;
}