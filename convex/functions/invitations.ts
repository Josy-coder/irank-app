import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

export const getUserTournamentInvitations = query({
  args: {
    tournament_id: v.id("tournaments"),
    user_id: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const { tournament_id, user_id } = args;

    let invitations = await ctx.db
      .query("tournament_invitations")
      .withIndex("by_tournament_id", (q) =>
        q.eq("tournament_id", tournament_id)
      )
      .collect();

    if (user_id) {
      invitations = invitations.filter(inv => inv.target_id === user_id);
    }

    return await Promise.all(
      invitations.map(async (invitation) => {
        const target = await ctx.db.get(invitation.target_id);
        const invitedBy = await ctx.db.get(invitation.invited_by);
        let respondedBy = null;
        if (invitation.responded_by) {
          respondedBy = await ctx.db.get(invitation.responded_by);
        }

        let school = null;
        if (target?.school_id) {
          school = await ctx.db.get(target.school_id);
        }

        return {
          ...invitation,
          target: target ? {
            ...target,
            school: school ? {
              _id: school._id,
              name: school.name,
              type: school.type,
            } : null,
          } : null,
          invited_by_user: invitedBy ? {
            _id: invitedBy._id,
            name: invitedBy.name,
          } : null,
          responded_by_user: respondedBy ? {
            _id: respondedBy._id,
            name: respondedBy.name,
          } : null,
        };
      })
    );
  },
});

export const getSchoolTournamentInvitations = query({
  args: {
    tournament_id: v.id("tournaments"),
    school_id: v.id("schools"),
  },
  handler: async (ctx, args) => {
    const { tournament_id, school_id } = args;

    const schoolUsers = await ctx.db
      .query("users")
      .withIndex("by_school_id", (q) => q.eq("school_id", school_id))
      .collect();

    const schoolUserIds = schoolUsers.map(u => u._id);


    const invitations = await ctx.db
      .query("tournament_invitations")
      .withIndex("by_tournament_id", (q) => q.eq("tournament_id", tournament_id))
      .collect();

    const schoolInvitations = invitations.filter(inv =>
      schoolUserIds.includes(inv.target_id)
    );

    return await Promise.all(
      schoolInvitations.map(async (invitation) => {
        const target = await ctx.db.get(invitation.target_id);
        const invitedBy = await ctx.db.get(invitation.invited_by);
        let respondedBy = null;
        if (invitation.responded_by) {
          respondedBy = await ctx.db.get(invitation.responded_by);
        }

        return {
          ...invitation,
          target: target ? {
            ...target,
          } : null,
          invited_by_user: invitedBy ? {
            _id: invitedBy._id,
            name: invitedBy.name,
          } : null,
          responded_by_user: respondedBy ? {
            _id: respondedBy._id,
            name: respondedBy.name,
          } : null,
        };
      })
    );
  },
});

export const updateInvitationStatus = mutation({
  args: {
    token: v.string(),
    invitation_id: v.id("tournament_invitations"),
    status: v.union(
      v.literal("accepted"),
      v.literal("declined")
    ),
  },
  handler: async (ctx, args) => {
    const sessionResult = await ctx.runMutation(internal.functions.auth.verifySession, {
      token: args.token,
    });

    if (!sessionResult.user) {
      throw new Error("Session verification failed");
    }

    if (!sessionResult.valid) {
      throw new Error("Valid session required");
    }

    const invitation = await ctx.db.get(args.invitation_id);
    if (!invitation) {
      throw new Error("Invitation not found");
    }

    const tournament = await ctx.db.get(invitation.tournament_id);
    if (!tournament) {
      throw new Error("Tournament not found");
    }
    const isAdmin = sessionResult.user.role === "admin";
    const isTargetUser = invitation.target_id === sessionResult.user.id;

    if (!isAdmin && !isTargetUser) {
      throw new Error("You can only respond to your own invitations");
    }
    if (!isAdmin && invitation.expires_at && Date.now() > invitation.expires_at) {
      throw new Error("This invitation has expired");
    }
    if (tournament.status === "completed" || tournament.status === "cancelled") {
      if (!isAdmin) {
        throw new Error("Cannot respond to invitations for completed or cancelled tournaments");
      }
    }

    await ctx.db.patch(args.invitation_id, {
      status: args.status,
      responded_by: sessionResult.user.id,
      responded_at: Date.now(),
    });

    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: sessionResult.user.id,
      action: "tournament_updated",
      resource_type: "tournament_invitations",
      resource_id: args.invitation_id,
      description: `${args.status} invitation for tournament: ${tournament.name}`,
    });

    return { success: true };
  },
});
