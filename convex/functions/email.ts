import { action } from "../_generated/server";
import { v } from "convex/values";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendTournamentInvitation({
                                          to,
                                          recipientName,
                                          tournamentName,
                                          tournamentSlug,
                                          tournamentDate,
                                          tournamentLocation,
                                          isVirtual,
                                          invitationType,
                                          expiresAt,
                                          invitationId,
                                        }: {
  to: string;
  recipientName: string;
  tournamentName: string;
  tournamentSlug: string;
  tournamentDate: string;
  tournamentLocation?: string;
  isVirtual: boolean;
  invitationType: "school" | "volunteer" | "student";
  expiresAt: string;
  invitationId: string;
}) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.FRONTEND_SITE_URL || "http://localhost:3000";
  const tournamentUrl = `${baseUrl}/tournaments/${tournamentSlug}`;
  const acceptUrl = `${baseUrl}/api/invitations/respond?id=${invitationId}&response=accepted`;
  const declineUrl = `${baseUrl}/api/invitations/respond?id=${invitationId}&response=declined`;

  const emailHtml = getTournamentInvitationEmailTemplate(
    recipientName,
    tournamentName,
    tournamentSlug,
    tournamentDate,
    tournamentLocation,
    isVirtual,
    invitationType,
    expiresAt,
    invitationId,
    tournamentUrl,
    acceptUrl,
    declineUrl
  );

  const emailText = getTournamentInvitationTextTemplate(
    recipientName,
    tournamentName,
    tournamentDate,
    tournamentLocation,
    isVirtual,
    invitationType,
    expiresAt,
    tournamentUrl,
    acceptUrl,
    declineUrl
  );

  try {
    const result = await resend.emails.send({
      from: process.env.SMTP_FROM!,
      to: [to],
      subject: `Tournament Invitation: ${tournamentName}`,
      html: emailHtml,
      text: emailText,
      tags: [
        { name: "type", value: "tournament_invitation" },
        { name: "tournament", value: tournamentSlug },
        { name: "invitation_type", value: invitationType },
      ],
    });

    return {
      success: true,
      messageId: result.data?.id,
      error: result.error,
    };
  } catch (error: any) {
    console.error("Failed to send invitation email:", error);
    return {
      success: false,
      error: error.message || "Failed to send email",
    };
  }
}

export const sendTournamentInvitationEmail = action({
  args: {
    to: v.string(),
    recipientName: v.string(),
    tournamentName: v.string(),
    tournamentSlug: v.string(),
    tournamentDate: v.string(),
    tournamentLocation: v.optional(v.string()),
    isVirtual: v.boolean(),
    invitationType: v.union(
      v.literal("school"),
      v.literal("volunteer"),
      v.literal("student")
    ),
    expiresAt: v.string(),
    invitationId: v.string(),
  },
  handler: async (_ctx, args) => {
    return await sendTournamentInvitation(args);
  },
});

export const sendBulkTournamentInvitationEmails = action({
  args: {
    emails: v.array(v.object({
      to: v.string(),
      recipientName: v.string(),
      tournamentName: v.string(),
      tournamentSlug: v.string(),
      tournamentDate: v.string(),
      tournamentLocation: v.optional(v.string()),
      isVirtual: v.boolean(),
      invitationType: v.union(
        v.literal("school"),
        v.literal("volunteer"),
        v.literal("student")
      ),
      expiresAt: v.string(),
      invitationId: v.string(),
    })),
  },
  handler: async (_ctx, args) => {
    const results: Array<{
      email: string;
      success: boolean;
      messageId?: string;
      error?: string;
    }> = [];

    const batchSize = 10;

    for (let i = 0; i < args.emails.length; i += batchSize) {
      const batch = args.emails.slice(i, i + batchSize);

      const batchResults = await Promise.allSettled(
        batch.map(async (emailData) => {
          try {
            const result = await sendTournamentInvitation(emailData);
            return {
              email: emailData.to,
              success: result.success,
              messageId: result.messageId,
              error: result.error,
            };
          } catch (error: any) {
            return {
              email: emailData.to,
              success: false,
              error: error.message || "Failed to send email",
            };
          }
        })
      );

      for (const result of batchResults) {
        if (result.status === "fulfilled") {
          results.push(result.value);
        } else {
          results.push({
            email: "unknown",
            success: false,
            error: result.reason?.message || "Unknown error",
          });
        }
      }

      if (i + batchSize < args.emails.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return { results };
  },
});

export const sendWelcomeEmail = action({
  args: {
    email: v.string(),
    name: v.string(),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const html = getWelcomeEmailTemplate(args.name, args.role);

      const result = await resend.emails.send({
        from: process.env.SMTP_FROM!,
        to: [args.email],
        subject: "Welcome to iRankHub!",
        html,
        tags: [
          { name: "type", value: "welcome" },
          { name: "role", value: args.role },
        ],
      });

      return {
        success: true,
        message: "Welcome email sent successfully",
        messageId: result.data?.id,
      };
    } catch (error: any) {
      console.error("Failed to send welcome email:", error);
      return {
        success: false,
        error: error.message || "Failed to send email"
      };
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
    ),
  },
  handler: async (ctx, args) => {
    try {
      const baseUrl = process.env.FRONTEND_SITE_URL || "http://localhost:3000";
      let magicLinkUrl: string;
      let subject: string;

      switch (args.purpose) {
        case "login":
          magicLinkUrl = `${baseUrl}/magic-link?token=${args.token}`;
          subject = "iRankHub - Magic Link Login";
          break;
        case "password_reset":
          magicLinkUrl = `${baseUrl}/reset-password?token=${args.token}`;
          subject = "iRankHub - Reset Your Password";
          break;
      }

      const html = getMagicLinkEmailTemplate(args.purpose, magicLinkUrl);

      const result = await resend.emails.send({
        from: process.env.SMTP_FROM!,
        to: [args.email],
        subject,
        html,
        tags: [
          { name: "type", value: "magic_link" },
          { name: "purpose", value: args.purpose },
        ],
      });

      return {
        success: true,
        message: "Magic link email sent successfully",
        messageId: result.data?.id,
      };
    } catch (error: any) {
      console.error("Failed to send magic link email:", error);
      return {
        success: false,
        error: error.message || "Failed to send email"
      };
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
      const dashboardUrl = `${process.env.FRONTEND_SITE_URL || 'http://localhost:3000'}/${args.role === 'school_admin' ? 'school' : args.role}/dashboard`;
      const html = getAccountApprovedEmailTemplate(args.name, args.role, dashboardUrl);

      const result = await resend.emails.send({
        from: process.env.SMTP_FROM!,
        to: [args.email],
        subject: "Your iRankHub Account Has Been Approved!",
        html,
        tags: [
          { name: "type", value: "account_approved" },
          { name: "role", value: args.role },
        ],
      });

      return {
        success: true,
        message: "Account approval email sent successfully",
        messageId: result.data?.id,
      };
    } catch (error: any) {
      console.error("Failed to send account approval email:", error);
      return {
        success: false,
        error: error.message || "Failed to send email"
      };
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
      const resetUrl = `${process.env.FRONTEND_SITE_URL || 'http://localhost:3000'}/auth/reset-password?token=${args.token}`;
      const html = getPasswordResetEmailTemplate(resetUrl);

      const result = await resend.emails.send({
        from: process.env.SMTP_FROM!,
        to: [args.email],
        subject: "Reset Your iRankHub Password",
        html,
        tags: [
          { name: "type", value: "password_reset" },
        ],
      });

      return {
        success: true,
        message: "Password reset email sent successfully",
        messageId: result.data?.id,
      };
    } catch (error: any) {
      console.error("Failed to send password reset email:", error);
      return {
        success: false,
        error: error.message || "Failed to send email"
      };
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
      const batchSize = 10;
      const results: any = [];

      for (let i = 0; i < args.recipients.length; i += batchSize) {
        const batch = args.recipients.slice(i, i + batchSize);

        const batchPromises = batch.map(async (recipient) => {
          try {
            const html = getCustomEmailTemplate(args.template, recipient.name, recipient.customData);

            const result = await resend.emails.send({
              from: process.env.SMTP_FROM!,
              to: [recipient.email],
              subject: args.subject,
              html,
              tags: [
                { name: "type", value: "bulk_notification" },
              ],
            });

            return {
              email: recipient.email,
              success: true,
              messageId: result.data?.id,
            };
          } catch (error: any) {
            return {
              email: recipient.email,
              success: false,
              error: error.message,
            };
          }
        });

        const batchResults = await Promise.allSettled(batchPromises);

        batchResults.forEach((result) => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            results.push({
              email: 'unknown',
              success: false,
              error: result.reason?.message || 'Unknown error',
            });
          }
        });

        if (i + batchSize < args.recipients.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const successCount = results.filter((r: { success: any; }) => r.success).length;

      return {
        success: true,
        message: `${successCount} out of ${args.recipients.length} emails sent successfully`,
        count: successCount,
        results,
      };
    } catch (error: any) {
      console.error("Failed to send bulk emails:", error);
      return {
        success: false,
        error: error.message || "Failed to send bulk emails"
      };
    }
  },
});

function getTournamentInvitationEmailTemplate(
  recipientName: string,
  tournamentName: string,
  tournamentSlug: string,
  tournamentDate: string,
  tournamentLocation: string | undefined,
  isVirtual: boolean,
  invitationType: "school" | "volunteer" | "student",
  expiresAt: string,
  invitationId: string,
  tournamentUrl: string,
  acceptUrl: string,
  declineUrl: string
): string {
  const baseUrl = process.env.FRONTEND_SITE_URL || 'http://localhost:3000';

  const getInvitationTypeText = (type: string) => {
    switch (type) {
      case "school": return "your school";
      case "student": return "you as a student";
      case "volunteer": return "you as a volunteer";
      default: return "you";
    }
  };

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tournament Invitation</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333333;
      background-color: #f5f5f5;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .content {
      padding: 30px;
    }
    .tournament-card {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      color: white;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
      text-align: center;
    }
    .tournament-card h2 {
      margin: 0 0 10px 0;
      font-size: 20px;
    }
    .tournament-details {
      background-color: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .detail-item {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      padding-bottom: 10px;
      border-bottom: 1px solid #e9ecef;
    }
    .detail-item:last-child {
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0;
    }
    .detail-label {
      font-weight: 600;
      color: #495057;
    }
    .detail-value {
      color: #6c757d;
    }
    .action-buttons {
      text-align: center;
      margin: 30px 0;
    }
    .btn {
      display: inline-block;
      padding: 12px 24px;
      margin: 0 10px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      text-align: center;
      transition: all 0.3s ease;
    }
    .btn-accept {
      background-color: #28a745;
      color: white;
    }
    .btn-accept:hover {
      background-color: #218838;
    }
    .btn-decline {
      background-color: #dc3545;
      color: white;
    }
    .btn-decline:hover {
      background-color: #c82333;
    }
    .btn-view {
      background-color: #007bff;
      color: white;
      margin-top: 15px;
    }
    .btn-view:hover {
      background-color: #0056b3;
    }
    .footer {
      background-color: #f8f9fa;
      padding: 20px;
      text-align: center;
      color: #6c757d;
      font-size: 14px;
    }
    .expiry-notice {
      background-color: #fff3cd;
      border: 1px solid #ffeaa7;
      color: #856404;
      padding: 15px;
      border-radius: 6px;
      margin: 20px 0;
      font-size: 14px;
    }
    @media (max-width: 600px) {
      .container {
        margin: 0;
        border-radius: 0;
      }
      .content {
        padding: 20px;
      }
      .btn {
        display: block;
        margin: 10px 0;
        width: 100%;
        box-sizing: border-box;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🏆 Tournament Invitation</h1>
    </div>
    
    <div class="content">
      <p>Dear ${recipientName},</p>
      
      <p>We are excited to invite ${getInvitationTypeText(invitationType)} to participate in an upcoming debate tournament!</p>
      
      <div class="tournament-card">
        <h2>${tournamentName}</h2>
        <p>Join us for an exciting debate competition</p>
      </div>
      
      <div class="tournament-details">
        <div class="detail-item">
          <span class="detail-label">📅 Date:</span>
          <span class="detail-value">${tournamentDate}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">${isVirtual ? '💻' : '📍'} ${isVirtual ? 'Format' : 'Location'}:</span>
          <span class="detail-value">${isVirtual ? 'Virtual Tournament' : (tournamentLocation || 'TBD')}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">👥 Invitation Type:</span>
          <span class="detail-value">${invitationType.charAt(0).toUpperCase() + invitationType.slice(1)} Participation</span>
        </div>
      </div>
      
      <div class="expiry-notice">
        ⏰ <strong>Please respond by ${expiresAt}</strong> to secure your participation in this tournament.
      </div>
      
      <div class="action-buttons">
        <a href="${acceptUrl}" class="btn btn-accept">✅ Accept Invitation</a>
        <a href="${declineUrl}" class="btn btn-decline">❌ Decline Invitation</a>
        <br>
        <a href="${tournamentUrl}" class="btn btn-view">📋 View Tournament Details</a>
      </div>
      
      <p>If you have any questions about this tournament or need assistance, please don't hesitate to contact our support team.</p>
      
      <p>We look forward to your participation!</p>
      
      <p>Best regards,<br>
      <strong>iRank Tournament Team</strong></p>
    </div>
    
    <div class="footer">
      <p>This invitation will expire on ${expiresAt}. You can also respond by logging into your <a href="${baseUrl}">account</a> and visiting the <a href="${baseUrl}/${invitationType}/${tournamentSlug}">tournament page.</a></p>
      <p>© 2025 iRank. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;
}

function getTournamentInvitationTextTemplate(
  recipientName: string,
  tournamentName: string,
  tournamentDate: string,
  tournamentLocation: string | undefined,
  isVirtual: boolean,
  invitationType: "school" | "volunteer" | "student",
  expiresAt: string,
  tournamentUrl: string,
  acceptUrl: string,
  declineUrl: string
): string {
  const getInvitationTypeText = (type: string) => {
    switch (type) {
      case "school": return "your school";
      case "student": return "you as a student";
      case "volunteer": return "you as a volunteer";
      default: return "you";
    }
  };

  return `
Tournament Invitation: ${tournamentName}

Dear ${recipientName},

We are excited to invite ${getInvitationTypeText(invitationType)} to participate in ${tournamentName}!

Tournament Details:
- Date: ${tournamentDate}
- ${isVirtual ? 'Format' : 'Location'}: ${isVirtual ? 'Virtual Tournament' : (tournamentLocation || 'TBD')}
- Invitation Type: ${invitationType.charAt(0).toUpperCase() + invitationType.slice(1)} Participation

Please respond by ${expiresAt} to secure your participation.

To respond to this invitation:
- Accept: ${acceptUrl}
- Decline: ${declineUrl}
- View Details: ${tournamentUrl}

If you have any questions, please contact our support team.

Best regards,
iRank Tournament Team

This invitation expires on ${expiresAt}.
  `;
}

function getMagicLinkEmailTemplate(purpose: string, magicLinkUrl: string): string {
  const baseUrl = process.env.FRONTEND_SITE_URL || 'http://localhost:3000';

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
  const baseUrl = process.env.FRONTEND_SITE_URL || 'http://localhost:3000';
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
  const baseUrl = process.env.FRONTEND_SITE_URL || 'http://localhost:3000';

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
  const baseUrl = process.env.FRONTEND_SITE_URL || 'http://localhost:3000';

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