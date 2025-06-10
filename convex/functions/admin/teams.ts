import { internalMutation, mutation, query } from "../../_generated/server";
import { v } from "convex/values";
import { internal } from "../../_generated/api";

function generateInvitationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export const createTeam = mutation({
  args: {
    admin_token: v.string(),
    tournament_id: v.id("tournaments"),
    name: v.string(),
    school_id: v.optional(v.id("schools")),
    members: v.array(v.id("users")),
    payment_status: v.optional(v.union(
      v.literal("pending"),
      v.literal("paid"),
      v.literal("waived")
    )),
  },
  handler: async (ctx, args) => {
    const sessionResult = await ctx.runMutation(internal.functions.auth.verifySession, {
      token: args.admin_token,
    });

    if (!sessionResult.valid || sessionResult.user?.role !== "admin") {
      throw new Error("Admin access required");
    }

    const { admin_token, ...teamData } = args;

    if (!teamData.name.trim()) {
      throw new Error("Team name is required");
    }

    const tournament = await ctx.db.get(teamData.tournament_id);
    if (!tournament) {
      throw new Error("Tournament not found");
    }

    let league = null;
    if (tournament.league_id) {
      league = await ctx.db.get(tournament.league_id);
    }

    let paymentStatus = teamData.payment_status || "pending";
    if (league && league.type === "Dreams Mode") {
      paymentStatus = "paid";
    }

    if (teamData.members.length > tournament.team_size) {
      throw new Error(`Team cannot have more than ${tournament.team_size} members`);
    }

    const members = await Promise.all(
      teamData.members.map(async (memberId) => {
        const member = await ctx.db.get(memberId);
        if (!member) {
          throw new Error(`Member with ID ${memberId} not found`);
        }
        if (member.role !== "student") {
          throw new Error(`User ${member.name} is not a student`);
        }
        return member;
      })
    );

    if (teamData.school_id) {
      const school = await ctx.db.get(teamData.school_id);
      if (!school) {
        throw new Error("School not found");
      }
    }

    const existingTeam = await ctx.db
      .query("teams")
      .withIndex("by_tournament_id", (q) => q.eq("tournament_id", teamData.tournament_id))
      .filter((q) => q.eq(q.field("name"), teamData.name.trim()))
      .first();

    if (existingTeam) {
      throw new Error("A team with this name already exists in this tournament");
    }

    const existingTeams = await ctx.db
      .query("teams")
      .withIndex("by_tournament_id", (q) => q.eq("tournament_id", teamData.tournament_id))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    for (const member of members) {
      const conflictingTeam = existingTeams.find(team => team.members.includes(member._id));
      if (conflictingTeam) {
        throw new Error(`${member.name} is already in team "${conflictingTeam.name}"`);
      }
    }

    let invitationCode = generateInvitationCode();
    while (await ctx.db
      .query("teams")
      .withIndex("by_invitation_code", (q) => q.eq("invitation_code", invitationCode))
      .first()) {
      invitationCode = generateInvitationCode();
    }

    const teamId = await ctx.db.insert("teams", {
      name: teamData.name.trim(),
      tournament_id: teamData.tournament_id,
      school_id: teamData.school_id,
      members: teamData.members,
      is_confirmed: true,
      payment_status: paymentStatus,
      invitation_code: invitationCode,
      status: "active",
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: sessionResult.user.id,
      action: "team_created",
      resource_type: "teams",
      resource_id: teamId,
      description: `Created team: ${teamData.name}`,
    });

    return { success: true, team_id: teamId, invitation_code: invitationCode };
  },
});

export const updateTeam = mutation({
  args: {
    admin_token: v.string(),
    team_id: v.id("teams"),
    name: v.string(),
    school_id: v.optional(v.id("schools")),
    members: v.array(v.id("users")),
    payment_status: v.union(
      v.literal("pending"),
      v.literal("paid"),
      v.literal("waived")
    ),
    status: v.union(
      v.literal("active"),
      v.literal("withdrawn"),
      v.literal("disqualified")
    ),
  },
  handler: async (ctx, args) => {
    const sessionResult = await ctx.runMutation(internal.functions.auth.verifySession, {
      token: args.admin_token,
    });

    if (!sessionResult.valid || sessionResult.user?.role !== "admin") {
      throw new Error("Admin access required");
    }

    const { admin_token, team_id, ...updateData } = args;

    const existingTeam = await ctx.db.get(team_id);
    if (!existingTeam) {
      throw new Error("Team not found");
    }

    if (!updateData.name.trim()) {
      throw new Error("Team name is required");
    }

    const tournament = await ctx.db.get(existingTeam.tournament_id);
    if (!tournament) {
      throw new Error("Tournament not found");
    }

    if (updateData.members.length > tournament.team_size) {
      throw new Error(`Team cannot have more than ${tournament.team_size} members`);
    }

    const members = await Promise.all(
      updateData.members.map(async (memberId) => {
        const member = await ctx.db.get(memberId);
        if (!member) {
          throw new Error(`Member with ID ${memberId} not found`);
        }
        if (member.role !== "student") {
          throw new Error(`User ${member.name} is not a student`);
        }
        return member;
      })
    );

    if (updateData.school_id) {
      const school = await ctx.db.get(updateData.school_id);
      if (!school) {
        throw new Error("School not found");
      }
    }

    const duplicateTeam = await ctx.db
      .query("teams")
      .withIndex("by_tournament_id", (q) => q.eq("tournament_id", existingTeam.tournament_id))
      .filter((q) => q.neq(q.field("_id"), team_id))
      .filter((q) => q.eq(q.field("name"), updateData.name.trim()))
      .first();

    if (duplicateTeam) {
      throw new Error("A team with this name already exists in this tournament");
    }

    const otherTeams = await ctx.db
      .query("teams")
      .withIndex("by_tournament_id", (q) => q.eq("tournament_id", existingTeam.tournament_id))
      .filter((q) => q.neq(q.field("_id"), team_id))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    for (const member of members) {
      const conflictingTeam = otherTeams.find(team => team.members.includes(member._id));
      if (conflictingTeam) {
        throw new Error(`${member.name} is already in team "${conflictingTeam.name}"`);
      }
    }

    await ctx.db.patch(team_id, {
      ...updateData,
      name: updateData.name.trim(),
      updated_at: Date.now(),
    });

    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: sessionResult.user.id,
      action: "team_updated",
      resource_type: "teams",
      resource_id: team_id,
      description: `Updated team: ${updateData.name}`,
      previous_state: JSON.stringify({
        name: existingTeam.name,
        status: existingTeam.status,
        members: existingTeam.members,
      }),
      new_state: JSON.stringify({
        name: updateData.name,
        status: updateData.status,
        members: updateData.members,
      }),
    });

    return { success: true };
  },
});

export const deleteTeam = mutation({
  args: {
    admin_token: v.string(),
    team_id: v.id("teams"),
  },
  handler: async (ctx, args) => {
    const sessionResult = await ctx.runMutation(internal.functions.auth.verifySession, {
      token: args.admin_token,
    });

    if (!sessionResult.valid || sessionResult.user?.role !== "admin") {
      throw new Error("Admin access required");
    }

    const team = await ctx.db.get(args.team_id);
    if (!team) {
      throw new Error("Team not found");
    }

    const debates = await ctx.db
      .query("debates")
      .withIndex("by_tournament_id", (q) => q.eq("tournament_id", team.tournament_id))
      .filter((q) =>
        q.or(
          q.eq(q.field("proposition_team_id"), args.team_id),
          q.eq(q.field("opposition_team_id"), args.team_id)
        )
      )
      .first();

    if (debates) {
      throw new Error("Cannot delete team that has participated in debates");
    }

    await ctx.db.delete(args.team_id);

    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: sessionResult.user.id,
      action: "team_deleted",
      resource_type: "teams",
      resource_id: args.team_id,
      description: `Deleted team: ${team.name}`,
      previous_state: JSON.stringify({
        name: team.name,
        tournament_id: team.tournament_id,
        members: team.members,
      }),
    });

    return { success: true };
  },
});

export const bulkUpdateTeams = mutation({
  args: {
    admin_token: v.string(),
    team_ids: v.array(v.id("teams")),
    action: v.union(
      v.literal("activate"),
      v.literal("withdraw"),
      v.literal("disqualify"),
      v.literal("delete"),
      v.literal("mark_paid"),
      v.literal("mark_pending"),
      v.literal("waive_fee")
    ),
  },
  handler: async (ctx, args) => {
    const sessionResult = await ctx.runMutation(internal.functions.auth.verifySession, {
      token: args.admin_token,
    });

    if (!sessionResult.valid || sessionResult.user?.role !== "admin") {
      throw new Error("Admin access required");
    }

    const { team_ids, action } = args;
    const results = [];

    for (const team_id of team_ids) {
      try {
        const team = await ctx.db.get(team_id);
        if (!team) {
          results.push({
            team_id,
            success: false,
            error: "Team not found",
          });
          continue;
        }

        if (action === "delete") {
          const debates = await ctx.db
            .query("debates")
            .withIndex("by_tournament_id", (q) => q.eq("tournament_id", team.tournament_id))
            .filter((q) =>
              q.or(
                q.eq(q.field("proposition_team_id"), team_id),
                q.eq(q.field("opposition_team_id"), team_id)
              )
            )
            .first();

          if (debates) {
            results.push({
              team_id,
              success: false,
              error: "Cannot delete team that has participated in debates",
            });
            continue;
          }

          await ctx.db.delete(team_id);
        } else {
          const updates: any = { updated_at: Date.now() };

          if (action === "activate") {
            updates.status = "active";
          } else if (action === "withdraw") {
            updates.status = "withdrawn";
          } else if (action === "disqualify") {
            updates.status = "disqualified";
          } else if (action === "mark_paid") {
            updates.payment_status = "paid";
          } else if (action === "mark_pending") {
            updates.payment_status = "pending";
          } else if (action === "waive_fee") {
            updates.payment_status = "waived";
          }

          await ctx.db.patch(team_id, updates);
        }

        await ctx.runMutation(internal.functions.audit.createAuditLog, {
          user_id: sessionResult.user.id,
          action: action === "delete" ? "team_deleted" : "team_updated",
          resource_type: "teams",
          resource_id: team_id,
          description: `Bulk ${action} team: ${team.name}`,
        });

        results.push({
          team_id,
          success: true,
        });
      } catch (error: any) {
        results.push({
          team_id,
          success: false,
          error: error.message,
        });
      }
    }

    return { results };
  },
});

export const generateWaiverCode = mutation({
  args: {
    admin_token: v.string(),
    tournament_id: v.id("tournaments"),
    usage_limit: v.number(),
    expires_at: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const sessionResult = await ctx.runMutation(internal.functions.auth.verifySession, {
      token: args.admin_token,
    });

    if (!sessionResult.valid || sessionResult.user?.role !== "admin") {
      throw new Error("Admin access required");
    }

    const tournament = await ctx.db.get(args.tournament_id);
    if (!tournament) {
      throw new Error("Tournament not found");
    }

    const generateCode = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let result = 'WAIVER-';
      for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };

    let waiverCode = generateCode();

    let codeExists = true;
    while (codeExists) {
      const existingTournament = await ctx.db
        .query("tournaments")
        .filter((q) =>
          q.neq(q.field("waiver_codes"), undefined)
        )
        .collect();

      codeExists = existingTournament.some(t =>
        t.waiver_codes?.some(wc => wc.code === waiverCode)
      );

      if (codeExists) {
        waiverCode = generateCode();
      }
    }

    const newWaiverCode = {
      code: waiverCode,
      usage_limit: args.usage_limit,
      usage_count: 0,
      created_by: sessionResult.user.id,
      created_at: Date.now(),
      expires_at: args.expires_at,
      is_active: true,
    };

    const existingWaiverCodes = tournament.waiver_codes || [];

    await ctx.db.patch(args.tournament_id, {
      waiver_codes: [...existingWaiverCodes, newWaiverCode],
    });

    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: sessionResult.user.id,
      action: "tournament_updated",
      resource_type: "tournaments",
      resource_id: args.tournament_id,
      description: `Generated waiver code: ${waiverCode}`,
    });

    return { success: true, waiver_code: waiverCode };
  },
});

export const getTournamentWaiverCodes = query({
  args: {
    admin_token: v.string(),
    tournament_id: v.id("tournaments"),
  },
  handler: async (ctx, args) => {
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySessionReadOnly, {
      token: args.admin_token,
    });

    if (!sessionResult.valid || sessionResult.user?.role !== "admin") {
      throw new Error("Admin access required");
    }

    const tournament = await ctx.db.get(args.tournament_id);
    if (!tournament) {
      throw new Error("Tournament not found");
    }

    const waiverCodes = tournament.waiver_codes || [];

    return await Promise.all(
      waiverCodes.map(async (code) => {
        const creator = await ctx.db.get(code.created_by);
        return {
          ...code,
          creator: creator ? {
            name: creator.name,
            email: creator.email,
          } : null,
        };
      })
    );
  },
});

export const validateWaiverCode = internalMutation({
  args: {
    tournament_id: v.id("tournaments"),
    waiver_code: v.string(),
  },
  handler: async (ctx, args) => {
    const tournament = await ctx.db.get(args.tournament_id);
    if (!tournament) {
      throw new Error("Tournament not found");
    }

    const waiverCodes = tournament.waiver_codes || [];
    const waiverCode = waiverCodes.find(wc => wc.code === args.waiver_code);

    if (!waiverCode) {
      return { valid: false, reason: "Invalid waiver code" };
    }

    if (!waiverCode.is_active) {
      return { valid: false, reason: "Waiver code is deactivated" };
    }

    if (waiverCode.expires_at && Date.now() > waiverCode.expires_at) {
      return { valid: false, reason: "Waiver code has expired" };
    }

    if (waiverCode.usage_count >= waiverCode.usage_limit) {
      return { valid: false, reason: "Waiver code usage limit reached" };
    }

    return { valid: true };
  },
});

export const useWaiverCode = internalMutation({
  args: {
    tournament_id: v.id("tournaments"),
    waiver_code: v.string(),
  },
  handler: async (ctx, args) => {
    const tournament = await ctx.db.get(args.tournament_id);
    if (!tournament) {
      throw new Error("Tournament not found");
    }

    const waiverCodes = tournament.waiver_codes || [];
    const waiverCodeIndex = waiverCodes.findIndex(wc => wc.code === args.waiver_code);

    if (waiverCodeIndex === -1) {
      throw new Error("Invalid waiver code");
    }

    const waiverCode = waiverCodes[waiverCodeIndex];

    if (!waiverCode.is_active) {
      throw new Error("Waiver code is deactivated");
    }

    if (waiverCode.expires_at && Date.now() > waiverCode.expires_at) {
      throw new Error("Waiver code has expired");
    }

    if (waiverCode.usage_count >= waiverCode.usage_limit) {
      throw new Error("Waiver code usage limit reached");
    }

    const updatedWaiverCodes = [...waiverCodes];
    updatedWaiverCodes[waiverCodeIndex] = {
      ...waiverCode,
      usage_count: waiverCode.usage_count + 1,
    };

    await ctx.db.patch(args.tournament_id, {
      waiver_codes: updatedWaiverCodes,
    });

    return { success: true };
  },
});

export const createPayment = mutation({
  args: {
    admin_token: v.string(),
    tournament_id: v.id("tournaments"),
    school_id: v.id("schools"),
    amount: v.number(),
    currency: v.string(),
    method: v.union(
      v.literal("bank_transfer"),
      v.literal("mobile_money"),
      v.literal("cash"),
      v.literal("other")
    ),
    reference_number: v.optional(v.string()),
    receipt_image: v.optional(v.id("_storage")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: true; payment_id: string }> => {
    const sessionResult = await ctx.runMutation(internal.functions.auth.verifySession, {
      token: args.admin_token,
    });

    if (!sessionResult.valid || sessionResult.user?.role !== "admin") {
      throw new Error("Admin access required");
    }

    const { admin_token, ...paymentData } = args;

    const tournament = await ctx.db.get(paymentData.tournament_id);
    if (!tournament) {
      throw new Error("Tournament not found");
    }

    const school = await ctx.db.get(paymentData.school_id);
    if (!school) {
      throw new Error("School not found");
    }

    const paymentId = await ctx.db.insert("payments", {
      ...paymentData,
      status: "completed",
      created_by: sessionResult.user.id,
      created_at: Date.now(),
    });

    const teams = await ctx.db
      .query("teams")
      .withIndex("by_tournament_id_school_id", (q) =>
        q.eq("tournament_id", paymentData.tournament_id).eq("school_id", paymentData.school_id)
      )
      .collect();

    for (const team of teams) {
      await ctx.db.patch(team._id, {
        payment_status: "paid",
        updated_at: Date.now(),
      });
    }

    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: sessionResult.user.id,
      action: "payment_processed",
      resource_type: "payments",
      resource_id: paymentId,
      description: `Payment recorded for ${school.name} in ${tournament.name}`,
    });

    return { success: true, payment_id: paymentId };
  },
});

export const getTournamentPayments = query({
  args: {
    admin_token: v.string(),
    tournament_id: v.id("tournaments"),
  },
  handler: async (ctx, args) => {
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySessionReadOnly, {
      token: args.admin_token,
    });

    if (!sessionResult.valid || sessionResult.user?.role !== "admin") {
      throw new Error("Admin access required");
    }

    const payments = await ctx.db
      .query("payments")
      .withIndex("by_tournament_id", (q) => q.eq("tournament_id", args.tournament_id))
      .collect();

    return await Promise.all(
      payments.map(async (payment) => {
        const school = payment.school_id ? await ctx.db.get(payment.school_id) : null;
        const createdBy = payment.created_by ? await ctx.db.get(payment.created_by) : null;

        return {
          ...payment,
          school: school ? {
            name: school.name,
            type: school.type,
          } : null,
          created_by_user: createdBy ? {
            name: createdBy.name,
            email: createdBy.email,
          } : null,
        };
      })
    );
  },
});