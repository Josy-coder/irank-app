import { mutation, query } from "../../_generated/server";
import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { hashPassword } from "../../lib/password";
import { Doc } from "../../_generated/dataModel";

export const getUsers = query({
  args: {
    admin_token: v.string(),
    search: v.optional(v.string()),
    role: v.optional(v.union(
      v.literal("all"),
      v.literal("student"),
      v.literal("school_admin"),
      v.literal("volunteer"),
      v.literal("admin")
    )),
    status: v.optional(v.union(
      v.literal("all"),
      v.literal("active"),
      v.literal("inactive"),
      v.literal("banned")
    )),
    verified: v.optional(v.union(
      v.literal("all"),
      v.literal("verified"),
      v.literal("pending")
    )),
    page: v.number(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySessionReadOnly, {
      token: args.admin_token,
    });

    if (!sessionResult.valid || sessionResult.user?.role !== "admin") {
      throw new Error("Admin access required");
    }

    const { search, role, status, verified, page, limit } = args;

    // Handle search separately using search index
    if (search && search.trim() !== "") {
      const searchResults = await ctx.db
        .query("users")
        .withSearchIndex("search_users", (q) => {
          let query = q.search("name", search);
          if (role && role !== "all") query = query.eq("role", role);
          if (status && status !== "all") query = query.eq("status", status);
          if (verified && verified !== "all") {
            query = query.eq("verified", verified === "verified");
          }
          return query;
        })
        .collect();

      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedResults = searchResults.slice(startIndex, endIndex);

      const usersWithSchools = await Promise.all(
        paginatedResults.map(async (user) => {
          let school = null;
          if (user.school_id) {
            school = await ctx.db.get(user.school_id);
          }

          return {
            ...user,
            school: school ? {
              id: school._id,
              name: school.name,
              type: school.type,
            } : null,
          };
        })
      );

      return {
        users: usersWithSchools,
        totalCount: searchResults.length,
        hasMore: endIndex < searchResults.length,
        nextPage: endIndex < searchResults.length ? page + 1 : null,
      };
    }

    // For non-search queries, determine the best index to use
    let usersQuery;

    // Priority: role > status > verified
    if (role && role !== "all") {
      if (status && status !== "all") {
        // Use role_status index if available
        usersQuery = ctx.db
          .query("users")
          .withIndex("by_role_status", (q) => q.eq("role", role).eq("status", status));
      } else {
        usersQuery = ctx.db
          .query("users")
          .withIndex("by_role", (q) => q.eq("role", role));
      }
    } else if (status && status !== "all") {
      usersQuery = ctx.db
        .query("users")
        .withIndex("by_status", (q) => q.eq("status", status));
    } else if (verified && verified !== "all") {
      const isVerified = verified === "verified";
      usersQuery = ctx.db
        .query("users")
        .withIndex("by_verified", (q) => q.eq("verified", isVerified));
    } else {
      // No specific index needed, use full table scan
      usersQuery = ctx.db.query("users");
    }

    // Get all results first, then apply additional filters in memory
    let allUsers = await usersQuery.collect();

    // Apply additional filters that weren't handled by the index
    if (role && role !== "all") {
      allUsers = allUsers.filter(u => u.role === role);
    }

    if (status && status !== "all") {
      allUsers = allUsers.filter(u => u.status === status);
    }

    if (verified && verified !== "all") {
      const isVerified = verified === "verified";
      allUsers = allUsers.filter(u => u.verified === isVerified);
    }

    const totalCount = allUsers.length;

    // Sort by creation date (newest first)
    const sortedUsers = allUsers.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedUsers = sortedUsers.slice(startIndex, endIndex);

    // Fetch school information for each user
    const usersWithSchools = await Promise.all(
      paginatedUsers.map(async (user) => {
        let school = null;
        if (user.school_id) {
          school = await ctx.db.get(user.school_id);
        }

        return {
          ...user,
          school: school ? {
            id: school._id,
            name: school.name,
            type: school.type,
          } : null,
        };
      })
    );

    return {
      users: usersWithSchools,
      totalCount,
      hasMore: endIndex < totalCount,
      nextPage: endIndex < totalCount ? page + 1 : null,
    };
  },
});

export const updateUserStatus = mutation({
  args: {
    admin_token: v.string(),
    user_id: v.id("users"),
    status: v.union(
      v.literal("active"),
      v.literal("inactive"),
      v.literal("banned")
    ),
  },
  handler: async (ctx, args) => {
    const sessionResult = await ctx.runMutation(internal.functions.auth.verifySession, {
      token: args.admin_token,
    });

    if (!sessionResult.valid || sessionResult.user?.role !== "admin") {
      throw new Error("Admin access required");
    }

    const user = await ctx.db.get(args.user_id);
    if (!user) {
      throw new Error("User not found");
    }

    const previousStatus = user.status;

    await ctx.db.patch(args.user_id, {
      status: args.status,
      updated_at: Date.now(),
    });

    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: sessionResult.user.id,
      action: "user_updated",
      resource_type: "users",
      resource_id: args.user_id,
      description: `Admin changed user ${user.name} status from ${previousStatus} to ${args.status}`,
      previous_state: JSON.stringify({ status: previousStatus }),
      new_state: JSON.stringify({ status: args.status }),
    });

    // Send notification to user
    await ctx.db.insert("notifications", {
      user_id: args.user_id,
      title: "Account Status Updated",
      message: `Your account status has been changed to ${args.status}.`,
      type: "system",
      is_read: false,
      expires_at: Date.now() + (30 * 24 * 60 * 60 * 1000),
      created_at: Date.now(),
    });

    return { success: true };
  },
});

export const verifyUser = mutation({
  args: {
    admin_token: v.string(),
    user_id: v.id("users"),
    verified: v.boolean(),
  },
  handler: async (ctx, args) => {
    const sessionResult = await ctx.runMutation(internal.functions.auth.verifySession, {
      token: args.admin_token,
    });

    if (!sessionResult.valid || sessionResult.user?.role !== "admin") {
      throw new Error("Admin access required");
    }

    const user = await ctx.db.get(args.user_id);
    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.patch(args.user_id, {
      verified: args.verified,
      status: args.verified ? "active" : user.status,
      updated_at: Date.now(),
    });

    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: sessionResult.user.id,
      action: "user_verified",
      resource_type: "users",
      resource_id: args.user_id,
      description: `Admin ${args.verified ? 'verified' : 'unverified'} user ${user.name}`,
    });

    await ctx.db.insert("notifications", {
      user_id: args.user_id,
      title: args.verified ? "Account Verified" : "Account Verification Removed",
      message: args.verified
        ? "Your account has been verified by an administrator."
        : "Your account verification has been removed by an administrator.",
      type: "system",
      is_read: false,
      expires_at: Date.now() + (30 * 24 * 60 * 60 * 1000),
      created_at: Date.now(),
    });

    return { success: true };
  },
});

export const deleteUser = mutation({
  args: {
    admin_token: v.string(),
    user_id: v.id("users"),
  },
  handler: async (ctx, args) => {
    const sessionResult = await ctx.runMutation(internal.functions.auth.verifySession, {
      token: args.admin_token,
    });

    if (!sessionResult.valid || sessionResult.user?.role !== "admin") {
      throw new Error("Admin access required");
    }

    const user = await ctx.db.get(args.user_id);
    if (!user) {
      throw new Error("User not found");
    }

    const userTeams: Doc<"teams">[] = [];
    for await (const team of ctx.db.query("teams")) {
      if (team.members.includes(args.user_id)) {
        userTeams.push(team);
      }
    }

    if (userTeams.length > 0) {
      throw new Error("Cannot delete user who is part of tournament teams. Please remove from teams first.");
    }

    if (user.role === "school_admin" && user.school_id) {
      const school = await ctx.db.get(user.school_id);
      if (school && school.created_by === args.user_id) {
        throw new Error("Cannot delete school administrator who created the school. Please transfer ownership first.");
      }
    }

    if (user.profile_image) {
      try {
        await ctx.storage.delete(user.profile_image);
      } catch (error) {
        console.log("Could not delete profile image:", error);
      }
    }

    if (user.safeguarding_certificate) {
      try {
        await ctx.storage.delete(user.safeguarding_certificate);
      } catch (error) {
        console.log("Could not delete safeguarding certificate:", error);
      }
    }

    await ctx.db.delete(args.user_id);

    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: sessionResult.user.id,
      action: "user_deleted",
      resource_type: "users",
      resource_id: args.user_id,
      description: `Admin deleted user ${user.name} (${user.email})`,
      previous_state: JSON.stringify({
        name: user.name,
        email: user.email,
        role: user.role,
      }),
    });

    return { success: true };
  },
});

export const bulkUpdateUsers = mutation({
  args: {
    admin_token: v.string(),
    user_ids: v.array(v.id("users")),
    action: v.union(
      v.literal("verify"),
      v.literal("unverify"),
      v.literal("activate"),
      v.literal("deactivate"),
      v.literal("ban")
    ),
  },
  handler: async (ctx, args) => {
    const sessionResult = await ctx.runMutation(internal.functions.auth.verifySession, {
      token: args.admin_token,
    });

    if (!sessionResult.valid || sessionResult.user?.role !== "admin") {
      throw new Error("Admin access required");
    }

    const results = [];

    for (const userId of args.user_ids) {
      try {
        const user = await ctx.db.get(userId);
        if (!user) {
          results.push({ userId, success: false, error: "User not found" });
          continue;
        }

        let updateData: any = { updated_at: Date.now() };
        let notificationTitle = "";
        let notificationMessage = "";

        switch (args.action) {
          case "verify":
            updateData.verified = true;
            updateData.status = "active";
            notificationTitle = "Account Verified";
            notificationMessage = "Your account has been verified by an administrator.";
            break;
          case "unverify":
            updateData.verified = false;
            notificationTitle = "Account Verification Removed";
            notificationMessage = "Your account verification has been removed by an administrator.";
            break;
          case "activate":
            updateData.status = "active";
            notificationTitle = "Account Activated";
            notificationMessage = "Your account has been activated by an administrator.";
            break;
          case "deactivate":
            updateData.status = "inactive";
            notificationTitle = "Account Deactivated";
            notificationMessage = "Your account has been deactivated by an administrator.";
            break;
          case "ban":
            updateData.status = "banned";
            notificationTitle = "Account Banned";
            notificationMessage = "Your account has been banned by an administrator.";
            break;
        }

        await ctx.db.patch(userId, updateData);

        await ctx.db.insert("notifications", {
          user_id: userId,
          title: notificationTitle,
          message: notificationMessage,
          type: "system",
          is_read: false,
          expires_at: Date.now() + (30 * 24 * 60 * 60 * 1000),
          created_at: Date.now(),
        });

        await ctx.runMutation(internal.functions.audit.createAuditLog, {
          user_id: sessionResult.user.id,
          action: "user_updated",
          resource_type: "users",
          resource_id: userId,
          description: `Admin performed bulk action ${args.action} on user ${user.name}`,
        });

        results.push({ userId, success: true });
      } catch (error: any) {
        results.push({ userId, success: false, error: error.message });
      }
    }

    return { results };
  },
});

export const createUser = mutation({
  args: {
    admin_token: v.string(),
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    role: v.union(
      v.literal("student"),
      v.literal("school_admin"),
      v.literal("volunteer"),
      v.literal("admin")
    ),
    school_id: v.optional(v.id("schools")),
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
    const sessionResult = await ctx.runMutation(internal.functions.auth.verifySession, {
      token: args.admin_token,
    });

    if (!sessionResult.valid || sessionResult.user?.role !== "admin") {
      throw new Error("Admin access required");
    }

    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existingUser) {
      throw new Error("Email already exists");
    }

    if (args.phone) {
      const existingPhone = await ctx.db
        .query("users")
        .withIndex("by_phone", (q) => q.eq("phone", args.phone))
        .first();

      if (existingPhone) {
        throw new Error("Phone number already exists");
      }
    }

    const tempPassword = Math.random().toString(36).slice(-8);
    const passwordHash = await hashPassword(tempPassword);

    const userData: any = {
      name: args.name,
      email: args.email,
      phone: args.phone,
      password_hash: passwordHash.hash,
      password_salt: passwordHash.salt,
      role: args.role,
      school_id: args.school_id,
      status: "active",
      verified: true,
      gender: args.gender,
      date_of_birth: args.date_of_birth,
      created_at: Date.now(),
    };

    if (args.role === "student") {
      userData.grade = args.grade;
    } else if (args.role === "school_admin") {
      userData.position = args.position;
    } else if (args.role === "volunteer") {
      userData.high_school_attended = args.high_school_attended;
      userData.national_id = args.national_id;
    }

    const userId = await ctx.db.insert("users", userData);

    const resetToken = Math.random().toString(36).slice(-16);
    await ctx.db.insert("magic_links", {
      email: args.email,
      token: resetToken,
      user_id: userId,
      expires_at: Date.now() + (24 * 60 * 60 * 1000),
      created_at: Date.now(),
      purpose: "password_reset",
    });

    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: sessionResult.user.id,
      action: "user_created",
      resource_type: "users",
      resource_id: userId,
      description: `Admin created user ${args.name} (${args.email}) with role ${args.role}`,
    });

    await ctx.db.insert("notifications", {
      user_id: userId,
      title: "Welcome to iRankHub",
      message: "Your account has been created by an administrator. Please check your email for login instructions.",
      type: "system",
      is_read: false,
      expires_at: Date.now() + (30 * 24 * 60 * 60 * 1000),
      created_at: Date.now(),
    });

    return {
      success: true,
      userId,
      resetLink: `${process.env.SITE_URL}/reset-password?token=${resetToken}`,
      tempPassword
    };
  },
});
