import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

const tournamentFormatType = v.union(
  v.literal("WorldSchools"),
  v.literal("BritishParliamentary"),
  v.literal("PublicForum"),
  v.literal("LincolnDouglas"),
  v.literal("OxfordStyle")
);

const tournamentStatusType = v.union(
  v.literal("draft"),
  v.literal("published"),
  v.literal("inProgress"),
  v.literal("completed"),
  v.literal("cancelled")
);

/**
 * Get a tournament by ID
 * Accessible by all users
 */
export const getTournament = query({
  args: {
    id: v.id("tournaments")
  },
  handler: async (ctx, args) => {
    const tournament = await ctx.db.get(args.id);

    if (!tournament) {
      return null;
    }

    return tournament;
  },
});

/**
 * Get tournaments with pagination and search
 * Accessible by all users
 */
export const getTournaments = query({
  args: {
    search: v.optional(v.string()),
    format: v.optional(tournamentFormatType),
    status: v.optional(tournamentStatusType),
    league_id: v.optional(v.id("leagues")),
    is_virtual: v.optional(v.boolean()),
    upcoming: v.optional(v.boolean()),
    page: v.number(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const baseQuery = ctx.db.query("tournaments");

    let filteredQuery;

    if (args.league_id) {
      if (args.status) {
        filteredQuery = baseQuery.withIndex("by_league_id_status", (q) =>
          q.eq("league_id", args.league_id).eq("status", args.status ?? "draft")
        );
      } else {
        filteredQuery = baseQuery.withIndex("by_league_id", (q) =>
          q.eq("league_id", args.league_id)
        );
      }
    } else if (args.status) {
      filteredQuery = baseQuery.withIndex("by_status", (q) =>
        q.eq("status", args.status ?? "draft")
      );
    } else {
      filteredQuery = baseQuery;
    }

    let dateFilteredQuery = filteredQuery;

    if (args.upcoming) {
      const now = Date.now();
      dateFilteredQuery = baseQuery.withIndex("by_start_date", (q) =>
        q.gt("start_date", now)
      );
    }

    if (args.search && args.search.trim() !== "") {
      const searchQuery = baseQuery.withSearchIndex("search_tournaments", (q) =>
        q.search("name", args.search ?? "")
      );

      const paginatedTournaments = await searchQuery
        .paginate({
          numItems: args.limit,
          cursor: args.page > 1 ? String(args.page) : null
        });

      return {
        tournaments: paginatedTournaments.page,
        totalCount: paginatedTournaments.page.length,
        hasMore: paginatedTournaments.continueCursor !== null,
        nextPage: paginatedTournaments.continueCursor
      };
    } else {
      const finalQuery = dateFilteredQuery || filteredQuery;
      const totalCount = await finalQuery.collect();

      const paginatedTournaments = await finalQuery
        .order("desc")
        .paginate({
          numItems: args.limit,
          cursor: args.page > 1 ? String(args.page) : null
        });

      return {
        tournaments: paginatedTournaments.page,
        totalCount: totalCount.length,
        hasMore: paginatedTournaments.continueCursor !== null,
        nextPage: paginatedTournaments.continueCursor
      };
    }
  },
});

/**
 * Create a new tournament
 * Accessible by admin only
 */
export const createTournament = mutation({
  args: {
    name: v.string(),
    start_date: v.number(),
    end_date: v.number(),
    location: v.optional(v.string()),
    is_virtual: v.boolean(),
    league_id: v.optional(v.id("leagues")),
    format: tournamentFormatType,
    coordinator_id: v.optional(v.id("users")),
    prelim_rounds: v.number(),
    elimination_rounds: v.number(),
    judges_per_debate: v.number(),
    team_size: v.number(),
    motions_release_time: v.optional(v.number()),
    speaking_times: v.object({}),
    fee: v.optional(v.number()),
    description: v.optional(v.string()),
    image: v.optional(v.id("_storage")),
    invitation_schools: v.optional(v.array(v.id("schools"))),
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

    if (args.start_date >= args.end_date) {
      throw new Error("End date must be after start date");
    }

    const tournamentId = await ctx.db.insert("tournaments", {
      name: args.name,
      start_date: args.start_date,
      end_date: args.end_date,
      location: args.location,
      is_virtual: args.is_virtual,
      league_id: args.league_id,
      format: args.format,
      coordinator_id: args.coordinator_id,
      prelim_rounds: args.prelim_rounds,
      elimination_rounds: args.elimination_rounds,
      judges_per_debate: args.judges_per_debate,
      team_size: args.team_size,
      motions_release_time: args.motions_release_time,
      speaking_times: args.speaking_times,
      fee: args.fee,
      description: args.description,
      image: args.image,
      status: "draft",
    });

    if (args.league_id) {
      const league = await ctx.db.get(args.league_id);
      const isDreamMode = league?.type === "Dreams Mode";

      if (isDreamMode) {

        const volunteers = await ctx.db
          .query("users")
          .withIndex("by_role", (q) => q.eq("role", "volunteer"))
          .filter(q => q.eq(q.field("status"), "active"))
          .collect();

        for (const volunteer of volunteers) {
          await ctx.db.insert("tournament_invitations", {
            tournament_id: tournamentId,
            target_type: "volunteer",
            target_id: volunteer._id,
            status: "pending",
            invited_by: currentUser._id,
            invited_at: Date.now(),
            expires_at: args.start_date,
          });
        }

        // Invite eligible students
        const students = await ctx.db
          .query("users")
          .withIndex("by_role", (q) => q.eq("role", "student"))
          .filter(q => q.eq(q.field("status"), "active"))
          .collect();

        for (const student of students) {
          await ctx.db.insert("tournament_invitations", {
            tournament_id: tournamentId,
            target_type: "student",
            target_id: student._id,
            status: "pending",
            invited_by: currentUser._id,
            invited_at: Date.now(),
            expires_at: args.start_date,
          });
        }
      }
      else {
        if (args.invitation_schools && args.invitation_schools.length > 0) {
          for (const schoolId of args.invitation_schools) {
            const schoolAdmin = await ctx.db
              .query("users")
              .withIndex("by_school_id_role", (q) =>
                q.eq("school_id", schoolId).eq("role", "school_admin")
              )
              .first();

            if (schoolAdmin) {
              await ctx.db.insert("tournament_invitations", {
                tournament_id: tournamentId,
                target_type: "school",
                target_id: schoolAdmin._id,
                status: "pending",
                invited_by: currentUser._id,
                invited_at: Date.now(),
                expires_at: args.start_date,
              });
            }
          }
        }

        const volunteers = await ctx.db
          .query("users")
          .withIndex("by_role", (q) => q.eq("role", "volunteer"))
          .filter(q => q.eq(q.field("status"), "active"))
          .collect();

        for (const volunteer of volunteers) {
          await ctx.db.insert("tournament_invitations", {
            tournament_id: tournamentId,
            target_type: "volunteer",
            target_id: volunteer._id,
            status: "pending",
            invited_by: currentUser._id,
            invited_at: Date.now(),
            expires_at: args.start_date,
          });
        }
      }
    }

    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: currentUser._id,
      action: "tournament_created",
      resource_type: "tournaments",
      resource_id: tournamentId,
      description: `Created tournament ${args.name}`,
      new_state: JSON.stringify(args),
    });

    return tournamentId;
  },
});

/**
 * Update a tournament
 * Accessible by admin or tournament coordinator
 */
export const updateTournament = mutation({
  args: {
    id: v.id("tournaments"),
    name: v.optional(v.string()),
    start_date: v.optional(v.number()),
    end_date: v.optional(v.number()),
    location: v.optional(v.string()),
    is_virtual: v.optional(v.boolean()),
    league_id: v.optional(v.id("leagues")),
    format: v.optional(tournamentFormatType),
    coordinator_id: v.optional(v.id("users")),
    prelim_rounds: v.optional(v.number()),
    elimination_rounds: v.optional(v.number()),
    judges_per_debate: v.optional(v.number()),
    team_size: v.optional(v.number()),
    motions_release_time: v.optional(v.number()),
    speaking_times: v.optional(v.object({})),
    fee: v.optional(v.number()),
    description: v.optional(v.string()),
    image: v.optional(v.id("_storage")),
    status: v.optional(tournamentStatusType),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email))
      .first();

    if (!currentUser) {
      throw new Error("User not found");
    }

    const tournamentToUpdate = await ctx.db.get(args.id);
    if (!tournamentToUpdate) {
      throw new Error("Tournament not found");
    }

    if (currentUser.role !== "admin") {
      if (tournamentToUpdate.coordinator_id !== currentUser._id) {
        throw new Error("Unauthorized - You are not the coordinator of this tournament");
      }

      if (args.status !== undefined || args.league_id !== undefined) {
        throw new Error("Unauthorized - Only admin can update tournament status or league");
      }
    }

    if (args.start_date && args.end_date && args.start_date >= args.end_date) {
      throw new Error("End date must be after start date");
    }

    const previousState = JSON.stringify(tournamentToUpdate);

    const updateData: any = {};

    if (args.name !== undefined) updateData.name = args.name;
    if (args.start_date !== undefined) updateData.start_date = args.start_date;
    if (args.end_date !== undefined) updateData.end_date = args.end_date;
    if (args.location !== undefined) updateData.location = args.location;
    if (args.is_virtual !== undefined) updateData.is_virtual = args.is_virtual;
    if (args.format !== undefined) updateData.format = args.format;
    if (args.coordinator_id !== undefined) updateData.coordinator_id = args.coordinator_id;
    if (args.prelim_rounds !== undefined) updateData.prelim_rounds = args.prelim_rounds;
    if (args.elimination_rounds !== undefined) updateData.elimination_rounds = args.elimination_rounds;
    if (args.judges_per_debate !== undefined) updateData.judges_per_debate = args.judges_per_debate;
    if (args.team_size !== undefined) updateData.team_size = args.team_size;
    if (args.motions_release_time !== undefined) updateData.motions_release_time = args.motions_release_time;
    if (args.speaking_times !== undefined) updateData.speaking_times = args.speaking_times;
    if (args.fee !== undefined) updateData.fee = args.fee;
    if (args.description !== undefined) updateData.description = args.description;
    if (args.image !== undefined) updateData.image = args.image;

    if (currentUser.role === "admin") {
      if (args.league_id !== undefined) updateData.league_id = args.league_id;
      if (args.status !== undefined) updateData.status = args.status;
    }

    const updatedTournamentId = await ctx.db.patch(args.id, updateData);

    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: currentUser._id,
      action: "tournament_updated",
      resource_type: "tournaments",
      resource_id: args.id,
      description: `Updated tournament ${tournamentToUpdate.name}`,
      previous_state: previousState,
      new_state: JSON.stringify({...tournamentToUpdate, ...updateData}),
    });

    return updatedTournamentId;
  },
});

/**
 * Delete a tournament
 * Accessible by admin only
 */
export const deleteTournament = mutation({
  args: {
    id: v.id("tournaments"),
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

    const tournamentToDelete = await ctx.db.get(args.id);
    if (!tournamentToDelete) {
      throw new Error("Tournament not found");
    }

    if (tournamentToDelete.start_date < Date.now() &&
      tournamentToDelete.status !== "draft" &&
      tournamentToDelete.status !== "cancelled") {
      throw new Error("Cannot delete a tournament that has already started");
    }

    const previousState = JSON.stringify(tournamentToDelete);

    const invitations = await ctx.db
      .query("tournament_invitations")
      .withIndex("by_tournament_id", (q) => q.eq("tournament_id", args.id))
      .collect();

    for (const invitation of invitations) {
      await ctx.db.delete(invitation._id);
    }

    const teams = await ctx.db
      .query("teams")
      .withIndex("by_tournament_id", (q) => q.eq("tournament_id", args.id))
      .collect();

    for (const team of teams) {
      await ctx.db.delete(team._id);
    }

    await ctx.db.delete(args.id);

    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: currentUser._id,
      action: "tournament_deleted",
      resource_type: "tournaments",
      resource_id: args.id,
      description: `Deleted tournament ${tournamentToDelete.name}`,
      previous_state: previousState,
    });

    return true;
  },
});

/**
 * Publish a tournament
 * Accessible by admin only
 */
export const publishTournament = mutation({
  args: {
    id: v.id("tournaments"),
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

    const tournamentToPublish = await ctx.db.get(args.id);
    if (!tournamentToPublish) {
      throw new Error("Tournament not found");
    }

    if (tournamentToPublish.status !== "draft") {
      throw new Error("Only tournaments in draft status can be published");
    }

    const previousState = JSON.stringify(tournamentToPublish);

    const updatedTournamentId = await ctx.db.patch(args.id, {
      status: "published"
    });

    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: currentUser._id,
      action: "tournament_published",
      resource_type: "tournaments",
      resource_id: args.id,
      description: `Published tournament ${tournamentToPublish.name}`,
      previous_state: previousState,
      new_state: JSON.stringify({...tournamentToPublish, status: "published"}),
    });

    return updatedTournamentId;
  },
});