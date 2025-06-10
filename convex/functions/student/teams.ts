import { mutation } from "../../_generated/server";
import { v } from "convex/values";
import { internal } from "../../_generated/api";

export const joinTeamByCode = mutation({
  args: {
    token: v.string(),
    invitation_code: v.string(),
  },
  handler: async (ctx, args) => {
    const sessionResult = await ctx.runMutation(internal.functions.auth.verifySession, {
      token: args.token,
    });

    if (!sessionResult.user || !sessionResult.valid) {
      throw new Error("Authentication required");
    }

    const user = sessionResult.user;

    if (user.role !== "student") {
      throw new Error("Only students can join teams via invitation code");
    }

    const team = await ctx.db
      .query("teams")
      .withIndex("by_invitation_code", (q) => q.eq("invitation_code", args.invitation_code))
      .first();

    if (!team) {
      throw new Error("Invalid invitation code");
    }

    if (team.status !== "active") {
      throw new Error("This team is no longer accepting members");
    }

    if (team.members.includes(user.id)) {
      throw new Error("You are already a member of this team");
    }

    const tournament = await ctx.db.get(team.tournament_id);
    if (!tournament) {
      throw new Error("Tournament not found");
    }

    if (team.members.length >= tournament.team_size) {
      throw new Error("Team is already full");
    }

    let league = null;
    if (tournament.league_id) {
      league = await ctx.db.get(tournament.league_id);
    }

    if (league && league.type !== "Dreams Mode") {
      throw new Error("Students can only join teams in Dreams Mode tournaments");
    }

    const existingTeam = await ctx.db
      .query("teams")
      .withIndex("by_tournament_id", (q) => q.eq("tournament_id", team.tournament_id))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect()
      .then(teams => teams.find(t => t.members.includes(user.id)));

    if (existingTeam) {
      throw new Error("You are already part of another team in this tournament");
    }

    const updatedMembers = [...team.members, user.id];

    await ctx.db.patch(team._id, {
      members: updatedMembers,
      updated_at: Date.now(),
    });

    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: user.id,
      action: "team_updated",
      resource_type: "teams",
      resource_id: team._id,
      description: `Student ${user.name} joined team ${team.name}`,
    });

    return { success: true, team_name: team.name };
  },
});
