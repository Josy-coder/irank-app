"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";

export const sendMagicLinkEmail = action({
  args: {
    email: v.string(),
    token: v.string(),
    purpose: v.union(
      v.literal("login"),
      v.literal("password_reset"),
      v.literal("account_recovery")
    ),
  },
  handler: async (ctx, args) => {
    const { Resend } = await import('resend');

    if (!process.env.RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured");
      return { success: false, error: "Email service not configured" };
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    const baseUrl = process.env.CONVEX_SITE_URL || process.env.NEXT_PUBLIC_CONVEX_URL || "http://localhost:3000";
    const magicLinkUrl = `${baseUrl}/auth/magic-link?token=${args.token}`;

    const { subject, html } = getEmailContent(args.purpose, magicLinkUrl);

    try {
      const { data, error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'iRankHub <noreply@irankdebate.com>',
        to: [args.email],
        subject,
        html,
      });

      if (error) {
        console.error("Resend error:", error);
        return { success: false, error: error.message };
      }

      console.log("Magic link email sent:", data?.id);
      return { success: true, emailId: data?.id };

    } catch (error: any) {
      console.error("Failed to send magic link email:", error);
      return { success: false, error: error.message };
    }
  },
});

export const sendWelcomeEmail = action({
  args: {
    email: v.string(),
    name: v.string(),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    const { Resend } = await import('resend');

    if (!process.env.RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured");
      return { success: false, error: "Email service not configured" };
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    try {
      const { data, error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'iRankHub <noreply@irankdebate.com>',
        to: [args.email],
        subject: "Welcome to iRankHub!",
        html: getWelcomeEmailTemplate(args.name, args.role),
      });

      if (error) {
        console.error("Resend error:", error);
        return { success: false, error: error.message };
      }

      console.log("Welcome email sent:", data?.id);
      return { success: true, emailId: data?.id };

    } catch (error: any) {
      console.error("Failed to send welcome email:", error);
      return { success: false, error: error.message };
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
    const { Resend } = await import('resend');

    if (!process.env.RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured");
      return { success: false, error: "Email service not configured" };
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const dashboardUrl = `${process.env.CONVEX_SITE_URL || 'http://localhost:3000'}/dashboard/${args.role === 'school_admin' ? 'school' : args.role}`;

    try {
      const { data, error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'iRankHub <noreply@irankdebate.com>',
        to: [args.email],
        subject: "Your iRankHub Account Has Been Approved!",
        html: getAccountApprovedEmailTemplate(args.name, args.role, dashboardUrl),
      });

      if (error) {
        console.error("Resend error:", error);
        return { success: false, error: error.message };
      }

      console.log("Account approved email sent:", data?.id);
      return { success: true, emailId: data?.id };

    } catch (error: any) {
      console.error("Failed to send account approved email:", error);
      return { success: false, error: error.message };
    }
  },
});

export const sendPasswordResetEmail = action({
  args: {
    email: v.string(),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const { Resend } = await import('resend');

    if (!process.env.RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured");
      return { success: false, error: "Email service not configured" };
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const resetUrl = `${process.env.CONVEX_SITE_URL || 'http://localhost:3000'}/auth/reset-password?token=${args.token}`;

    try {
      const { data, error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'iRankHub <noreply@irankdebate.com>',
        to: [args.email],
        subject: "Reset Your iRankHub Password",
        html: getPasswordResetEmailTemplate(resetUrl),
      });

      if (error) {
        console.error("Resend error:", error);
        return { success: false, error: error.message };
      }

      console.log("Password reset email sent:", data?.id);
      return { success: true, emailId: data?.id };

    } catch (error: any) {
      console.error("Failed to send password reset email:", error);
      return { success: false, error: error.message };
    }
  },
});

export const sendTournamentInvitationEmail = action({
  args: {
    email: v.string(),
    name: v.string(),
    tournament_name: v.string(),
    tournament_date: v.string(),
    invitation_url: v.string(),
  },
  handler: async (ctx, args) => {
    const { Resend } = await import('resend');

    if (!process.env.RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured");
      return { success: false, error: "Email service not configured" };
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    try {
      const { data, error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'iRankHub <noreply@irankdebate.com>',
        to: [args.email],
        subject: `Invitation: ${args.tournament_name}`,
        html: getTournamentInvitationEmailTemplate(
          args.name,
          args.tournament_name,
          args.tournament_date,
          args.invitation_url
        ),
      });

      if (error) {
        console.error("Resend error:", error);
        return { success: false, error: error.message };
      }

      console.log("Tournament invitation email sent:", data?.id);
      return { success: true, emailId: data?.id };

    } catch (error: any) {
      console.error("Failed to send tournament invitation email:", error);
      return { success: false, error: error.message };
    }
  },
});

// Email template functions
function getEmailContent(purpose: string, magicLinkUrl: string) {
  const baseUrl = process.env.CONVEX_SITE_URL || 'http://localhost:3000';

  const configs = {
    login: {
      subject: "iRankHub - Magic Link Login",
      heading: "Sign in to iRankHub",
      description: "Click the link below to sign in to your account:",
      buttonText: "Sign In",
    },
    password_reset: {
      subject: "iRankHub - Reset Your Password",
      heading: "Reset your password",
      description: "Click the link below to reset your password:",
      buttonText: "Reset Password",
    },
    account_recovery: {
      subject: "iRankHub - Recover Your Account",
      heading: "Recover your account",
      description: "Click the link below to recover your account:",
      buttonText: "Recover Account",
    },
  };

  const config = configs[purpose as keyof typeof configs];

  const html = `
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
              transition: all 0.3s ease;
            ">
              ${config.buttonText}
            </a>
          </div>
          
          <div style="background-color: #f7fafc; border-radius: 8px; padding: 20px; margin: 32px 0;">
            // Continuing from where we left off in convex/actions/email.ts

            <p style="color: #718096; font-size: 14px; margin: 0;">
              <strong>Security tip:</strong> This link will expire in 15 minutes for your security.
            </p>
          </div>
          
          <p style="color: #718096; font-size: 14px; line-height: 1.6; margin-bottom: 8px;">
            If you didn't request this ${purpose === 'login' ? 'login link' : 'password reset'}, you can safely ignore this email.
          </p>
          
          <p style="color: #718096; font-size: 14px; line-height: 1.6;">
            If the button doesn't work, copy and paste this link into your browser:
          </p>
          <p style="color: #667eea; font-size: 12px; word-break: break-all; background-color: #f7fafc; padding: 8px; border-radius: 4px; font-family: monospace;">
            ${magicLinkUrl}
          </p>
        </div>
        
        <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 40px; text-align: center;">
          <p style="color: #a0aec0; font-size: 12px; margin: 0;">
            &copy; ${new Date().getFullYear()} iRankHub. All rights reserved.
          </p>
          <p style="color: #a0aec0; font-size: 12px; margin: 4px 0 0 0;">
            World Schools Debate Platform • Kigali, Rwanda
          </p>
        </div>
      </div>
    </div>
  `;

  return { subject: config.subject, html };
}

function getWelcomeEmailTemplate(name: string, role: string): string {
  const baseUrl = process.env.CONVEX_SITE_URL || 'http://localhost:3000';
  const dashboardUrl = `${baseUrl}/dashboard/${role === 'school_admin' ? 'school' : role}`;

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
        
        <div style="background-color: #f7fafc; border-radius: 8px; padding: 20px; margin: 32px 0;">
          <h3 style="color: #2d3748; font-size: 16px; margin-bottom: 12px;">Need Help?</h3>
          <p style="color: #718096; font-size: 14px; margin: 0;">
            Check out our <a href="${baseUrl}/help" style="color: #667eea;">help center</a> or 
            contact us at <a href="mailto:support@irankdebate.com" style="color: #667eea;">support@irankdebate.com</a>
          </p>
        </div>
        
        <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 40px; text-align: center;">
          <p style="color: #a0aec0; font-size: 12px; margin: 0;">
            &copy; ${new Date().getFullYear()} iRankHub. All rights reserved.
          </p>
          <p style="color: #a0aec0; font-size: 12px; margin: 4px 0 0 0;">
            World Schools Debate Platform • Kigali, Rwanda
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
        
        <div style="background-color: #f7fafc; border-radius: 8px; padding: 20px; margin: 32px 0;">
          <h3 style="color: #2d3748; font-size: 16px; margin-bottom: 12px;">What's Next?</h3>
          <ul style="color: #718096; font-size: 14px; line-height: 1.8; padding-left: 20px; margin: 0;">
            <li>Complete your profile setup</li>
            <li>Explore available tournaments</li>
            <li>Connect with the debate community</li>
            <li>Start your debate journey!</li>
          </ul>
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

function getTournamentInvitationEmailTemplate(
  name: string,
  tournamentName: string,
  tournamentDate: string,
  invitationUrl: string
): string {
  const baseUrl = process.env.CONVEX_SITE_URL || 'http://localhost:3000';

  return `
    <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif; background-color: #f8fafc;">
      <div style="background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        <div style="text-align: center; margin-bottom: 30px;">
          <img src="${baseUrl}/images/logo.png" alt="iRankHub Logo" style="width: 120px; height: auto;">
        </div>
        
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1a202c; font-size: 28px; margin-bottom: 16px; font-weight: 600;">
            Tournament Invitation
          </h1>
          <p style="color: #4a5568; font-size: 18px; margin: 0;">
            Hello ${name}!
          </p>
        </div>
        
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 24px; margin-bottom: 30px; text-align: center;">
          <h2 style="color: white; font-size: 24px; margin-bottom: 8px; font-weight: 600;">
            ${tournamentName}
          </h2>
          <p style="color: rgba(255, 255, 255, 0.9); font-size: 16px; margin: 0;">
            📅 ${tournamentDate}
          </p>
        </div>
        
        <div style="margin-bottom: 30px;">
          <p style="color: #4a5568; font-size: 16px; line-height: 1.6; text-align: center;">
            You've been invited to participate in this exciting debate tournament. 
            Join debaters from around the world for an incredible intellectual challenge!
          </p>
        </div>
        
        <div style="text-align: center; margin: 40px 0;">
          <a href="${invitationUrl}" style="
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 16px 32px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            display: inline-block;
            box-shadow: 0 4px 14px 0 rgba(102, 126, 234, 0.39);
            margin-bottom: 16px;
          ">
            View Invitation Details
          </a>
          <p style="color: #718096; font-size: 14px; margin: 0;">
            Click above to view full tournament details and RSVP
          </p>
        </div>
        
        <div style="background-color: #f7fafc; border-radius: 8px; padding: 20px; margin: 32px 0;">
          <h3 style="color: #2d3748; font-size: 16px; margin-bottom: 12px;">Tournament Highlights:</h3>
          <ul style="color: #718096; font-size: 14px; line-height: 1.8; padding-left: 20px; margin: 0;">
            <li>World Schools Debate format</li>
            <li>International participation</li>
            <li>Expert judges and feedback</li>
            <li>Networking opportunities</li>
            <li>Prizes and recognition</li>
          </ul>
        </div>
        
        <div style="background-color: #fef5e7; border: 1px solid #f6ad55; border-radius: 8px; padding: 16px; margin: 32px 0;">
          <p style="color: #744210; font-size: 14px; margin: 0;">
            <strong>Action Required:</strong> Please respond to this invitation by the deadline specified in the tournament details.
          </p>
        </div>
        
        <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 40px; text-align: center;">
          <p style="color: #a0aec0; font-size: 12px; margin: 0;">
            &copy; ${new Date().getFullYear()} iRankHub. All rights reserved.
          </p>
          <p style="color: #a0aec0; font-size: 12px; margin: 4px 0 0 0;">
            World Schools Debate Platform • Kigali, Rwanda
          </p>
        </div>
      </div>
    </div>
  `;
}

export const sendNotificationEmail = action({
  args: {
    email: v.string(),
    name: v.string(),
    subject: v.string(),
    title: v.string(),
    message: v.string(),
    action_url: v.optional(v.string()),
    action_text: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { Resend } = await import('resend');

    if (!process.env.RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured");
      return { success: false, error: "Email service not configured" };
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const baseUrl = process.env.CONVEX_SITE_URL || 'http://localhost:3000';

    const html = `
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif; background-color: #f8fafc;">
        <div style="background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="${baseUrl}/images/logo.png" alt="iRankHub Logo" style="width: 120px; height: auto;">
          </div>
          
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1a202c; font-size: 28px; margin-bottom: 16px; font-weight: 600;">
              ${args.title}
            </h1>
            <p style="color: #4a5568; font-size: 18px; margin: 0;">
              Hello ${args.name}!
            </p>
          </div>
          
          <div style="margin-bottom: 30px;">
            <p style="color: #4a5568; font-size: 16px; line-height: 1.6; text-align: center;">
              ${args.message}
            </p>
          </div>
          
          ${args.action_url && args.action_text ? `
            <div style="text-align: center; margin: 40px 0;">
              <a href="${args.action_url}" style="
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
                ${args.action_text}
              </a>
            </div>
          ` : ''}
          
          <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 40px; text-align: center;">
            <p style="color: #a0aec0; font-size: 12px; margin: 0;">
              &copy; ${new Date().getFullYear()} iRankHub. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `;

    try {
      const { data, error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'iRankHub <noreply@irankdebate.com>',
        to: [args.email],
        subject: args.subject,
        html,
      });

      if (error) {
        console.error("Resend error:", error);
        return { success: false, error: error.message };
      }

      console.log("Notification email sent:", data?.id);
      return { success: true, emailId: data?.id };

    } catch (error: any) {
      console.error("Failed to send notification email:", error);
      return { success: false, error: error.message };
    }
  },
});