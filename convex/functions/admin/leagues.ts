import { mutation, MutationCtx } from "../../_generated/server";
import { v } from "convex/values";
import { internal } from "../../_generated/api";

import { Id } from "../../_generated/dataModel";

export const createLeague = mutation({
  args: {
    admin_token: v.string(),
    name: v.string(),
    type: v.union(
      v.literal("Local"),
      v.literal("International"),
      v.literal("Dreams Mode")
    ),
    description: v.optional(v.string()),
    geographic_scope: v.optional(v.any()),
    status: v.union(v.literal("active"), v.literal("inactive")),
  },
  handler: async (
    ctx: MutationCtx,
    args: {
      admin_token: string;
      name: string;
      type: "Local" | "International" | "Dreams Mode";
      description?: string;
      geographic_scope?: any;
      logo?: Id<"_storage">;
      status: "active" | "inactive";
    }
  ): Promise<{ leagueId: Id<"leagues">; success: boolean }> => {
    const sessionResult = await ctx.runMutation(internal.functions.auth.verifySession, {
      token: args.admin_token,
    });

    if (!sessionResult.valid || sessionResult.user?.role !== "admin") {
      throw new Error("Admin access required");
    }

    const { admin_token, ...leagueData } = args;

    if (!leagueData.name.trim()) {
      throw new Error("League name is required");
    }

    const existingLeague = await ctx.db
      .query("leagues")
      .withIndex("by_name", (q) => q.eq("name", leagueData.name.trim()))
      .first();

    if (existingLeague) {
      throw new Error("A league with this name already exists");
    }

    const leagueId = await ctx.db.insert("leagues", {
      name: leagueData.name.trim(),
      type: leagueData.type,
      description: leagueData.description,
      geographic_scope: leagueData.geographic_scope,
      status: leagueData.status,
      created_by: sessionResult.user.id,
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: sessionResult.user.id,
      action: "league_created",
      resource_type: "leagues",
      resource_id: leagueId,
      description: `Created league: ${leagueData.name}`,
    });

    return { leagueId, success: true };
  },
});

export const updateLeague = mutation({
  args: {
    admin_token: v.string(),
    league_id: v.id("leagues"),
    name: v.string(),
    type: v.union(
      v.literal("Local"),
      v.literal("International"),
      v.literal("Dreams Mode")
    ),
    description: v.optional(v.string()),
    geographic_scope: v.optional(v.any()),
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

    const { admin_token, league_id, ...updateData } = args;

    const existingLeague = await ctx.db.get(league_id);
    if (!existingLeague) {
      throw new Error("League not found");
    }

    if (!updateData.name.trim()) {
      throw new Error("League name is required");
    }

    const duplicateLeague = await ctx.db
      .query("leagues")
      .withIndex("by_name", (q) => q.eq("name", updateData.name.trim()))
      .filter((q) => q.neq(q.field("_id"), league_id))
      .first();

    if (duplicateLeague) {
      throw new Error("A league with this name already exists");
    }

    await ctx.db.patch(league_id, {
      name: updateData.name.trim(),
      type: updateData.type,
      description: updateData.description,
      geographic_scope: updateData.geographic_scope,
      status: updateData.status,
      updated_at: Date.now(),
    });

    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: sessionResult.user.id,
      action: "league_updated",
      resource_type: "leagues",
      resource_id: league_id,
      description: `Updated league: ${updateData.name}`,
      previous_state: JSON.stringify({
        name: existingLeague.name,
        type: existingLeague.type,
        status: existingLeague.status,
      }),
      new_state: JSON.stringify({
        name: updateData.name,
        type: updateData.type,
        status: updateData.status,
      }),
    });

    return { success: true };
  },
});

export const deleteLeague = mutation({
  args: {
    admin_token: v.string(),
    league_id: v.id("leagues"),
  },
  handler: async (ctx, args) => {
    const sessionResult = await ctx.runMutation(internal.functions.auth.verifySession, {
      token: args.admin_token,
    });

    if (!sessionResult.valid || sessionResult.user?.role !== "admin") {
      throw new Error("Admin access required");
    }

    const { league_id } = args;

    const league = await ctx.db.get(league_id);
    if (!league) {
      throw new Error("League not found");
    }

    const tournaments = await ctx.db
      .query("tournaments")
      .withIndex("by_league_id", (q) => q.eq("league_id", league_id))
      .first();

    if (tournaments) {
      throw new Error("Cannot delete league that has tournaments. Please remove all tournaments first.");
    }

    await ctx.db.delete(league_id);

    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: sessionResult.user.id,
      action: "league_deleted",
      resource_type: "leagues",
      resource_id: league_id,
      description: `Deleted league: ${league.name}`,
      previous_state: JSON.stringify({
        name: league.name,
        type: league.type,
        status: league.status,
      }),
    });

    return { success: true };
  },
});