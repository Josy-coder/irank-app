import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";

const leagueType = v.union(
  v.literal("Local"),
  v.literal("International"),
  v.literal("Dreams Mode")
);

const statusType = v.union(
  v.literal("active"),
  v.literal("inactive"),
  v.literal("banned")
);

/**
 * Get a league by ID
 * Accessible by all users
 */
export const getLeague = query({
  args: {
    id: v.id("leagues")
  },
  handler: async (ctx, args) => {
    const league = await ctx.db.get(args.id);

    if (!league) {
      return null;
    }

    return league;
  },
});

/**
 * Get leagues with pagination and search
 * Accessible by all users
 */
export const getLeagues = query({
  args: {
    search: v.optional(v.string()),
    type: v.optional(leagueType),
    status: v.optional(statusType),
    page: v.number(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const baseQuery = ctx.db.query("leagues");

    let filteredQuery;

    if (args.type) {
      filteredQuery = baseQuery.withIndex("by_type", (q) =>
        q.eq("type", args.type ?? "Local")
      );
    } else if (args.status) {
      filteredQuery = baseQuery.withIndex("by_status", (q) =>
        q.eq("status", args.status ?? "active")
      );
    } else {
      filteredQuery = baseQuery;
    }

    if (args.search && args.search.trim() !== "") {
      const searchQuery = baseQuery.withSearchIndex("search_leagues", (q) =>
        q.search("name", args.search ?? "")
      );

      const paginatedLeagues = await searchQuery
        .paginate({
          numItems: args.limit,
          cursor: args.page > 1 ? String(args.page) : null
        });

      return {
        leagues: paginatedLeagues.page,
        totalCount: paginatedLeagues.page.length,
        hasMore: paginatedLeagues.continueCursor !== null,
        nextPage: paginatedLeagues.continueCursor
      };
    } else {
      const finalQuery = filteredQuery;
      const totalCount = await finalQuery.collect();

      const paginatedLeagues = await finalQuery
        .order("desc")
        .paginate({
          numItems: args.limit,
          cursor: args.page > 1 ? String(args.page) : null
        });

      return {
        leagues: paginatedLeagues.page,
        totalCount: totalCount.length,
        hasMore: paginatedLeagues.continueCursor !== null,
        nextPage: paginatedLeagues.continueCursor
      };
    }
  },
});

/**
 * Create a new league
 * Accessible by admin only
 */
export const createLeague = mutation({
  args: {
    name: v.string(),
    type: leagueType,
    description: v.optional(v.string()),
    geographic_scope: v.optional(v.object({})),
    logo: v.optional(v.id("_storage")),
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

    const leagueId = await ctx.db.insert("leagues", {
      name: args.name,
      type: args.type,
      description: args.description,
      geographic_scope: args.geographic_scope,
      created_by: currentUser._id,
      logo: args.logo,
      status: args.status || "active",
    });

    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: currentUser._id,
      action: "league_created",
      resource_type: "leagues",
      resource_id: leagueId,
      description: `Created league ${args.name}`,
      new_state: JSON.stringify(args),
    });

    return leagueId;
  },
});

/**
 * Update a league
 * Accessible by admin only
 */
export const updateLeague = mutation({
  args: {
    id: v.id("leagues"),
    name: v.optional(v.string()),
    type: v.optional(leagueType),
    description: v.optional(v.string()),
    geographic_scope: v.optional(v.object({})),
    logo: v.optional(v.id("_storage")),
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

    const leagueToUpdate = await ctx.db.get(args.id);
    if (!leagueToUpdate) {
      throw new Error("League not found");
    }

    const previousState = JSON.stringify(leagueToUpdate);

    const updateData: any = {};

    if (args.name !== undefined) updateData.name = args.name;
    if (args.type !== undefined) updateData.type = args.type;
    if (args.description !== undefined) updateData.description = args.description;
    if (args.geographic_scope !== undefined) updateData.geographic_scope = args.geographic_scope;
    if (args.logo !== undefined) updateData.logo = args.logo;
    if (args.status !== undefined) updateData.status = args.status;

    const updatedLeagueId = await ctx.db.patch(args.id, updateData);

    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: currentUser._id,
      action: "league_updated",
      resource_type: "leagues",
      resource_id: args.id,
      description: `Updated league ${leagueToUpdate.name}`,
      previous_state: previousState,
      new_state: JSON.stringify({...leagueToUpdate, ...updateData}),
    });

    return updatedLeagueId;
  },
});

/**
 * Delete a league
 * Accessible by admin only
 */
export const deleteLeague = mutation({
  args: {
    id: v.id("leagues"),
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

    const leagueToDelete = await ctx.db.get(args.id);
    if (!leagueToDelete) {
      throw new Error("League not found");
    }

    const associatedTournaments = await ctx.db
      .query("tournaments")
      .withIndex("by_league_id", (q) => q.eq("league_id", args.id))
      .first();

    if (associatedTournaments) {
      throw new Error("Cannot delete league with associated tournaments");
    }

    const previousState = JSON.stringify(leagueToDelete);

    await ctx.db.delete(args.id);

    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: currentUser._id,
      action: "league_deleted",
      resource_type: "leagues",
      resource_id: args.id,
      description: `Deleted league ${leagueToDelete.name}`,
      previous_state: previousState,
    });

    return true;
  },
});