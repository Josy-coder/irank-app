import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

const userRoleType = v.union(
  v.literal("student"),
  v.literal("school_admin"),
  v.literal("volunteer"),
  v.literal("admin"),
);

const userStatusType = v.union(
  v.literal("active"),
  v.literal("inactive"),
  v.literal("banned"),
);

const genderType = v.union(
  v.literal("male"),
  v.literal("female"),
  v.literal("non_binary"),
);

/**
 * Get a user by ID
 * Accessible by all user roles
 */
export const getUser = query({
  args: {
    id: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.id);

    if (!user) {
      return null;
    }

    return user;
  },
});

/**
 * Get the current authenticated user
 * Accessible by all user roles
 */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email))
      .first();
  },
});

/**
 * Get all users with pagination and search
 * Accessible by admin only
 */
export const getUsers = query({
  args: {
    search: v.optional(v.string()),
    role: v.optional(userRoleType),
    status: v.optional(userStatusType),
    schoolId: v.optional(v.id("schools")),
    page: v.number(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email))
      .first();

    if (!currentUser || currentUser.role !== "admin") {
      throw new Error("Unauthorized - Admin access required");
    }

    const baseQuery = ctx.db.query("users");

    let filteredQuery;

    if (args.role) {
      filteredQuery = baseQuery.withIndex("by_role", (q) =>
        q.eq("role", args.role ?? "volunteer"),
      );
    } else if (args.status) {
      filteredQuery = baseQuery.withIndex("by_status", (q) =>
        q.eq("status", args.status ?? "active"),
      );
    } else if (args.schoolId) {
      filteredQuery = baseQuery.withIndex("by_school_id", (q) =>
        q.eq("school_id", args.schoolId),
      );
    } else {
      filteredQuery = baseQuery;
    }

    if (args.search && args.search.trim() !== "") {
      const searchQuery = baseQuery.withSearchIndex("search_users", (q) =>
        q.search("name", args.search ?? ""),
      );

      const paginatedUsers = await searchQuery.paginate({
        numItems: args.limit,
        cursor: args.page > 1 ? String(args.page) : null,
      });

      return {
        users: paginatedUsers.page,
        totalCount: paginatedUsers.page.length,
        hasMore: paginatedUsers.continueCursor !== null,
        nextPage: paginatedUsers.continueCursor,
      };
    } else {
      const finalQuery = filteredQuery;
      const totalCount = await finalQuery.collect();

      const paginatedUsers = await finalQuery.order("desc").paginate({
        numItems: args.limit,
        cursor: args.page > 1 ? String(args.page) : null,
      });

      return {
        users: paginatedUsers.page,
        totalCount: totalCount.length,
        hasMore: paginatedUsers.continueCursor !== null,
        nextPage: paginatedUsers.continueCursor,
      };
    }
  },
});

/**
 * Create a new user
 * Accessible by admin only
 */
export const createUser = mutation({
  args: {
    name: v.string(),
    role: userRoleType,
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    school_id: v.optional(v.id("schools")),
    gender: v.optional(genderType),
    grade: v.optional(v.string()),
    date_of_birth: v.optional(v.string()),
    position: v.optional(v.string()),
    status: v.optional(userStatusType),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const email = identity?.email;

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (!currentUser || currentUser.role !== "admin") {
      throw new Error("Unauthorized - Admin access required");
    }

    if (args.email) {
      const existingUserByEmail = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", args.email))
        .first();

      if (existingUserByEmail) {
        throw new Error("Email already exists");
      }
    }

    if (args.phone) {
      const existingUserByPhone = await ctx.db
        .query("users")
        .withIndex("by_phone", (q) => q.eq("phone", args.phone))
        .first();

      if (existingUserByPhone) {
        throw new Error("Phone number already exists");
      }
    }

    const userId = await ctx.db.insert("users", {
      name: args.name,
      role: args.role,
      email: args.email,
      phone: args.phone,
      profile_image: undefined,
      school_id: args.school_id,
      status: args.status || "active",
      gender: args.gender,
      grade: args.grade,
      date_of_birth: args.date_of_birth,
      position: args.position,
      mfa_enabled: false,
      biometric_enabled: false,
      verified: false,
    });

    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: currentUser._id,
      action: "user_created",
      resource_type: "users",
      resource_id: userId,
      description: `Created user ${args.name}`,
      new_state: JSON.stringify(args),
    });
    return userId;
  },
});

/**
 * Update a user
 * Users can update their own profile, or admin can update any user
 */
export const updateUser = mutation({
  args: {
    id: v.id("users"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    profile_image: v.optional(v.id("_storage")),
    school_id: v.optional(v.id("schools")),
    status: v.optional(userStatusType),
    gender: v.optional(genderType),
    grade: v.optional(v.string()),
    date_of_birth: v.optional(v.string()),
    position: v.optional(v.string()),
    role: v.optional(userRoleType),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email))
      .first();

    if (!currentUser) {
      throw new Error("User not found");
    }

    const userToUpdate = await ctx.db.get(args.id);
    if (!userToUpdate) {
      throw new Error("User not found");
    }

    if (currentUser.role !== "admin" && currentUser._id !== args.id) {
      throw new Error("Unauthorized - You can only update your own profile");
    }

    const previousState = JSON.stringify(userToUpdate);

    const updateData: any = {};

    if (args.name !== undefined) updateData.name = args.name;
    if (args.email !== undefined) updateData.email = args.email;
    if (args.phone !== undefined) updateData.phone = args.phone;
    if (args.profile_image !== undefined)
      updateData.profile_image = args.profile_image;
    if (args.gender !== undefined) updateData.gender = args.gender;
    if (args.grade !== undefined) updateData.grade = args.grade;
    if (args.date_of_birth !== undefined)
      updateData.date_of_birth = args.date_of_birth;
    if (args.position !== undefined) updateData.position = args.position;

    if (currentUser.role === "admin") {
      if (args.role !== undefined) updateData.role = args.role;
      if (args.status !== undefined) updateData.status = args.status;
      if (args.school_id !== undefined) updateData.school_id = args.school_id;
    }

    const updatedUserId = await ctx.db.patch(args.id, updateData);

    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: currentUser._id,
      action: "user_updated",
      resource_type: "users",
      resource_id: args.id,
      description: `Updated user ${userToUpdate.name}`,
      previous_state: previousState,
      new_state: JSON.stringify({ ...userToUpdate, ...updateData }),
    });
    return updatedUserId;
  },
});

/**
 * Delete a user
 * Accessible by admin only
 */
export const deleteUser = mutation({
  args: {
    id: v.id("users"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const email = identity?.email;

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (!currentUser || currentUser.role !== "admin") {
      throw new Error("Unauthorized - Admin access required");
    }

    const userToDelete = await ctx.db.get(args.id);
    if (!userToDelete) {
      throw new Error("User not found");
    }

    const previousState = JSON.stringify(userToDelete);

    await ctx.db.delete(args.id);


    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: currentUser._id,
      action: "user_deleted",
      resource_type: "users",
      resource_id: args.id,
      description: `Deleted user ${userToDelete.name}`,
      previous_state: previousState,
    });

    return true;
  },
});