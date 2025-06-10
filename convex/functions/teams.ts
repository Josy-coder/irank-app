import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { Doc, Id } from "../_generated/dataModel";

function generateInvitationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export const getTournamentTeams = query({
  args: {
    token: v.string(),
    tournament_id: v.id("tournaments"),
    search: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("active"),
      v.literal("withdrawn"),
      v.literal("disqualified")
    )),
    school_id: v.optional(v.id("schools")),
    payment_status: v.optional(v.union(
      v.literal("pending"),
      v.literal("paid"),
      v.literal("waived")
    )),
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySessionReadOnly, {
      token: args.token,
    });

    if (!sessionResult.valid) {
      throw new Error("Authentication required");
    }

    const {
      tournament_id,
      search,
      status,
      school_id,
      payment_status,
      page = 1,
      limit = 20,
    } = args;

    const tournament = await ctx.db.get(tournament_id);
    if (!tournament) {
      throw new Error("Tournament not found");
    }

    let query;
    const offset = (page - 1) * limit;

    if (search && search.trim()) {
      query = ctx.db
        .query("teams")
        .withSearchIndex("search_teams", (q) => {
          let searchQuery = q.search("name", search.trim()).eq("tournament_id", tournament_id);

          if (status) searchQuery = searchQuery.eq("status", status);
          if (school_id) searchQuery = searchQuery.eq("school_id", school_id);

          return searchQuery;
        });
    } else {
      query = ctx.db
        .query("teams")
        .withIndex("by_tournament_id", (q) => q.eq("tournament_id", tournament_id));
    }

    let allTeams = await query.collect();

    if (!search || !search.trim()) {
      if (status) {
        allTeams = allTeams.filter(team => team.status === status);
      }
      if (school_id) {
        allTeams = allTeams.filter(team => team.school_id === school_id);
      }
      if (payment_status) {
        allTeams = allTeams.filter(team => team.payment_status === payment_status);
      }
    }

    allTeams = allTeams.sort((a, b) => (b._creationTime || 0) - (a._creationTime || 0));

    const teams = allTeams.slice(offset, offset + limit);

    const enrichedTeams = await Promise.all(
      teams.map(async (team) => {

        let school = null;
        if (team.school_id) {
          school = await ctx.db.get(team.school_id);
        }

        const members = await Promise.all(
          team.members.map(async (memberId) => {
            const member = await ctx.db.get(memberId);
            return member ? {
              _id: member._id,
              name: member.name,
              email: member.email,
              role: member.role,
            } : null;
          })
        );

        return {
          ...team,
          school: school ? {
            _id: school._id,
            name: school.name,
            type: school.type,
          } : null,
          members: members.filter(Boolean),
          memberCount: team.members.length,
        };
      })
    );

    return {
      teams: enrichedTeams,
      totalCount: allTeams.length,
      hasMore: offset + limit < allTeams.length,
      page,
      limit,
    };
  },
});


export const getUserTournamentTeams = query({
  args: {
    token: v.string(),
    tournament_id: v.id("tournaments"),
  },
  handler: async (ctx, args) => {
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySessionReadOnly, {
      token: args.token,
    });

    if (!sessionResult.user || !sessionResult.valid) {
      throw new Error("Authentication required");
    }

    const user = sessionResult.user;

    let teams: Doc<"teams">[];

    if (user.role === "student") {

      teams = await ctx.db
        .query("teams")
        .withIndex("by_tournament_id", (q) => q.eq("tournament_id", args.tournament_id))
        .collect()
        .then(allTeams => allTeams.filter(team => team.members.includes(user.id)));
    } else if (user.role === "school_admin" && user.school_id) {

      teams = await ctx.db
        .query("teams")
        .withIndex("by_tournament_id_school_id", (q) =>
          q.eq("tournament_id", args.tournament_id).eq("school_id", user.school_id)
        )
        .collect();
    } else {
      teams = [];
    }

    return await Promise.all(
      teams.map(async (team) => {
        const members = await Promise.all(
          team.members.map(async (memberId: Id<"users">) => {
            const member = await ctx.db.get(memberId) as Doc<"users"> | null;
            return member ? {
              _id: member._id,
              name: member.name,
              email: member.email,
              role: member.role,
            } : null;
          })
        );

        return {
          ...team,
          members: members.filter(Boolean),
          memberCount: team.members.length,
        };
      })
    );
  },
});

export const createUserTeam = mutation({
  args: {
    token: v.string(),
    tournament_id: v.id("tournaments"),
    name: v.string(),
    members: v.array(v.id("users")),
    waiver_code: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; team_id: Id<"teams">; invitation_code: string }> => {
    const sessionResult = await ctx.runMutation(internal.functions.auth.verifySession, {
      token: args.token,
    });

    if (!sessionResult.user || !sessionResult.valid) {
      throw new Error("Authentication required");
    }

    const user = sessionResult.user;

    if (!["school_admin", "student"].includes(user.role)) {
      throw new Error("Only school admins and students can create teams");
    }

    const { tournament_id, name, members, waiver_code } = args;

    if (!name.trim()) {
      throw new Error("Team name is required");
    }

    const tournament = await ctx.db.get(tournament_id);
    if (!tournament) {
      throw new Error("Tournament not found");
    }

    if (tournament.status !== "published") {
      throw new Error("Cannot create teams for unpublished tournaments");
    }

    let league = null;
    if (tournament.league_id) {
      league = await ctx.db.get(tournament.league_id);
    }

    if (user.role === "student") {
      if (!league || league.type !== "Dreams Mode") {
        throw new Error("Students can only create teams in Dreams Mode tournaments");
      }
    } else if (user.role === "school_admin") {
      if (league && league.type === "Dreams Mode") {
        throw new Error("School admins cannot create teams in Dreams Mode tournaments");
      }
      if (!user.school_id) {
        throw new Error("School admin must be associated with a school");
      }
    }

    if (members.length > tournament.team_size) {
      throw new Error(`Team cannot have more than ${tournament.team_size} members`);
    }

    if (members.length === 0) {
      throw new Error("Team must have at least one member");
    }

    const memberDetails = await Promise.all(
      members.map(async (memberId) => {
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

    if (user.role === "school_admin") {
      for (const member of memberDetails) {
        if (member.school_id !== user.school_id) {
          throw new Error(`All team members must be from your school`);
        }
      }
    }

    if (user.role === "student" && !members.includes(user.id)) {
      throw new Error("You must include yourself as a team member");
    }

    const existingTeam = await ctx.db
      .query("teams")
      .withIndex("by_tournament_id", (q) => q.eq("tournament_id", tournament_id))
      .filter((q) => q.eq(q.field("name"), name.trim()))
      .first();

    if (existingTeam) {
      throw new Error("A team with this name already exists in this tournament");
    }

    const existingTeams = await ctx.db
      .query("teams")
      .withIndex("by_tournament_id", (q) => q.eq("tournament_id", tournament_id))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    for (const member of memberDetails) {
      const conflictingTeam = existingTeams.find(team => team.members.includes(member._id));
      if (conflictingTeam) {
        throw new Error(`${member.name} is already in team "${conflictingTeam.name}"`);
      }
    }

    let paymentStatus: "pending" | "paid" | "waived" = "pending";

    if (league && league.type === "Dreams Mode") {
      paymentStatus = "paid";
    } else if (waiver_code && user.role === "school_admin") {
      const validation = await ctx.runMutation(internal.functions.admin.teams.validateWaiverCode, {
        tournament_id: tournament_id,
        waiver_code: waiver_code,
      });

      if (!validation.valid) {
        throw new Error(`Invalid waiver code: ${validation.reason}`);
      }

      await ctx.runMutation(internal.functions.admin.teams.useWaiverCode, {
        tournament_id: tournament_id,
        waiver_code: waiver_code,
      });

      paymentStatus = "waived";
    }

    let invitationCode = generateInvitationCode();
    while (await ctx.db
      .query("teams")
      .withIndex("by_invitation_code", (q) => q.eq("invitation_code", invitationCode))
      .first()) {
      invitationCode = generateInvitationCode();
    }

    const teamId = await ctx.db.insert("teams", {
      name: name.trim(),
      tournament_id: tournament_id,
      school_id: user.role === "school_admin" ? user.school_id : undefined,
      members: members,
      is_confirmed: user.role === "school_admin",
      payment_status: paymentStatus,
      invitation_code: invitationCode,
      status: "active",
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: user.id,
      action: "team_created",
      resource_type: "teams",
      resource_id: teamId,
      description: `Created team: ${name} (${user.role})`,
    });

    return { success: true, team_id: teamId, invitation_code: invitationCode };
  },
});

export const updateUserTeam = mutation({
  args: {
    token: v.string(),
    team_id: v.id("teams"),
    name: v.string(),
    members: v.array(v.id("users")),
  },
  handler: async (ctx, args) => {
    const sessionResult = await ctx.runMutation(internal.functions.auth.verifySession, {
      token: args.token,
    });

    if (!sessionResult.user || !sessionResult.valid) {
      throw new Error("Authentication required");
    }

    const user = sessionResult.user;
    const { team_id, name, members } = args;

    const existingTeam = await ctx.db.get(team_id);
    if (!existingTeam) {
      throw new Error("Team not found");
    }

    let canEdit = false;
    if (user.role === "school_admin" && user.school_id && existingTeam.school_id === user.school_id) {
      canEdit = true;
    } else if (user.role === "student" && existingTeam.members.includes(user.id)) {

      const tournament = await ctx.db.get(existingTeam.tournament_id);
      if (tournament?.league_id) {
        const league = await ctx.db.get(tournament.league_id);
        if (league?.type === "Dreams Mode") {
          canEdit = true;
        }
      }
    }

    if (!canEdit) {
      throw new Error("You don't have permission to edit this team");
    }

    if (!name.trim()) {
      throw new Error("Team name is required");
    }

    const tournament = await ctx.db.get(existingTeam.tournament_id);
    if (!tournament) {
      throw new Error("Tournament not found");
    }

    if (members.length > tournament.team_size) {
      throw new Error(`Team cannot have more than ${tournament.team_size} members`);
    }

    if (members.length === 0) {
      throw new Error("Team must have at least one member");
    }

    const memberDetails = await Promise.all(
      members.map(async (memberId) => {
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

    if (existingTeam.school_id) {
      for (const member of memberDetails) {
        if (member.school_id !== existingTeam.school_id) {
          throw new Error(`All team members must be from the same school`);
        }
      }
    }

    if (user.role === "student") {
      const hasExistingMember = existingTeam.members.some(existingMemberId =>
        members.includes(existingMemberId)
      );
      if (!hasExistingMember) {
        throw new Error("At least one existing team member must remain");
      }
    }

    const duplicateTeam = await ctx.db
      .query("teams")
      .withIndex("by_tournament_id", (q) => q.eq("tournament_id", existingTeam.tournament_id))
      .filter((q) => q.neq(q.field("_id"), team_id))
      .filter((q) => q.eq(q.field("name"), name.trim()))
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

    for (const member of memberDetails) {
      const conflictingTeam = otherTeams.find(team => team.members.includes(member._id));
      if (conflictingTeam) {
        throw new Error(`${member.name} is already in team "${conflictingTeam.name}"`);
      }
    }

    await ctx.db.patch(team_id, {
      name: name.trim(),
      members: members,
      updated_at: Date.now(),
    });

    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: user.id,
      action: "team_updated",
      resource_type: "teams",
      resource_id: team_id,
      description: `Updated team: ${name} (${user.role})`,
      previous_state: JSON.stringify({
        name: existingTeam.name,
        members: existingTeam.members,
      }),
      new_state: JSON.stringify({
        name: name,
        members: members,
      }),
    });

    return { success: true };
  },
});

export const deleteUserTeam = mutation({
  args: {
    token: v.string(),
    team_id: v.id("teams"),
  },
  handler: async (ctx, args) => {
    const sessionResult = await ctx.runMutation(internal.functions.auth.verifySession, {
      token: args.token,
    });

    if (!sessionResult.user || !sessionResult.valid) {
      throw new Error("Authentication required");
    }

    const user = sessionResult.user;
    const { team_id } = args;

    const team = await ctx.db.get(team_id);
    if (!team) {
      throw new Error("Team not found");
    }

    let canDelete = false;
    if (user.role === "school_admin" && user.school_id && team.school_id === user.school_id) {
      canDelete = true;
    } else if (user.role === "student" && team.members.includes(user.id)) {

      const tournament = await ctx.db.get(team.tournament_id);
      if (tournament?.league_id) {
        const league = await ctx.db.get(tournament.league_id);
        if (league?.type === "Dreams Mode") {
          canDelete = true;
        }
      }
    }

    if (!canDelete) {
      throw new Error("You don't have permission to delete this team");
    }

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
      throw new Error("Cannot delete team that has participated in debates");
    }

    await ctx.db.delete(team_id);

    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: user.id,
      action: "team_deleted",
      resource_type: "teams",
      resource_id: team_id,
      description: `Deleted team: ${team.name} (${user.role})`,
      previous_state: JSON.stringify({
        name: team.name,
        tournament_id: team.tournament_id,
        members: team.members,
      }),
    });

    return { success: true };
  },
});

export const leaveTeam = mutation({
  args: {
    token: v.string(),
    team_id: v.id("teams"),
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
      throw new Error("Only students can leave teams");
    }

    const team = await ctx.db.get(args.team_id);
    if (!team) {
      throw new Error("Team not found");
    }

    if (!team.members.includes(user.id)) {
      throw new Error("You are not a member of this team");
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
      throw new Error("Cannot leave team that has participated in debates");
    }

    const updatedMembers = team.members.filter(memberId => memberId !== user.id);

    if (updatedMembers.length === 0) {
      await ctx.db.delete(args.team_id);

      await ctx.runMutation(internal.functions.audit.createAuditLog, {
        user_id: user.id,
        action: "team_deleted",
        resource_type: "teams",
        resource_id: args.team_id,
        description: `Team deleted after last member ${user.name} left`,
      });
    } else {
      await ctx.db.patch(args.team_id, {
        members: updatedMembers,
        updated_at: Date.now(),
      });

      await ctx.runMutation(internal.functions.audit.createAuditLog, {
        user_id: user.id,
        action: "team_updated",
        resource_type: "teams",
        resource_id: args.team_id,
        description: `Student ${user.name} left team ${team.name}`,
      });
    }

    return { success: true };
  },
});

export const getPotentialTeamMembers = query({
  args: {
    token: v.string(),
    tournament_id: v.id("tournaments"),
    search: v.optional(v.string()),
    exclude_team_id: v.optional(v.id("teams")),
    school_id: v.optional(v.id("schools")),
  },
  handler: async (ctx, args) => {
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySessionReadOnly, {
      token: args.token,
    });

    if (!sessionResult.user || !sessionResult.valid) {
      throw new Error("Authentication required");
    }

    const user = sessionResult.user;
    const { tournament_id, search, exclude_team_id, school_id } = args;

    const existingTeams = await ctx.db
      .query("teams")
      .withIndex("by_tournament_id", (q) => q.eq("tournament_id", tournament_id))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    const assignedStudentIds = new Set();
    for (const team of existingTeams) {
      if (!exclude_team_id || team._id !== exclude_team_id) {
        team.members.forEach(memberId => assignedStudentIds.add(memberId));
      }
    }

    let studentsQuery;
    if (search && search.trim()) {
      studentsQuery = ctx.db
        .query("users")
        .withSearchIndex("search_users", (q) =>
          q.search("name", search.trim())
            .eq("role", "student")
            .eq("status", "active")
            .eq("verified", true)
        );
    } else {
      studentsQuery = ctx.db
        .query("users")
        .withIndex("by_role_status", (q) => q.eq("role", "student").eq("status", "active"))
        .filter((q) => q.eq(q.field("verified"), true));
    }

    let allStudents = await studentsQuery.collect();

    allStudents = allStudents.filter(student => {
      if (user.role === "school_admin" && user.school_id && student.school_id !== user.school_id) {
        return false;
      }
      return !(school_id && student.school_id !== school_id);

    });

    const availableStudents = allStudents.filter(student => !assignedStudentIds.has(student._id));

    const enrichedStudents = await Promise.all(
      availableStudents.map(async (student) => {
        let school = null;
        if (student.school_id) {
          school = await ctx.db.get(student.school_id);
        }

        return {
          _id: student._id,
          name: student.name,
          email: student.email,
          grade: student.grade,
          school: school ? {
            _id: school._id,
            name: school.name,
            type: school.type,
          } : null,
        };
      })
    );

    return enrichedStudents.slice(0, 50);
  },
});
