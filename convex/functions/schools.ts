// convex/functions/schools.ts
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
 * Get schools with pagination and search (PUBLIC - no auth required)
 * Used for student signup school selection
 */
export const getSchools = query({
  args: {
    search: v.optional(v.string()),
    type: v.optional(schoolType),
    country: v.optional(v.string()),
    province: v.optional(v.string()),
    status: v.optional(statusType),
    verified: v.optional(v.boolean()),
    page: v.number(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const baseQuery = ctx.db.query("schools");

    let filteredQuery;

    const effectiveStatus = args.status || "active";
    const effectiveVerified = args.verified !== undefined ? args.verified : true;

    if (args.type) {
      filteredQuery = baseQuery.withIndex("by_type_status", (q) =>
        q.eq("type", args.type).eq("status", effectiveStatus)
      );
    } else {
      filteredQuery = baseQuery.withIndex("by_status", (q) =>
        q.eq("status", effectiveStatus)
      );
    }

    if (effectiveVerified !== undefined) {
      filteredQuery = baseQuery.withIndex("by_verified", (q) =>
        q.eq("verified", effectiveVerified)
      );
    }

    let locationFilteredQuery = filteredQuery;

    if (args.country) {
      if (args.province) {
        locationFilteredQuery = baseQuery.withIndex("by_country_province", (q) =>
          q.eq("country", args.country).eq("province", args.province)
        );
      } else {
        locationFilteredQuery = baseQuery.withIndex("by_country", (q) =>
          q.eq("country", args.country)
        );
      }
    }

    if (args.search && args.search.trim() !== "") {
      const searchQuery = baseQuery.withSearchIndex("search_schools", (q) =>
        q.search("name", args.search || "")
          .eq("status", effectiveStatus)
          .eq("verified", effectiveVerified)
      );

      const paginatedSchools = await searchQuery
        .paginate({
          numItems: args.limit,
          cursor: args.page > 1 ? String(args.page) : null
        });

      return {
        schools: paginatedSchools.page,
        totalCount: paginatedSchools.page.length,
        hasMore: paginatedSchools.continueCursor !== null,
        nextPage: paginatedSchools.continueCursor
      };
    } else {
      const finalQuery = locationFilteredQuery || filteredQuery;

      // Add status and verified filters to the final query
      const filteredResults = await finalQuery
        .filter(q =>
          q.and(
            q.eq(q.field("status"), effectiveStatus),
            q.eq(q.field("verified"), effectiveVerified)
          )
        )
        .collect();

      const totalCount = filteredResults.length;

      const paginatedSchools = await finalQuery
        .filter(q =>
          q.and(
            q.eq(q.field("status"), effectiveStatus),
            q.eq(q.field("verified"), effectiveVerified)
          )
        )
        .order("desc")
        .paginate({
          numItems: args.limit,
          cursor: args.page > 1 ? String(args.page) : null
        });

      return {
        schools: paginatedSchools.page,
        totalCount: totalCount,
        hasMore: paginatedSchools.continueCursor !== null,
        nextPage: paginatedSchools.continueCursor
      };
    }
  },
});

/**
 * Get schools for admin with all filters
 */
export const getSchoolsForAdmin = query({
  args: {
    search: v.optional(v.string()),
    type: v.optional(schoolType),
    country: v.optional(v.string()),
    province: v.optional(v.string()),
    status: v.optional(statusType),
    verified: v.optional(v.boolean()),
    page: v.number(),
    limit: v.number(),
    admin_token: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify admin session
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySession, {
      token: args.admin_token,
    });

    if (!sessionResult.valid || sessionResult.user.role !== "admin") {
      throw new Error("Admin access required");
    }

    const baseQuery = ctx.db.query("schools");

    let filteredQuery;

    if (args.status && args.type) {
      filteredQuery = baseQuery.withIndex("by_type_status", (q) =>
        q.eq("type", args.type).eq("status", args.status)
      );
    } else if (args.status) {
      filteredQuery = baseQuery.withIndex("by_status", (q) =>
        q.eq("status", args.status)
      );
    } else if (args.verified !== undefined) {
      filteredQuery = baseQuery.withIndex("by_verified", (q) =>
        q.eq("verified", args.verified)
      );
    } else {
      filteredQuery = baseQuery;
    }

    if (args.search && args.search.trim() !== "") {
      const searchQuery = baseQuery.withSearchIndex("search_schools", (q) => {
        let query = q.search("name", args.search || "");
        if (args.status) query = query.eq("status", args.status);
        if (args.type) query = query.eq("type", args.type);
        if (args.verified !== undefined) query = query.eq("verified", args.verified);
        return query;
      });

      const paginatedSchools = await searchQuery
        .paginate({
          numItems: args.limit,
          cursor: args.page > 1 ? String(args.page) : null
        });

      // Get created_by user info for each school
      const schoolsWithCreators = await Promise.all(
        paginatedSchools.page.map(async (school) => {
          let creator = null;
          if (school.created_by) {
            creator = await ctx.db.get(school.created_by);
          }

          return {
            ...school,
            creator: creator ? {
              id: creator._id,
              name: creator.name,
              email: creator.email,
            } : null,
          };
        })
      );

      return {
        schools: schoolsWithCreators,
        totalCount: paginatedSchools.page.length,
        hasMore: paginatedSchools.continueCursor !== null,
        nextPage: paginatedSchools.continueCursor
      };
    } else {
      const totalCount = await filteredQuery.collect();

      const paginatedSchools = await filteredQuery
        .order("desc")
        .paginate({
          numItems: args.limit,
          cursor: args.page > 1 ? String(args.page) : null
        });

      // Get created_by user info for each school
      const schoolsWithCreators = await Promise.all(
        paginatedSchools.page.map(async (school) => {
          let creator = null;
          if (school.created_by) {
            creator = await ctx.db.get(school.created_by);
          }

          return {
            ...school,
            creator: creator ? {
              id: creator._id,
              name: creator.name,
              email: creator.email,
            } : null,
          };
        })
      );

      return {
        schools: schoolsWithCreators,
        totalCount: totalCount.length,
        hasMore: paginatedSchools.continueCursor !== null,
        nextPage: paginatedSchools.continueCursor
      };
    }
  },
});

/**
 * Create a new school (admin only)
 */
export const createSchool = mutation({
  args: {
    name: v.string(),
    type: schoolType,
    country: v.string(),
    province: v.optional(v.string()),
    district: v.optional(v.string()),
    sector: v.optional(v.string()),
    cell: v.optional(v.string()),
    village: v.optional(v.string()),
    contact_name: v.string(),
    contact_email: v.string(),
    contact_phone: v.optional(v.string()),
    logo_url: v.optional(v.id("_storage")),
    status: v.optional(statusType),
    verified: v.optional(v.boolean()),
    admin_token: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify admin session
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySession, {
      token: args.admin_token,
    });

    if (!sessionResult.valid || sessionResult.user.role !== "admin") {
      throw new Error("Admin access required");
    }

    const now = Date.now();

    const schoolId = await ctx.db.insert("schools", {
      name: args.name,
      type: args.type,
      country: args.country,
      province: args.province,
      district: args.district,
      sector: args.sector,
      cell: args.cell,
      village: args.village,
      contact_name: args.contact_name,
      contact_email: args.contact_email,
      contact_phone: args.contact_phone,
      logo_url: args.logo_url,
      status: args.status || "active",
      verified: args.verified || true, // Admin created schools are auto-verified
      created_at: now,
    });

    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: sessionResult.user.id,
      action: "school_created",
      resource_type: "schools",
      resource_id: schoolId,
      description: `Admin created school ${args.name}`,
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
    cell: v.optional(v.string()),
    village: v.optional(v.string()),
    contact_name: v.optional(v.string()),
    contact_email: v.optional(v.string()),
    contact_phone: v.optional(v.string()),
    logo_url: v.optional(v.id("_storage")),
    status: v.optional(statusType),
    verified: v.optional(v.boolean()),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify session
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySession, {
      token: args.token,
    });

    if (!sessionResult.valid) {
      throw new Error("Authentication required");
    }

    const schoolToUpdate = await ctx.db.get(args.id);
    if (!schoolToUpdate) {
      throw new Error("School not found");
    }

    // Check permissions
    if (sessionResult.user.role === "school_admin") {
      // School admin can only update their own school
      if (sessionResult.user.school_id !== args.id) {
        throw new Error("You can only update your own school");
      }

      // School admins cannot update status or verification
      if (args.status !== undefined || args.verified !== undefined) {
        throw new Error("Only administrators can update school status or verification");
      }
    } else if (sessionResult.user.role !== "admin") {
      throw new Error("Admin or school admin access required");
    }

    const now = Date.now();
    const previousState = JSON.stringify(schoolToUpdate);

    const updateData: any = {
      updated_at: now,
    };

    if (args.name !== undefined) updateData.name = args.name;
    if (args.country !== undefined) updateData.country = args.country;
    if (args.province !== undefined) updateData.province = args.province;
    if (args.district !== undefined) updateData.district = args.district;
    if (args.sector !== undefined) updateData.sector = args.sector;
    if (args.cell !== undefined) updateData.cell = args.cell;
    if (args.village !== undefined) updateData.village = args.village;
    if (args.contact_name !== undefined) updateData.contact_name = args.contact_name;
    if (args.contact_email !== undefined) updateData.contact_email = args.contact_email;
    if (args.contact_phone !== undefined) updateData.contact_phone = args.contact_phone;
    if (args.logo_url !== undefined) updateData.logo_url = args.logo_url;

    // Only admin can update these fields
    if (sessionResult.user.role === "admin") {
      if (args.type !== undefined) updateData.type = args.type;
      if (args.status !== undefined) updateData.status = args.status;
      if (args.verified !== undefined) updateData.verified = args.verified;
    }

    await ctx.db.patch(args.id, updateData);

    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: sessionResult.user.id,
      action: "school_updated",
      resource_type: "schools",
      resource_id: args.id,
      description: `Updated school ${schoolToUpdate.name}`,
      previous_state: previousState,
      new_state: JSON.stringify({...schoolToUpdate, ...updateData}),
    });

    return args.id;
  },
});

/**
 * Delete a school (admin only)
 */
export const deleteSchool = mutation({
  args: {
    id: v.id("schools"),
    admin_token: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify admin session
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySession, {
      token: args.admin_token,
    });

    if (!sessionResult.valid || sessionResult.user.role !== "admin") {
      throw new Error("Admin access required");
    }

    const schoolToDelete = await ctx.db.get(args.id);
    if (!schoolToDelete) {
      throw new Error("School not found");
    }

    // Check if school has associated users
    const associatedUsers = await ctx.db
      .query("users")
      .withIndex("by_school_id", (q) => q.eq("school_id", args.id))
      .first();

    if (associatedUsers) {
      throw new Error("Cannot delete school with associated users. Please transfer or remove users first.");
    }

    // Check if school has associated teams
    const associatedTeams = await ctx.db
      .query("teams")
      .withIndex("by_school_id", (q) => q.eq("school_id", args.id))
      .first();

    if (associatedTeams) {
      throw new Error("Cannot delete school with associated teams. Please remove teams first.");
    }

    const previousState = JSON.stringify(schoolToDelete);

    await ctx.db.delete(args.id);

    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: sessionResult.user.id,
      action: "school_deleted",
      resource_type: "schools",
      resource_id: args.id,
      description: `Deleted school ${schoolToDelete.name}`,
      previous_state: previousState,
    });

    return true;
  },
});

/**
 * Approve school (admin only)
 */
export const approveSchool = mutation({
  args: {
    id: v.id("schools"),
    admin_token: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify admin session
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySession, {
      token: args.admin_token,
    });

    if (!sessionResult.valid || sessionResult.user.role !== "admin") {
      throw new Error("Admin access required");
    }

    const school = await ctx.db.get(args.id);
    if (!school) {
      throw new Error("School not found");
    }

    const now = Date.now();

    await ctx.db.patch(args.id, {
      verified: true,
      status: "active",
      updated_at: now,
    });

    if (school.created_by) {
      const schoolAdmin = await ctx.db.get(school.created_by);
      if (schoolAdmin && !schoolAdmin.verified) {
        await ctx.db.patch(school.created_by, {
          verified: true,
          status: "active",
        });

        // Create notification for school admin
        await ctx.db.insert("notifications", {
          user_id: school.created_by,
          title: "School Approved",
          message: `Your school "${school.name}" has been approved by an administrator.`,
          type: "system",
          is_read: false,
          expires_at: now + (30 * 24 * 60 * 60 * 1000),
          created_at: now,
        });
      }
    }

    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: sessionResult.user.id,
      action: "school_updated",
      resource_type: "schools",
      resource_id: args.id,
      description: `Admin approved school ${school.name}`,
    });

    return true;
  },
});

/**
 * Get schools for combobox selection (optimized for search)
 */
export const getSchoolsForSelection = query({
  args: {
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    const search = args.search?.trim() || "";

    if (search.length < 2) {
      // Return top schools by name when no search
      const schools = await ctx.db
        .query("schools")
        .withIndex("by_verified", (q) => q.eq("verified", true))
        .filter(q => q.eq(q.field("status"), "active"))
        .order("asc")
        .take(limit);

      return schools.map(school => ({
        id: school._id,
        name: school.name,
        type: school.type,
        location: [school.district, school.province, school.country]
          .filter(Boolean)
          .join(", "),
      }));
    }

    // Search schools by name
    const schools = await ctx.db
      .query("schools")
      .withSearchIndex("search_schools", (q) =>
        q.search("name", search)
          .eq("status", "active")
          .eq("verified", true)
      )
      .take(limit);

    return schools.map(school => ({
      id: school._id,
      name: school.name,
      type: school.type,
      location: [school.district, school.province, school.country]
        .filter(Boolean)
        .join(", "),
    }));
  },
});

/**
 * Get school statistics (admin only)
 */
export const getSchoolStatistics = query({
  args: {
    admin_token: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify admin session
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySession, {
      token: args.admin_token,
    });

    if (!sessionResult.valid || sessionResult.user.role !== "admin") {
      throw new Error("Admin access required");
    }

    // Get all schools
    const allSchools = await ctx.db.query("schools").collect();

    // Calculate statistics
    const stats = {
      total: allSchools.length,
      active: allSchools.filter(s => s.status === "active").length,
      inactive: allSchools.filter(s => s.status === "inactive").length,
      banned: allSchools.filter(s => s.status === "banned").length,
      verified: allSchools.filter(s => s.verified).length,
      pending_approval: allSchools.filter(s => !s.verified).length,
      by_type: {
        Private: allSchools.filter(s => s.type === "Private").length,
        Public: allSchools.filter(s => s.type === "Public").length,
        "Government Aided": allSchools.filter(s => s.type === "Government Aided").length,
        International: allSchools.filter(s => s.type === "International").length,
      },
      by_country: {} as Record<string, number>,
      recent_registrations: 0,
    };

    // Group by country
    allSchools.forEach(school => {
      stats.by_country[school.country] = (stats.by_country[school.country] || 0) + 1;
    });

    // Count recent registrations (last 30 days)
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    stats.recent_registrations = allSchools.filter(s =>
      s.created_at && s.created_at > thirtyDaysAgo
    ).length;

    return stats;
  },
});

/**
 * Get pending school approvals (admin only)
 */
export const getPendingSchoolApprovals = query({
  args: {
    admin_token: v.string(),
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Verify admin session
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySession, {
      token: args.admin_token,
    });

    if (!sessionResult.valid || sessionResult.user.role !== "admin") {
      throw new Error("Admin access required");
    }

    const page = args.page || 1;
    const limit = args.limit || 20;

    // Get unverified schools
    const pendingSchools = await ctx.db
      .query("schools")
      .withIndex("by_verified", (q) => q.eq("verified", false))
      .order("desc")
      .paginate({
        numItems: limit,
        cursor: page > 1 ? String(page) : null
      });

    // Get creator info for each school
    const schoolsWithCreators = await Promise.all(
      pendingSchools.page.map(async (school) => {
        let creator = null;
        if (school.created_by) {
          creator = await ctx.db.get(school.created_by);
        }

        return {
          id: school._id,
          name: school.name,
          type: school.type,
          contact_email: school.contact_email,
          contact_name: school.contact_name,
          location: [school.district, school.province, school.country]
            .filter(Boolean)
            .join(", "),
          created_at: school.created_at,
          creator: creator ? {
            id: creator._id,
            name: creator.name,
            email: creator.email,
          } : null,
        };
      })
    );

    return {
      schools: schoolsWithCreators,
      hasMore: pendingSchools.continueCursor !== null,
      nextPage: pendingSchools.continueCursor,
    };
  },
});

/**
 * Get schools by user (for school admin dashboard)
 */
export const getSchoolsByUser = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const sessionResult: any = await ctx.runQuery(internal.functions.auth.verifySession, {
      token: args.token,
    });

    if (!sessionResult.valid) {
      throw new Error("Authentication required");
    }

    if (sessionResult.user.role === "school_admin") {
      // Get user's school
      if (!sessionResult.user.school_id) {
        return [];
      }

      const school = await ctx.db.get(sessionResult.user.school_id);
      if (!school) {
        return [];
      }

      const studentCount = await ctx.db
        .query("users")
        .withIndex("by_school_id_role", (q) =>
          q.eq("school_id", school._id).eq("role", "student")
        )
        .collect()
        .then(users => users.length);

      // Get team count
      const teamCount = await ctx.db
        .query("teams")
        .withIndex("by_school_id", (q) => q.eq("school_id", school._id))
        .collect()
        .then(teams => teams.length);

      return [{
        ...school,
        student_count: studentCount,
        team_count: teamCount,
      }];
    } else if (sessionResult.user.role === "admin") {
      // Admin can see all schools
      const schools = await ctx.db
        .query("schools")
        .withIndex("by_created_by", (q) => q.eq("created_by", sessionResult.user.id))
        .collect();

      // Get counts for each school
      const schoolsWithCounts = await Promise.all(
        schools.map(async (school) => {
          const studentCount = await ctx.db
            .query("users")
            .withIndex("by_school_id_role", (q) =>
              q.eq("school_id", school._id).eq("role", "student")
            )
            .collect()
            .then(users => users.length);

          const teamCount = await ctx.db
            .query("teams")
            .withIndex("by_school_id", (q) => q.eq("school_id", school._id))
            .collect()
            .then(teams => teams.length);

          return {
            ...school,
            student_count: studentCount,
            team_count: teamCount,
          };
        })
      );

      return schoolsWithCounts;
    }

    return [];
  },
});

/**
 * Transfer school ownership (admin only)
 */
export const transferSchoolOwnership = mutation({
  args: {
    school_id: v.id("schools"),
    new_owner_id: v.id("users"),
    admin_token: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify admin session
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySession, {
      token: args.admin_token,
    });

    if (!sessionResult.valid || sessionResult.user.role !== "admin") {
      throw new Error("Admin access required");
    }

    const school = await ctx.db.get(args.school_id);
    if (!school) {
      throw new Error("School not found");
    }

    const newOwner = await ctx.db.get(args.new_owner_id);
    if (!newOwner) {
      throw new Error("New owner not found");
    }

    if (newOwner.role !== "school_admin") {
      throw new Error("New owner must be a school administrator");
    }

    const now = Date.now();

    // Update school ownership
    await ctx.db.patch(args.school_id, {
      created_by: args.new_owner_id,
      updated_at: now,
    });

    await ctx.db.patch(args.new_owner_id, {
      school_id: args.school_id,
    });

    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: sessionResult.user.id,
      action: "school_updated",
      resource_type: "schools",
      resource_id: args.school_id,
      description: `Transferred school ${school.name} ownership to ${newOwner.name}`,
    });

    await ctx.db.insert("notifications", {
      user_id: args.new_owner_id,
      title: "School Ownership Transferred",
      message: `You are now the administrator of ${school.name}.`,
      type: "system",
      is_read: false,
      expires_at: now + (30 * 24 * 60 * 60 * 1000), // 30 days
      created_at: now,
    });

    return true;
  },
});