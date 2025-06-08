import { mutation, query } from "../../_generated/server";
import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { Id } from "../../_generated/dataModel";

export const sendInvitation = mutation({
  args: {
    admin_token: v.string(),
    tournament_id: v.id("tournaments"),
    target_type: v.union(
      v.literal("school"),
      v.literal("volunteer"),
      v.literal("student")
    ),
    target_id: v.id("users"),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ success: true; invitation_id: Id<"tournament_invitations"> }> => {
    const sessionResult = await ctx.runMutation(internal.functions.auth.verifySession, {
      token: args.admin_token,
    });

    if (!sessionResult.valid || sessionResult.user?.role !== "admin") {
      throw new Error("Admin access required");
    }

    const { tournament_id, target_type, target_id } = args;

    const tournament = await ctx.db.get(tournament_id);
    if (!tournament) {
      throw new Error("Tournament not found");
    }

    if (tournament.status !== "published") {
      throw new Error("Can only send invitations for published tournaments");
    }
    const existingInvitation = await ctx.db
      .query("tournament_invitations")
      .withIndex("by_tournament_id_target_type_target_id", (q) =>
        q.eq("tournament_id", tournament_id)
          .eq("target_type", target_type)
          .eq("target_id", target_id)
      )
      .first();

    if (existingInvitation) {
      throw new Error("Invitation already exists for this participant");
    }
    const target = await ctx.db.get(target_id);
    if (!target) {
      throw new Error("Target user not found");
    }

    if (target.status !== "active" || !target.verified) {
      throw new Error("Target user must be active and verified");
    }

    if (target.role !== target_type &&
      !(target_type === "school" && target.role === "school_admin")) {
      throw new Error("Target user role does not match invitation type");
    }
    if (tournament.league_id) {
      const league = await ctx.db.get(tournament.league_id);
      if (!league) {
        throw new Error("Tournament league not found");
      }
      if (league.type === "Dreams Mode" && target_type === "school") {
        throw new Error("Schools cannot be invited to Dreams Mode tournaments");
      }
      if ((league.type === "Local" || league.type === "International") &&
        target_type === "student") {
        throw new Error("Students cannot be directly invited to Local/International tournaments");
      }
      if (target_type === "school" &&
        (league.type === "Local" || league.type === "International")) {
        const school = await ctx.db
          .query("schools")
          .filter((q) => q.eq(q.field("contact_email"), target.email))
          .first();

        if (school && league.geographic_scope) {
          const schoolCountry = school.country;
          const schoolProvince = school.province;
          const schoolDistrict = school.district;
          const schoolSector = school.sector;
          const schoolCell = school.cell;
          const schoolVillage = school.village;
          const scopeForCountry = league.geographic_scope[schoolCountry];
          if (!scopeForCountry) {
            throw new Error(`School's country (${schoolCountry}) is not within this league's geographic scope`);
          }
          if (scopeForCountry.provinces && scopeForCountry.provinces.length > 0) {
            if (!schoolProvince || !scopeForCountry.provinces.includes(schoolProvince)) {
              throw new Error(`School's province (${schoolProvince}) is not within this league's geographic scope`);
            }
          }
          if (scopeForCountry.districts && scopeForCountry.districts.length > 0) {
            if (!schoolDistrict || !scopeForCountry.districts.includes(schoolDistrict)) {
              throw new Error(`School's district (${schoolDistrict}) is not within this league's geographic scope`);
            }
          }
          if (scopeForCountry.sectors && scopeForCountry.sectors.length > 0) {
            if (!schoolSector || !scopeForCountry.sectors.includes(schoolSector)) {
              throw new Error(`School's sector (${schoolSector}) is not within this league's geographic scope`);
            }
          }
          if (scopeForCountry.cells && scopeForCountry.cells.length > 0) {
            if (!schoolCell || !scopeForCountry.cells.includes(schoolCell)) {
              throw new Error(`School's cell (${schoolCell}) is not within this league's geographic scope`);
            }
          }
          if (scopeForCountry.villages && scopeForCountry.villages.length > 0) {
            if (!schoolVillage || !scopeForCountry.villages.includes(schoolVillage)) {
              throw new Error(`School's village (${schoolVillage}) is not within this league's geographic scope`);
            }
          }
        }
      }
    }

    const invitationId = await ctx.db.insert("tournament_invitations", {
      tournament_id,
      target_type,
      target_id,
      status: "pending",
      invited_by: sessionResult.user.id,
      invited_at: Date.now(),
      expires_at: tournament.start_date,
    });
    await ctx.db.insert("notifications", {
      user_id: target_id,
      title: `Tournament Invitation: ${tournament.name}`,
      message: `You have been invited to participate in ${tournament.name}. Please respond by ${new Date(tournament.start_date).toLocaleDateString()}.`,
      type: "tournament",
      related_id: invitationId,
      is_read: false,
      expires_at: tournament.start_date + (7 * 24 * 60 * 60 * 1000),
      created_at: Date.now(),
    });

    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: sessionResult.user.id,
      action: "tournament_updated",
      resource_type: "tournament_invitations",
      resource_id: invitationId,
      description: `Sent invitation to ${target.name} for tournament: ${tournament.name}`,
    });

    return { success: true, invitation_id: invitationId };
  },
});

export const bulkSendInvitations = mutation({
  args: {
    admin_token: v.string(),
    tournament_id: v.id("tournaments"),
    invitations: v.array(
      v.object({
        target_type: v.union(
          v.literal("school"),
          v.literal("volunteer"),
          v.literal("student")
        ),
        target_id: v.id("users"),
      })
    ),
  },
  handler: async (ctx, args): Promise<{
    results: {
      target_id: Id<"users">;
      success: boolean;
      invitation_id?: Id<"tournament_invitations">;
      error?: string;
    }[];
  }> => {
    const sessionResult = await ctx.runMutation(internal.functions.auth.verifySession, {
      token: args.admin_token,
    });

    if (!sessionResult.valid || sessionResult.user?.role !== "admin") {
      throw new Error("Admin access required");
    }

    const { tournament_id, invitations } = args;

    const tournament = await ctx.db.get(tournament_id);
    if (!tournament) {
      throw new Error("Tournament not found");
    }

    if (tournament.status !== "published") {
      throw new Error("Can only send invitations for published tournaments");
    }

    let league = null;
    if (tournament.league_id) {
      league = await ctx.db.get(tournament.league_id);
    }
    const existingInvitations = await ctx.db
      .query("tournament_invitations")
      .withIndex("by_tournament_id", (q) => q.eq("tournament_id", tournament_id))
      .collect();

    const existingInvitationKeys = new Set(
      existingInvitations.map(inv => `${inv.target_type}-${inv.target_id}`)
    );

    const results = [];

    for (const invitation of invitations) {
      try {
        const { target_type, target_id } = invitation;
        const invitationKey = `${target_type}-${target_id}`;
        if (existingInvitationKeys.has(invitationKey)) {
          results.push({
            target_id,
            success: false,
            error: "Invitation already exists for this participant",
          });
          continue;
        }
        const target = await ctx.db.get(target_id);
        if (!target) {
          results.push({
            target_id,
            success: false,
            error: "Target user not found",
          });
          continue;
        }

        if (target.status !== "active" || !target.verified) {
          results.push({
            target_id,
            success: false,
            error: "Target user must be active and verified",
          });
          continue;
        }

        if (target.role !== target_type &&
          !(target_type === "school" && target.role === "school_admin")) {
          results.push({
            target_id,
            success: false,
            error: "Target user role does not match invitation type",
          });
          continue;
        }
        if (league) {
          if (league.type === "Dreams Mode" && target_type === "school") {
            results.push({
              target_id,
              success: false,
              error: "Schools cannot be invited to Dreams Mode tournaments",
            });
            continue;
          }
          if ((league.type === "Local" || league.type === "International") &&
            target_type === "student") {
            results.push({
              target_id,
              success: false,
              error: "Students cannot be directly invited to Local/International tournaments",
            });
            continue;
          }
          if (target_type === "school" &&
            (league.type === "Local" || league.type === "International")) {
            const school = await ctx.db
              .query("schools")
              .filter((q) => q.eq(q.field("contact_email"), target.email))
              .first();

            if (school && league.geographic_scope) {
              const schoolCountry = school.country;
              const schoolProvince = school.province;
              const schoolDistrict = school.district;
              const schoolSector = school.sector;
              const schoolCell = school.cell;
              const schoolVillage = school.village;
              const scopeForCountry = league.geographic_scope[schoolCountry];
              if (!scopeForCountry) {
                results.push({
                  target_id,
                  success: false,
                  error: `School's country (${schoolCountry}) is not within this league's geographic scope`,
                });
                continue;
              }
              if (scopeForCountry.provinces && scopeForCountry.provinces.length > 0) {
                if (!schoolProvince || !scopeForCountry.provinces.includes(schoolProvince)) {
                  results.push({
                    target_id,
                    success: false,
                    error: `School's province (${schoolProvince}) is not within this league's geographic scope`,
                  });
                  continue;
                }
              }
              if (scopeForCountry.districts && scopeForCountry.districts.length > 0) {
                if (!schoolDistrict || !scopeForCountry.districts.includes(schoolDistrict)) {
                  results.push({
                    target_id,
                    success: false,
                    error: `School's district (${schoolDistrict}) is not within this league's geographic scope`,
                  });
                  continue;
                }
              }
              if (scopeForCountry.sectors && scopeForCountry.sectors.length > 0) {
                if (!schoolSector || !scopeForCountry.sectors.includes(schoolSector)) {
                  results.push({
                    target_id,
                    success: false,
                    error: `School's sector (${schoolSector}) is not within this league's geographic scope`,
                  });
                  continue;
                }
              }
              if (scopeForCountry.cells && scopeForCountry.cells.length > 0) {
                if (!schoolCell || !scopeForCountry.cells.includes(schoolCell)) {
                  results.push({
                    target_id,
                    success: false,
                    error: `School's cell (${schoolCell}) is not within this league's geographic scope`,
                  });
                  continue;
                }
              }
              if (scopeForCountry.villages && scopeForCountry.villages.length > 0) {
                if (!schoolVillage || !scopeForCountry.villages.includes(schoolVillage)) {
                  results.push({
                    target_id,
                    success: false,
                    error: `School's village (${schoolVillage}) is not within this league's geographic scope`,
                  });
                  continue;
                }
              }
            }
          }
        }
        const invitationId = await ctx.db.insert("tournament_invitations", {
          tournament_id,
          target_type,
          target_id,
          status: "pending",
          invited_by: sessionResult.user.id,
          invited_at: Date.now(),
          expires_at: tournament.start_date,
        });
        await ctx.db.insert("notifications", {
          user_id: target_id,
          title: `Tournament Invitation: ${tournament.name}`,
          message: `You have been invited to participate in ${tournament.name}. Please respond by ${new Date(tournament.start_date).toLocaleDateString()}.`,
          type: "tournament",
          related_id: invitationId,
          is_read: false,
          expires_at: tournament.start_date + (7 * 24 * 60 * 60 * 1000),
          created_at: Date.now(),
        });
        existingInvitationKeys.add(invitationKey);

        await ctx.runMutation(internal.functions.audit.createAuditLog, {
          user_id: sessionResult.user.id,
          action: "tournament_updated",
          resource_type: "tournament_invitations",
          resource_id: invitationId,
          description: `Sent invitation to ${target.name} for tournament: ${tournament.name}`,
        });

        results.push({
          target_id,
          success: true,
          invitation_id: invitationId,
        });
      } catch (error: any) {
        results.push({
          target_id: invitation.target_id,
          success: false,
          error: error.message,
        });
      }
    }

    return { results };
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

export const getPotentialInvitees = query({
  args: {
    tournament_id: v.id("tournaments"),
    target_type: v.optional(v.union(
      v.literal("school"),
      v.literal("volunteer"),
      v.literal("student")
    )),
    search: v.optional(v.string()),
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { tournament_id, target_type, search, page = 1, limit = 20 } = args;

    const tournament = await ctx.db.get(tournament_id);
    if (!tournament) {
      throw new Error("Tournament not found");
    }

    let league = null;
    if (tournament.league_id) {
      league = await ctx.db.get(tournament.league_id);
    }

    const existingInvitations = await ctx.db
      .query("tournament_invitations")
      .withIndex("by_tournament_id", (q) => q.eq("tournament_id", tournament_id))
      .collect();

    const invitedUserIds = new Set(existingInvitations.map(inv => inv.target_id));

    let users = [];

    if (target_type === "volunteer" || !target_type) {
      const volunteerQuery = search
        ? ctx.db.query("users").withSearchIndex("search_users", (q) =>
          q.search("name", search).eq("role", "volunteer").eq("status", "active").eq("verified", true))
        : ctx.db.query("users").withIndex("by_role_status", (q) =>
          q.eq("role", "volunteer").eq("status", "active"));

      const volunteers = await volunteerQuery.collect();
      users.push(...volunteers.filter(u => !invitedUserIds.has(u._id)));
    }

    if (target_type === "student" || !target_type) {
      if (league?.type === "Dreams Mode") {
        const studentQuery = search
          ? ctx.db.query("users").withSearchIndex("search_users", (q) =>
            q.search("name", search).eq("role", "student").eq("status", "active").eq("verified", true))
          : ctx.db.query("users").withIndex("by_role_status", (q) =>
            q.eq("role", "student").eq("status", "active"));

        const students = await studentQuery.collect();
        users.push(...students.filter(u => !invitedUserIds.has(u._id)));
      }
    }

    if (target_type === "school" || !target_type) {
      if (!league || league.type === "Local" || league.type === "International") {
        const schoolAdminQuery = search
          ? ctx.db.query("users").withSearchIndex("search_users", (q) =>
            q.search("name", search).eq("role", "school_admin").eq("status", "active").eq("verified", true))
          : ctx.db.query("users").withIndex("by_role_status", (q) =>
            q.eq("role", "school_admin").eq("status", "active"));

        const schoolAdmins = await schoolAdminQuery.collect();
        users.push(...schoolAdmins.filter(u => !invitedUserIds.has(u._id)));
      }
    }
    if (search && !target_type) {
      users = users.filter(user =>
        user.name.toLowerCase().includes(search.toLowerCase()) ||
        user.email.toLowerCase().includes(search.toLowerCase())
      );
    }
    users.sort((a, b) => a.name.localeCompare(b.name));
    const offset = (page - 1) * limit;
    const paginatedUsers = users.slice(offset, offset + limit);
    const enrichedUsers = await Promise.all(
      paginatedUsers.map(async (user) => {
        let school = null;
        if (user.school_id) {
          school = await ctx.db.get(user.school_id);
        }

        return {
          ...user,
          school: school ? {
            _id: school._id,
            name: school.name,
            type: school.type,
          } : null,
        };
      })
    );

    return {
      users: enrichedUsers,
      totalCount: users.length,
      hasMore: offset + limit < users.length,
      page,
      limit,
    };
  },
});

export const getTournamentInvitations = query({
  args: {
    tournament_id: v.id("tournaments"),
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("declined")
    )),
    target_type: v.optional(v.union(
      v.literal("school"),
      v.literal("volunteer"),
      v.literal("student")
    )),
    search: v.optional(v.string()),
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { tournament_id, status, target_type, search, page = 1, limit = 20 } = args;

    let query = ctx.db
      .query("tournament_invitations")
      .withIndex("by_tournament_id", (q) => q.eq("tournament_id", tournament_id));

    let invitations = await query.collect();
    if (status) {
      invitations = invitations.filter(inv => inv.status === status);
    }

    if (target_type) {
      invitations = invitations.filter(inv => inv.target_type === target_type);
    }
    const enrichedInvitations = await Promise.all(
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
    let filteredInvitations = enrichedInvitations;
    if (search) {
      filteredInvitations = enrichedInvitations.filter(inv =>
        inv.target?.name.toLowerCase().includes(search.toLowerCase()) ||
        inv.target?.email.toLowerCase().includes(search.toLowerCase()) ||
        inv.target?.school?.name.toLowerCase().includes(search.toLowerCase())
      );
    }
    filteredInvitations.sort((a, b) => b.invited_at - a.invited_at);
    const offset = (page - 1) * limit;
    const paginatedInvitations = filteredInvitations.slice(offset, offset + limit);

    return {
      invitations: paginatedInvitations,
      totalCount: filteredInvitations.length,
      hasMore: offset + limit < filteredInvitations.length,
      page,
      limit,
    };
  },
});