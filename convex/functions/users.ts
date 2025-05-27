import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

export const updateProfile = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    gender: v.optional(v.union(
      v.literal("male"),
      v.literal("female"),
      v.literal("non_binary")
    )),
    date_of_birth: v.optional(v.string()),
    grade: v.optional(v.string()),
    position: v.optional(v.string()),
    high_school_attended: v.optional(v.string()),
    national_id: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      const sessionResult = await ctx.runMutation(internal.functions.auth.verifySession, {
        token: args.token,
      });

      if (!sessionResult.valid || !sessionResult.user) {
        throw new Error("Invalid session");
      }

      const user = await ctx.db.get(sessionResult.user.id);
      if (!user) {
        throw new Error("User not found");
      }

      if (args.email !== user.email) {
        const existingUser = await ctx.db
          .query("users")
          .withIndex("by_email", (q) => q.eq("email", args.email))
          .first();

        if (existingUser && existingUser._id !== user._id) {
          throw new Error("Email already in use by another account");
        }
      }

      if (args.phone && args.phone !== user.phone) {
        const existingPhone = await ctx.db
          .query("users")
          .withIndex("by_phone", (q) => q.eq("phone", args.phone))
          .first();

        if (existingPhone && existingPhone._id !== user._id) {
          throw new Error("Phone number already in use by another account");
        }
      }

      const updateData: any = {
        name: args.name,
        email: args.email,
        phone: args.phone,
        gender: args.gender,
        date_of_birth: args.date_of_birth,
        updated_at: Date.now(),
      };

      if (user.role === "student") {
        updateData.grade = args.grade;
      } else if (user.role === "school_admin") {
        updateData.position = args.position;
      } else if (user.role === "volunteer") {
        updateData.high_school_attended = args.high_school_attended;
        updateData.national_id = args.national_id;
      }

      await ctx.db.patch(user._id, updateData);

      await ctx.runMutation(internal.functions.audit.createAuditLog, {
        user_id: user._id,
        action: "user_updated",
        resource_type: "users",
        resource_id: user._id,
        description: `User ${args.name} updated profile`,
        previous_state: JSON.stringify({
          name: user.name,
          email: user.email,
          phone: user.phone,
        }),
        new_state: JSON.stringify({
          name: args.name,
          email: args.email,
          phone: args.phone,
        }),
      });

      return {
        success: true,
        message: "Profile updated successfully",
      };
    } catch (error: any) {
      throw new Error(error.message || "Failed to update profile");
    }
  },
});

export const updateProfileImage = mutation({
  args: {
    token: v.string(),
    profile_image: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    try {
      const sessionResult = await ctx.runMutation(internal.functions.auth.verifySession, {
        token: args.token,
      });

      if (!sessionResult.valid || !sessionResult.user) {
        throw new Error("Invalid session");
      }

      const user = await ctx.db.get(sessionResult.user.id);
      if (!user) {
        throw new Error("User not found");
      }

      if (user.profile_image) {
        try {
          await ctx.storage.delete(user.profile_image);
        } catch (error) {
          console.log("Could not delete old profile image:", error);
        }
      }

      await ctx.db.patch(user._id, {
        profile_image: args.profile_image,
        updated_at: Date.now(),
      });

      await ctx.runMutation(internal.functions.audit.createAuditLog, {
        user_id: user._id,
        action: "user_updated",
        resource_type: "users",
        resource_id: user._id,
        description: `User ${user.name} updated profile image`,
      });

      return {
        success: true,
        message: "Profile image updated successfully",
      };
    } catch (error: any) {
      throw new Error(error.message || "Failed to update profile image");
    }
  },
});

export const updateSchoolLogo = mutation({
  args: {
    token: v.string(),
    logo_url: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    try {
      const sessionResult = await ctx.runMutation(internal.functions.auth.verifySession, {
        token: args.token,
      });

      if (!sessionResult.valid || !sessionResult.user) {
        throw new Error("Invalid session");
      }

      const user = await ctx.db.get(sessionResult.user.id);
      if (!user || user.role !== "school_admin" || !user.school_id) {
        throw new Error("Only school administrators can update school logo");
      }

      const school = await ctx.db.get(user.school_id);
      if (!school) {
        throw new Error("School not found");
      }

      if (school.logo_url) {
        try {
          await ctx.storage.delete(school.logo_url);
        } catch (error) {
          console.log("Could not delete old school logo:", error);
        }
      }

      await ctx.db.patch(user.school_id, {
        logo_url: args.logo_url,
        updated_at: Date.now(),
      });

      await ctx.runMutation(internal.functions.audit.createAuditLog, {
        user_id: user._id,
        action: "school_updated",
        resource_type: "schools",
        resource_id: user.school_id,
        description: `School administrator ${user.name} updated school logo`,
      });

      return {
        success: true,
        message: "School logo updated successfully",
      };
    } catch (error: any) {
      throw new Error(error.message || "Failed to update school logo");
    }
  },
});

export const updateSafeguardingCertificate = mutation({
  args: {
    token: v.string(),
    safeguarding_certificate: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    try {
      const sessionResult = await ctx.runMutation(internal.functions.auth.verifySession, {
        token: args.token,
      });

      if (!sessionResult.valid || !sessionResult.user) {
        throw new Error("Invalid session");
      }

      const user = await ctx.db.get(sessionResult.user.id);
      if (!user || user.role !== "volunteer") {
        throw new Error("Only volunteers can update safeguarding certificates");
      }

      if (user.safeguarding_certificate) {
        try {
          await ctx.storage.delete(user.safeguarding_certificate);
        } catch (error) {
          console.log("Could not delete old safeguarding certificate:", error);
        }
      }

      await ctx.db.patch(user._id, {
        safeguarding_certificate: args.safeguarding_certificate,
        updated_at: Date.now(),
      });

      await ctx.runMutation(internal.functions.audit.createAuditLog, {
        user_id: user._id,
        action: "user_updated",
        resource_type: "users",
        resource_id: user._id,
        description: `Volunteer ${user.name} updated safeguarding certificate`,
      });

      return {
        success: true,
        message: "Safeguarding certificate updated successfully",
      };
    } catch (error: any) {
      throw new Error(error.message || "Failed to update safeguarding certificate");
    }
  },
});

export const getProfileImageUrl = query({
  args: {
    storage_id: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    if (!args.storage_id) return null;
    return await ctx.storage.getUrl(args.storage_id);
  },
});

export const getSchoolLogoUrl = query({
  args: {
    school_id: v.optional(v.id("schools")),
  },
  handler: async (ctx, args) => {
    if (!args.school_id) return null;

    const school = await ctx.db.get(args.school_id);
    if (!school || !school.logo_url) return null;

    return await ctx.storage.getUrl(school.logo_url);
  },
});