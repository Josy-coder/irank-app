import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { ResendOTP } from "./ResendOTP";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({

      profile(params) {

        const profile: any = {
          firstName: (params.name as string)?.split(" ")[0] || "",
          lastName: (params.name as string)?.split(" ").slice(1).join(" ") || "",
          email: params.email as string,
          role: params.role as string,
          gender: params.gender as string,
          active: true,
          onboardingCompleted: false,
        };

        if (params.role === "student") {
          profile.schoolId = params.schoolId as string;
          profile.grade = params.grade as string;
          profile.dateOfBirth = params.dateOfBirth as string;

        } else if (params.role === "school_admin") {

          profile.position = params.position as string;
        } else if (params.role === "volunteer") {
          profile.dateOfBirth = params.dateOfBirth as string;
          profile.nationalId = params.nationalId as string;
          profile.highSchoolAttended = params.highSchoolAttended as string;
          profile.safeguardingCertificate = params.safeguardingCertificate as string;
        }

        return profile;
      },

      validatePasswordRequirements: (password: string) => {
        if (password.length < 8) {
          throw new Error("Password must be at least 8 characters long");
        }
      },
      verify: ResendOTP,
      reset: ResendOTP,
    }),

  ],

  callbacks: {
    async afterUserCreatedOrUpdated(ctx, { userId, profile, type }) {

      await ctx.db.patch(userId, {
        lastLoginAt: Date.now(),
      });

      if (!profile.notificationPreferences) {
        await ctx.db.patch(userId, {
          notificationPreferences: {
            email: true,
            push: true,
            sms: false,
          },
        });
      }

      if (profile.role === "school_admin" && type === "credentials" && !profile.schoolId) {
        const schoolData = {
          name: profile.schoolName || "",
          type: profile.schoolType || "public",
          country: profile.country || "",
          province: profile.province || "",
          district: profile.district || "",
          sector: profile.sector || "",
          contactEmail: profile.email || "",
          contactPhone: profile.phoneNumber || "",
          active: true,
          verificationStatus: "pending",
        };

        const schoolId = await ctx.db.insert("schools", schoolData);

        await ctx.db.patch(userId, { schoolId });
      }

      await ctx.db.insert("auditLogs", {
        userId,
        action: profile._id ? "user_updated" : "user_created",
        resourceType: "user",
        resourceId: userId,
        description: profile._id ? "User updated" : "User created",
        timestamp: Date.now(),
      });
    },
  },
});