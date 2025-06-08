import { query } from "../_generated/server";
import { v } from "convex/values";

export const getTournaments = query({
  args: {
    search: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("published"),
        v.literal("inProgress"),
        v.literal("completed"),
        v.literal("cancelled")
      )
    ),
    format: v.optional(
      v.union(
        v.literal("WorldSchools"),
        v.literal("BritishParliamentary"),
        v.literal("PublicForum"),
        v.literal("LincolnDouglas"),
        v.literal("OxfordStyle")
      )
    ),
    is_virtual: v.optional(v.boolean()),
    league_id: v.optional(v.id("leagues")),
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const {
      search,
      status,
      format,
      is_virtual,
      league_id,
      page = 1,
      limit = 12,
    } = args;

    let query;

    if (search && search.trim()) {
      query = ctx.db
        .query("tournaments")
        .withSearchIndex("search_tournaments", (q) => {
          let searchQuery = q.search("name", search.trim());

          if (status) searchQuery = searchQuery.eq("status", status);
          if (format) searchQuery = searchQuery.eq("format", format);
          if (is_virtual !== undefined)
            searchQuery = searchQuery.eq("is_virtual", is_virtual);
          if (league_id)
            searchQuery = searchQuery.eq("league_id", league_id);

          return searchQuery;
        });
    } else if (league_id && status) {
      query = ctx.db
        .query("tournaments")
        .withIndex("by_league_id_status", (q) =>
          q.eq("league_id", league_id).eq("status", status)
        );
    } else if (league_id) {
      query = ctx.db
        .query("tournaments")
        .withIndex("by_league_id", (q) => q.eq("league_id", league_id));
    } else if (status) {
      query = ctx.db
        .query("tournaments")
        .withIndex("by_status", (q) => q.eq("status", status));
    } else {
      query = ctx.db.query("tournaments").order("desc");
    }

    let allTournaments = await query.collect();

    if (!search || !search.trim()) {
      if (format) {
        allTournaments = allTournaments.filter((t) => t.format === format);
      }
      if (is_virtual !== undefined) {
        allTournaments = allTournaments.filter(
          (t) => t.is_virtual === is_virtual
        );
      }
      if (league_id && !status) {
        allTournaments = allTournaments.filter(
          (t) => t.league_id === league_id
        );
      }
      if (status && !league_id) {
        allTournaments = allTournaments.filter((t) => t.status === status);
      }
    }

    if (search || (!league_id && !status)) {
      allTournaments = allTournaments.sort(
        (a, b) => (b._creationTime || 0) - (a._creationTime || 0)
      );
    }

    const offset = (page - 1) * limit;
    const tournaments = allTournaments.slice(offset, offset + limit);

    const enrichedTournaments = await Promise.all(
      tournaments.map(async (tournament) => {
        let league = tournament.league_id
          ? await ctx.db.get(tournament.league_id)
          : null;

        let coordinator = tournament.coordinator_id
          ? await ctx.db.get(tournament.coordinator_id)
          : null;

        const teams = await ctx.db
          .query("teams")
          .withIndex("by_tournament_id", (q) =>
            q.eq("tournament_id", tournament._id)
          )
          .collect();

        const schoolIds = new Set(
          teams.map((team) => team.school_id).filter(Boolean)
        );

        return {
          ...tournament,
          league: league
            ? {
              name: league.name,
              type: league.type,
            }
            : null,
          coordinator: coordinator
            ? {
              name: coordinator.name,
            }
            : null,
          teamCount: teams.length,
          schoolCount: schoolIds.size,
          hasTeams: teams.length > 0,
        };
      })
    );

    return {
      tournaments: enrichedTournaments,
      totalCount: allTournaments.length,
      hasMore: offset + limit < allTournaments.length,
      page,
      limit,
    };
  },
});

export const getTournamentBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const tournament = await ctx.db
      .query("tournaments")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (!tournament) {
      throw new Error("Tournament not found");
    }

    let league = null;
    if (tournament.league_id) {
      league = await ctx.db.get(tournament.league_id);
    }

    let coordinator = null;
    if (tournament.coordinator_id) {
      coordinator = await ctx.db.get(tournament.coordinator_id);
    }

    const teams = await ctx.db
      .query("teams")
      .withIndex("by_tournament_id", (q) => q.eq("tournament_id", tournament._id))
      .collect();

    const schoolIds = new Set(teams.map(team => team.school_id).filter(Boolean));

    const hasTeams = teams.length > 0;

    return {
      ...tournament,
      league: league ? {
        _id: league._id,
        name: league.name,
        type: league.type,
      } : null,
      coordinator: coordinator ? {
        _id: coordinator._id,
        name: coordinator.name,
      } : null,
      teamCount: teams.length,
      schoolCount: schoolIds.size,
      hasTeams,
    };
  },
});

export const getTournamentsByLeague = query({
  args: {
    league_id: v.id("leagues"),
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { league_id, page = 1, limit = 12 } = args;

    let query = ctx.db
      .query("tournaments")
      .withIndex("by_league_id", (q) => q.eq("league_id", league_id))
      .order("desc");

    const offset = (page - 1) * limit;

    const allTournaments = await query.collect();
    const tournaments = allTournaments.slice(offset, offset + limit);

    const enrichedTournaments = await Promise.all(
      tournaments.map(async (tournament) => {
        let coordinator = null;
        if (tournament.coordinator_id) {
          coordinator = await ctx.db.get(tournament.coordinator_id);
        }

        const teams = await ctx.db
          .query("teams")
          .withIndex("by_tournament_id", (q) => q.eq("tournament_id", tournament._id))
          .collect();

        const schoolIds = new Set(teams.map(team => team.school_id).filter(Boolean));

        return {
          ...tournament,
          coordinator: coordinator ? {
            name: coordinator.name,
          } : null,
          teamCount: teams.length,
          schoolCount: schoolIds.size,
          hasTeams: teams.length > 0,
        };
      })
    );

    return {
      tournaments: enrichedTournaments,
      totalCount: allTournaments.length,
      hasMore: offset + limit < allTournaments.length,
      page,
      limit,
    };
  },
});