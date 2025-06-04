import { query } from "../_generated/server";
import { v } from "convex/values";

export const getLeagues = query({
  args: {
    search: v.optional(v.string()),
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { search, page = 1, limit = 20 } = args;

    let query;

    if (search && search.trim()) {
      query = ctx.db
        .query("leagues")
        .withSearchIndex("search_leagues", (q) =>
          q.search("name", search.trim())
        );
    } else {
      query = ctx.db.query("leagues").order("desc");
    }

    const offset = (page - 1) * limit;

    const allLeagues = await query.collect();

    const leagues = allLeagues.slice(offset, offset + limit);

    const leaguesWithTournamentCheck = await Promise.all(
      leagues.map(async (league) => {
        const tournaments = await ctx.db
          .query("tournaments")
          .withIndex("by_league_id", (q) => q.eq("league_id", league._id))
          .first();

        return {
          ...league,
          hasTournaments: !!tournaments,
        };
      })
    );

    return {
      leagues: leaguesWithTournamentCheck,
      totalCount: allLeagues.length,
      hasMore: offset + limit < allLeagues.length,
      page,
      limit,
    };
  },
});

export const getLeagueById = query({
  args: { league_id: v.id("leagues") },
  handler: async (ctx, args) => {
    const league = await ctx.db.get(args.league_id);

    if (!league) {
      throw new Error("League not found");
    }

    const tournaments = await ctx.db
      .query("tournaments")
      .withIndex("by_league_id", (q) => q.eq("league_id", league._id))
      .first();

    return {
      ...league,
      hasTournaments: !!tournaments,
    };
  },
});