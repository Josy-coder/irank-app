import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

const schoolType = v.union(
  v.literal("Private"),
  v.literal("Public"),
  v.literal("Government Aided"),
  v.literal("International")
);

const statusType = v.union(
  v.literal("active"),
  v.literal("inactive"),
  v.literal("banned")
);

/**
 * Get a school by ID
 * Accessible by all users
 */
export const getSchool = query({
  args: {
    id: v.id("schools")
  },
  handler: async (ctx, args) => {
    const school = await ctx.db.get(args.id);

    if (!school) {
      return null;
    }

    return school;
  },
});

/**
 * Get schools with pagination and search
 * This is public (no auth required) since it's used during signup
 */
export const getSchools = query({
  args: {
    search: v.optional(v.string()),
    type: v.optional(schoolType),
    country: v.optional(v.string()),
    province: v.optional(v.string()),
    status: v.optional(statusType),
    page: v.number(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const baseQuery = ctx.db.query("schools");

    let filteredQuery;

    if (args.type) {
      filteredQuery = baseQuery.withIndex("by_type_status", (q) =>
        q.eq("type", args.type ?? "Public").eq("status", "active")
      );
    } else {
      filteredQuery = baseQuery.withIndex("by_status", (q) =>
        q.eq("status", args.status || "active")
      );
    }

    let locationFilteredQuery = filteredQuery;

    if (args.country) {
      if (args.province) {
        locationFilteredQuery = baseQuery.withIndex("by_country_province", (q) =>
          q.eq("country", args.country ?? "Rwanda").eq("province", args.province)
        );
      } else {
        locationFilteredQuery = baseQuery.withIndex("by_country", (q) =>
          q.eq("country", args.country ?? "Rwanda")
        );
      }
    }

    if (args.search && args.search.trim() !== "") {
      const searchQuery = baseQuery.withSearchIndex("search_schools", (q) =>
        q.search("name", args.search ?? "")
      );

      const totalCount = await searchQuery.collect();

      const paginatedSchools = await searchQuery
        .paginate({
          numItems: args.limit,
          cursor: args.page > 1 ? String(args.page) : null
        });

      return {
        schools: paginatedSchools.page,
        totalCount: totalCount.length,
        hasMore: paginatedSchools.continueCursor !== null,
        nextPage: paginatedSchools.continueCursor
      };
    } else {
      const finalQuery = locationFilteredQuery || filteredQuery;
      const totalCount = await finalQuery.collect();

      const paginatedSchools = await finalQuery
        .order("desc")
        .paginate({
          numItems: args.limit,
          cursor: args.page > 1 ? String(args.page) : null
        });

      return {
        schools: paginatedSchools.page,
        totalCount: totalCount.length,
        hasMore: paginatedSchools.continueCursor !== null,
        nextPage: paginatedSchools.continueCursor
      };
    }
  },
});

/**
 * Create a new school
 * Accessible by admin only
 */
export const createSchool = mutation({
  args: {
    name: v.string(),
    type: schoolType,
    country: v.string(),
    province: v.optional(v.string()),
    district: v.optional(v.string()),
    sector: v.optional(v.string()),
    contact_name: v.string(),
    contact_email: v.string(),
    contact_phone: v.optional(v.string()),
    logo_url: v.optional(v.id("_storage")),
    status: v.optional(statusType),
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

    const schoolId = await ctx.db.insert("schools", {
      name: args.name,
      type: args.type,
      country: args.country,
      province: args.province,
      district: args.district,
      sector: args.sector,
      contact_name: args.contact_name,
      contact_email: args.contact_email,
      contact_phone: args.contact_phone,
      logo_url: args.logo_url,
      status: args.status || "active",
    });

    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: currentUser._id,
      action: "school_created",
      resource_type: "schools",
      resource_id: schoolId,
      description: `Created school ${args.name}`,
      new_state: JSON.stringify(args),
    });

    return schoolId;
  },
});

/**
 * Update a school
 * Accessible by admin or school_admin for their school
 */
export const updateSchool = mutation({
  args: {
    id: v.id("schools"),
    name: v.optional(v.string()),
    type: v.optional(schoolType),
    country: v.optional(v.string()),
    province: v.optional(v.string()),
    district: v.optional(v.string()),
    sector: v.optional(v.string()),
    contact_name: v.optional(v.string()),
    contact_email: v.optional(v.string()),
    contact_phone: v.optional(v.string()),
    logo_url: v.optional(v.id("_storage")),
    status: v.optional(statusType),
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

    const schoolToUpdate = await ctx.db.get(args.id);
    if (!schoolToUpdate) {
      throw new Error("School not found");
    }

    if (currentUser.role === "school_admin") {
      if (currentUser.school_id !== args.id) {
        throw new Error("Unauthorized - You can only update your own school");
      }

      if (args.status !== undefined || args.type !== undefined) {
        throw new Error("Unauthorized - Only admin can update school status or type");
      }
    } else if (currentUser.role !== "admin") {
      throw new Error("Unauthorized - Admin or school admin access required");
    }

    const previousState = JSON.stringify(schoolToUpdate);

    const updateData: any = {};

    if (args.name !== undefined) updateData.name = args.name;
    if (args.country !== undefined) updateData.country = args.country;
    if (args.province !== undefined) updateData.province = args.province;
    if (args.district !== undefined) updateData.district = args.district;
    if (args.sector !== undefined) updateData.sector = args.sector;
    if (args.contact_name !== undefined) updateData.contact_name = args.contact_name;
    if (args.contact_email !== undefined) updateData.contact_email = args.contact_email;
    if (args.contact_phone !== undefined) updateData.contact_phone = args.contact_phone;
    if (args.logo_url !== undefined) updateData.logo_url = args.logo_url;

    if (currentUser.role === "admin") {
      if (args.type !== undefined) updateData.type = args.type;
      if (args.status !== undefined) updateData.status = args.status;
    }

    const updatedSchoolId = await ctx.db.patch(args.id, updateData);

    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: currentUser._id,
      action: "school_updated",
      resource_type: "schools",
      resource_id: args.id,
      description: `Updated school ${schoolToUpdate.name}`,
      previous_state: previousState,
      new_state: JSON.stringify({...schoolToUpdate, ...updateData}),
    });

    return updatedSchoolId;
  },
});

/**
 * Delete a school
 * Accessible by admin only
 */
export const deleteSchool = mutation({
  args: {
    id: v.id("schools"),
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

    const schoolToDelete = await ctx.db.get(args.id);
    if (!schoolToDelete) {
      throw new Error("School not found");
    }

    const previousState = JSON.stringify(schoolToDelete);

    await ctx.db.delete(args.id);

    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: currentUser._id,
      action: "school_deleted",
      resource_type: "schools",
      resource_id: args.id,
      description: `Deleted school ${schoolToDelete.name}`,
      previous_state: previousState,
    });

    return true;
  },
});