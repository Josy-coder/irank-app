import { mutation } from "../../_generated/server";
import { v } from "convex/values";
import { internal } from "../../_generated/api";

export const createTournament = mutation({
  args: {
    admin_token: v.string(),
    name: v.string(),
    start_date: v.number(),
    end_date: v.number(),
    location: v.optional(v.string()),
    is_virtual: v.boolean(),
    league_id: v.optional(v.id("leagues")),
    format: v.union(
      v.literal("WorldSchools"),
      v.literal("BritishParliamentary"),
      v.literal("PublicForum"),
      v.literal("LincolnDouglas"),
      v.literal("OxfordStyle")
    ),
    coordinator_id: v.optional(v.id("users")),
    prelim_rounds: v.number(),
    elimination_rounds: v.number(),
    judges_per_debate: v.number(),
    team_size: v.number(),
    motions_release_time: v.optional(v.number()),
    speaking_times: v.any(),
    fee: v.optional(v.number()),
    description: v.optional(v.string()),
    image: v.optional(v.id("_storage")),
    status: v.union(
      v.literal("draft"),
      v.literal("published")
    ),
  },
  handler: async (ctx, args) => {
    const sessionResult = await ctx.runMutation(internal.functions.auth.verifySession, {
      token: args.admin_token,
    });

    if (!sessionResult.valid || sessionResult.user?.role !== "admin") {
      throw new Error("Admin access required");
    }

    const { admin_token, ...tournamentData } = args;

    if (!tournamentData.name.trim()) {
      throw new Error("Tournament name is required");
    }

    if (tournamentData.start_date >= tournamentData.end_date) {
      throw new Error("End date must be after start date");
    }

    if (tournamentData.prelim_rounds < 1) {
      throw new Error("At least 1 preliminary round is required");
    }

    if (tournamentData.judges_per_debate < 1) {
      throw new Error("At least 1 judge per debate is required");
    }

    if (tournamentData.team_size < 1) {
      throw new Error("Team size must be at least 1");
    }

    if (tournamentData.league_id) {
      const league = await ctx.db.get(tournamentData.league_id);
      if (!league) {
        throw new Error("Selected league does not exist");
      }
    }

    if (tournamentData.coordinator_id) {
      const coordinator = await ctx.db.get(tournamentData.coordinator_id);
      if (!coordinator) {
        throw new Error("Selected coordinator does not exist");
      }
    }

    const existingTournament = await ctx.db
      .query("tournaments")
      .withSearchIndex("search_tournaments", (q) => q.search("name", tournamentData.name.trim()))
      .first();

    if (existingTournament && existingTournament.name === tournamentData.name.trim()) {
      throw new Error("A tournament with this name already exists");
    }

    const tournamentId = await ctx.db.insert("tournaments", {
      ...tournamentData,
      name: tournamentData.name.trim(),
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: sessionResult.user.id,
      action: "tournament_created",
      resource_type: "tournaments",
      resource_id: tournamentId,
      description: `Created tournament: ${tournamentData.name}`,
    });

    return { tournamentId, success: true };
  },
});

export const updateTournament = mutation({
  args: {
    admin_token: v.string(),
    tournament_id: v.id("tournaments"),
    name: v.string(),
    start_date: v.number(),
    end_date: v.number(),
    location: v.optional(v.string()),
    is_virtual: v.boolean(),
    league_id: v.optional(v.id("leagues")),
    format: v.union(
      v.literal("WorldSchools"),
      v.literal("BritishParliamentary"),
      v.literal("PublicForum"),
      v.literal("LincolnDouglas"),
      v.literal("OxfordStyle")
    ),
    coordinator_id: v.optional(v.id("users")),
    prelim_rounds: v.number(),
    elimination_rounds: v.number(),
    judges_per_debate: v.number(),
    team_size: v.number(),
    motions_release_time: v.optional(v.number()),
    speaking_times: v.any(),
    fee: v.optional(v.number()),
    description: v.optional(v.string()),
    image: v.optional(v.id("_storage")),
    status: v.union(
      v.literal("draft"),
      v.literal("published"),
      v.literal("inProgress"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
  },
  handler: async (ctx, args) => {
    const sessionResult = await ctx.runMutation(internal.functions.auth.verifySession, {
      token: args.admin_token,
    });

    if (!sessionResult.valid || sessionResult.user?.role !== "admin") {
      throw new Error("Admin access required");
    }

    const { admin_token, tournament_id, ...updateData } = args;

    const existingTournament = await ctx.db.get(tournament_id);
    if (!existingTournament) {
      throw new Error("Tournament not found");
    }

    if (!updateData.name.trim()) {
      throw new Error("Tournament name is required");
    }

    if (updateData.start_date >= updateData.end_date) {
      throw new Error("End date must be after start date");
    }

    const duplicateTournament = await ctx.db
      .query("tournaments")
      .withSearchIndex("search_tournaments", (q) => q.search("name", updateData.name.trim()))
      .filter((q) => q.neq(q.field("_id"), tournament_id))
      .first();

    if (duplicateTournament && duplicateTournament.name === updateData.name.trim()) {
      throw new Error("A tournament with this name already exists");
    }

    if (updateData.league_id) {
      const league = await ctx.db.get(updateData.league_id);
      if (!league) {
        throw new Error("Selected league does not exist");
      }
    }

    if (updateData.coordinator_id) {
      const coordinator = await ctx.db.get(updateData.coordinator_id);
      if (!coordinator) {
        throw new Error("Selected coordinator does not exist");
      }
    }

    await ctx.db.patch(tournament_id, {
      ...updateData,
      name: updateData.name.trim(),
      updated_at: Date.now(),
    });

    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: sessionResult.user.id,
      action: "tournament_updated",
      resource_type: "tournaments",
      resource_id: tournament_id,
      description: `Updated tournament: ${updateData.name}`,
      previous_state: JSON.stringify({
        name: existingTournament.name,
        status: existingTournament.status,
        start_date: existingTournament.start_date,
        end_date: existingTournament.end_date,
      }),
      new_state: JSON.stringify({
        name: updateData.name,
        status: updateData.status,
        start_date: updateData.start_date,
        end_date: updateData.end_date,
      }),
    });

    return { success: true };
  },
});

export const deleteTournament = mutation({
  args: {
    admin_token: v.string(),
    tournament_id: v.id("tournaments"),
  },
  handler: async (ctx, args) => {
    const sessionResult = await ctx.runMutation(internal.functions.auth.verifySession, {
      token: args.admin_token,
    });

    if (!sessionResult.valid || sessionResult.user?.role !== "admin") {
      throw new Error("Admin access required");
    }

    const { tournament_id } = args;

    const tournament = await ctx.db.get(tournament_id);
    if (!tournament) {
      throw new Error("Tournament not found");
    }

    const teams = await ctx.db
      .query("teams")
      .withIndex("by_tournament_id", (q) => q.eq("tournament_id", tournament_id))
      .first();

    if (teams) {
      throw new Error("Cannot delete tournament that has teams. Please remove all teams first.");
    }

    const rounds = await ctx.db
      .query("rounds")
      .withIndex("by_tournament_id", (q) => q.eq("tournament_id", tournament_id))
      .first();

    if (rounds) {
      throw new Error("Cannot delete tournament that has rounds. Please remove all rounds first.");
    }

    if (tournament.image) {
      try {
        await ctx.storage.delete(tournament.image);
      } catch (error) {
        console.log("Could not delete tournament image:", error);
      }
    }

    await ctx.db.delete(tournament_id);

    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: sessionResult.user.id,
      action: "tournament_deleted",
      resource_type: "tournaments",
      resource_id: tournament_id,
      description: `Deleted tournament: ${tournament.name}`,
      previous_state: JSON.stringify({
        name: tournament.name,
        status: tournament.status,
        league_id: tournament.league_id,
      }),
    });

    return { success: true };
  },
});

export const archiveTournament = mutation({
  args: {
    admin_token: v.string(),
    tournament_id: v.id("tournaments"),
  },
  handler: async (ctx, args) => {
    const sessionResult = await ctx.runMutation(internal.functions.auth.verifySession, {
      token: args.admin_token,
    });

    if (!sessionResult.valid || sessionResult.user?.role !== "admin") {
      throw new Error("Admin access required");
    }

    const { admin_token, tournament_id } = args;

    const tournament = await ctx.db.get(tournament_id);
    if (!tournament) {
      throw new Error("Tournament not found");
    }

    const previousStatus = tournament.status;

    await ctx.db.patch(tournament_id, {
      status: "cancelled",
      updated_at: Date.now(),
    });

    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: sessionResult.user.id,
      action: "tournament_updated",
      resource_type: "tournaments",
      resource_id: tournament_id,
      description: `Archived tournament: ${tournament.name}`,
      previous_state: JSON.stringify({ status: previousStatus }),
      new_state: JSON.stringify({ status: "cancelled" }),
    });

    return { success: true };
  },
});

export const bulkUpdateTournaments = mutation({
  args: {
    admin_token: v.string(),
    tournament_ids: v.array(v.id("tournaments")),
    action: v.union(
      v.literal("archive"),
      v.literal("delete"),
      v.literal("publish"),
      v.literal("cancel")
    ),
  },
  handler: async (ctx, args) => {
    const sessionResult = await ctx.runMutation(internal.functions.auth.verifySession, {
      token: args.admin_token,
    });

    if (!sessionResult.valid || sessionResult.user?.role !== "admin") {
      throw new Error("Admin access required");
    }

    const { admin_token, tournament_ids, action } = args;

    const results = [];

    for (const tournament_id of tournament_ids) {
      try {
        const tournament = await ctx.db.get(tournament_id);
        if (!tournament) {
          results.push({
            tournament_id,
            success: false,
            error: "Tournament not found",
          });
          continue;
        }

        if (action === "delete") {
          const teams = await ctx.db
            .query("teams")
            .withIndex("by_tournament_id", (q) => q.eq("tournament_id", tournament_id))
            .first();

          if (teams) {
            results.push({
              tournament_id,
              success: false,
              error: "Cannot delete tournament that has teams",
            });
            continue;
          }

          if (tournament.image) {
            try {
              await ctx.storage.delete(tournament.image);
            } catch (error) {
              console.log("Could not delete tournament image:", error);
            }
          }

          await ctx.db.delete(tournament_id);
        } else if (action === "archive" || action === "cancel") {
          await ctx.db.patch(tournament_id, {
            status: "cancelled",
            updated_at: Date.now(),
          });
        } else if (action === "publish") {
          await ctx.db.patch(tournament_id, {
            status: "published",
            updated_at: Date.now(),
          });
        }

        await ctx.runMutation(internal.functions.audit.createAuditLog, {
          user_id: sessionResult.user.id,
          action: action === "delete" ? "tournament_deleted" : "tournament_updated",
          resource_type: "tournaments",
          resource_id: tournament_id,
          description: `Bulk ${action} tournament: ${tournament.name}`,
        });

        results.push({
          tournament_id,
          success: true,
        });
      } catch (error: any) {
        results.push({
          tournament_id,
          success: false,
          error: error.message,
        });
      }
    }

    return { results };
  },
});