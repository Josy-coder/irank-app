import { internalMutation, query } from "../_generated/server";
import { v } from "convex/values";

const actionType = v.union(
  v.literal("user_created"),
  v.literal("user_updated"),
  v.literal("user_deleted"),
  v.literal("school_created"),
  v.literal("school_updated"),
  v.literal("school_deleted"),
  v.literal("league_created"),
  v.literal("league_updated"),
  v.literal("league_deleted"),
  v.literal("tournament_created"),
  v.literal("tournament_updated"),
  v.literal("tournament_deleted"),
  v.literal("tournament_published"),
  v.literal("team_created"),
  v.literal("team_updated"),
  v.literal("team_deleted"),
  v.literal("debate_created"),
  v.literal("debate_updated"),
  v.literal("debate_deleted"),
  v.literal("ballot_submitted"),
  v.literal("payment_processed"),
  v.literal("system_setting_changed")
);

type ActionType =
  | "user_created"
  | "user_updated"
  | "user_deleted"
  | "school_created"
  | "school_updated"
  | "school_deleted"
  | "league_created"
  | "league_updated"
  | "league_deleted"
  | "tournament_created"
  | "tournament_updated"
  | "tournament_deleted"
  | "tournament_published"
  | "team_created"
  | "team_updated"
  | "team_deleted"
  | "debate_created"
  | "debate_updated"
  | "debate_deleted"
  | "ballot_submitted"
  | "payment_processed"
  | "system_setting_changed";

/**
 * Create an audit log entry
 * This is an internal mutation that can only be called by other server functions
 */
export const createAuditLog = internalMutation({
  args: {
    user_id: v.id("users"),
    action: actionType,
    resource_type: v.string(),
    resource_id: v.string(),
    description: v.string(),
    previous_state: v.optional(v.string()),
    new_state: v.optional(v.string()),
    ip_address: v.optional(v.string()),
    user_agent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("audit_logs", {
      user_id: args.user_id,
      action: args.action,
      resource_type: args.resource_type,
      resource_id: args.resource_id,
      description: args.description,
      previous_state: args.previous_state,
      new_state: args.new_state,
      ip_address: args.ip_address,
      user_agent: args.user_agent,
      timestamp: Date.now(),
    });
  },
});

/**
 * Get audit logs with pagination and filtering
 * Accessible by admin only
 */
export const getAuditLogs = query({
  args: {
    search: v.optional(v.string()),
    user_id: v.id("users"),
    action: v.optional(v.string()),
    resource_type: v.optional(v.string()),
    resource_id: v.optional(v.string()),
    start_date: v.optional(v.number()),
    end_date: v.optional(v.number()),
    page: v.number(),
    limit: v.number(),
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

    const baseQuery = ctx.db.query("audit_logs");

    let filteredQuery;

    if (args.user_id) {
      filteredQuery = baseQuery.withIndex("by_user_id", (q) =>
        q.eq("user_id", args.user_id)
      );
    } else if (args.action && args.action.trim() !== "") {
      filteredQuery = baseQuery.withIndex("by_action", (q) =>
        q.eq("action", args.action as any)
      );
    } else if (args.resource_type && args.resource_id) {
      filteredQuery = baseQuery.withIndex("by_resource", (q) =>
        q.eq("resource_type", args.resource_type ?? "").eq("resource_id", args.resource_id ?? "")
      );
    } else if (args.start_date || args.end_date) {
      filteredQuery = baseQuery.withIndex("by_timestamp", (q) => {
        if (args.start_date && args.end_date) {
          return q.gte("timestamp", args.start_date).lte("timestamp", args.end_date);
        } else if (args.start_date) {
          return q.gte("timestamp", args.start_date);
        } else {
          return q.lte("timestamp", args.end_date!);
        }
      });
    } else {
      filteredQuery = baseQuery;
    }

    const orderedQuery = filteredQuery.order("desc");

    if (args.search && args.search.trim() !== "") {
      const searchQuery = ctx.db.query("audit_logs")
        .withSearchIndex("search_audit_logs", (q) =>
          q.search("description", args.search || "")
        )

      const paginatedLogs = await searchQuery.paginate({
        numItems: args.limit,
        cursor: args.page > 1 ? String(args.page) : null
      });

      return {
        logs: paginatedLogs.page,
        totalCount: paginatedLogs.page.length,
        hasMore: paginatedLogs.continueCursor !== null,
        nextPage: paginatedLogs.continueCursor
      };
    } else {
      const totalCount = await orderedQuery.collect();

      const paginatedLogs = await orderedQuery.paginate({
        numItems: args.limit,
        cursor: args.page > 1 ? String(args.page) : null
      });

      return {
        logs: paginatedLogs.page,
        totalCount: totalCount.length,
        hasMore: paginatedLogs.continueCursor !== null,
        nextPage: paginatedLogs.continueCursor
      };
    }
  },
});