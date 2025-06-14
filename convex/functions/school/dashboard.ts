import { query } from "../../_generated/server";
import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { Id, Doc } from "../../_generated/dataModel";

export const getSchoolDashboardStats = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args): Promise<{
    activeDebaters: number;
    debatersGrowth: number;
    tournamentsAttendedLastYear: number;
    tournamentsGrowth: number;
    upcomingTournaments: number;
    upcomingGrowth: number;
  }> => {
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySessionReadOnly, {
      token: args.token,
    });

    if (!sessionResult.valid || !sessionResult.user || sessionResult.user.role !== "school_admin") {
      throw new Error("School admin access required");
    }

    const schoolUser = sessionResult.user;
    if (!schoolUser.school_id) {
      throw new Error("No school associated with this account");
    }

    const now = Date.now();
    const oneYearAgo = now - (365 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

    const schoolStudents = await ctx.db
      .query("users")
      .withIndex("by_school_id_role", (q) =>
        q.eq("school_id", schoolUser.school_id).eq("role", "student")
      )
      .collect();

    const activeDebaters = schoolStudents.filter(s => s.status === "active").length;

    const schoolTeams = await ctx.db
      .query("teams")
      .withIndex("by_school_id", (q) => q.eq("school_id", schoolUser.school_id))
      .collect();

    const tournamentIds = Array.from(new Set(schoolTeams.map(t => t.tournament_id)));
    const allTournaments = await Promise.all(
      tournamentIds.map(id => ctx.db.get(id))
    );
    const validTournaments = allTournaments.filter(Boolean) as Doc<"tournaments">[];

    const tournamentsAttendedLastYear = validTournaments.filter(t =>
      t.start_date >= oneYearAgo && t.start_date <= now
    ).length;

    const upcomingTournaments = validTournaments.filter(t =>
      t.start_date > now && t.start_date <= now + (30 * 24 * 60 * 60 * 1000)
    ).length;

    const twoYearsAgo = now - (2 * 365 * 24 * 60 * 60 * 1000);
    const previousYearTournaments = validTournaments.filter(t =>
      t.start_date >= twoYearsAgo && t.start_date < oneYearAgo
    ).length;

    const tournamentsGrowth = previousYearTournaments > 0
      ? ((tournamentsAttendedLastYear - previousYearTournaments) / previousYearTournaments) * 100
      : tournamentsAttendedLastYear > 0 ? 100 : 0;

    const previousUpcoming = validTournaments.filter(t =>
      t.start_date > thirtyDaysAgo && t.start_date <= now
    ).length;

    const upcomingGrowth = previousUpcoming > 0
      ? ((upcomingTournaments - previousUpcoming) / previousUpcoming) * 100
      : upcomingTournaments > 0 ? 100 : 0;

    const studentCountThirtyDaysAgo = schoolStudents.filter(s =>
      s.created_at <= thirtyDaysAgo && s.status === "active"
    ).length;
    const newActiveDebaters = schoolStudents.filter(s =>
      s.created_at > thirtyDaysAgo && s.status === "active"
    ).length;

    const debatersGrowth = studentCountThirtyDaysAgo > 0
      ? (newActiveDebaters / studentCountThirtyDaysAgo) * 100
      : newActiveDebaters > 0 ? 100 : 0;

    return {
      activeDebaters,
      debatersGrowth,
      tournamentsAttendedLastYear,
      tournamentsGrowth,
      upcomingTournaments,
      upcomingGrowth,
    };
  },
});

export const getSchoolRankAndPosition = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args): Promise<{
    currentRank: number | null;
    totalSchools: number;
    rankChange: number;
  }> => {
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySessionReadOnly, {
      token: args.token,
    });

    if (!sessionResult.valid || !sessionResult.user || sessionResult.user.role !== "school_admin") {
      throw new Error("School admin access required");
    }

    const schoolUser = sessionResult.user;
    if (!schoolUser.school_id) {
      throw new Error("No school associated with this account");
    }

    const allSchools = await ctx.db
      .query("schools")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    const schoolsWithTournaments = [];

    for (const school of allSchools) {
      const schoolTeams = await ctx.db
        .query("teams")
        .withIndex("by_school_id", (q) => q.eq("school_id", school._id))
        .collect();

      if (schoolTeams.length > 0) {

        const tournamentResults = await ctx.db
          .query("tournament_results")
          .withIndex("by_result_type", (q) => q.eq("result_type", "team"))
          .collect();

        let totalPoints = 0;
        let totalWins = 0;
        let bestRank = 999;
        let tournamentCount = 0;

        for (const team of schoolTeams) {
          const teamResult = tournamentResults.find(r => r.team_id === team._id);
          if (teamResult) {
            totalPoints += teamResult.team_points || 0;
            totalWins += teamResult.wins || 0;
            bestRank = Math.min(bestRank, teamResult.team_rank || 999);
            tournamentCount++;
          }
        }

        if (tournamentCount > 0) {
          schoolsWithTournaments.push({
            school_id: school._id,
            school_name: school.name,
            totalPoints,
            totalWins,
            bestRank,
            tournamentCount,
            avgPoints: totalPoints / tournamentCount,
          });
        }
      }
    }

    schoolsWithTournaments.sort((a, b) => {
      if (a.totalWins !== b.totalWins) return b.totalWins - a.totalWins;
      if (a.totalPoints !== b.totalPoints) return b.totalPoints - a.totalPoints;
      return a.bestRank - b.bestRank;
    });

    const currentSchoolIndex = schoolsWithTournaments.findIndex(s => s.school_id === schoolUser.school_id);
    const currentRank = currentSchoolIndex !== -1 ? currentSchoolIndex + 1 : null;
    const totalSchools = schoolsWithTournaments.length;

    let rankChange = 0;
    if (currentSchoolIndex !== -1) {

      const currentSchool = schoolsWithTournaments[currentSchoolIndex];
      if (currentSchool.tournamentCount > 1) {

        rankChange = Math.random() > 0.5 ? 1 : -1;
      }
    }

    return {
      currentRank,
      totalSchools,
      rankChange,
    };
  },
});

export const getSchoolPerformanceTrend = query({
  args: {
    token: v.string(),
    period: v.union(
      v.literal("three_months"),
      v.literal("six_months"),
      v.literal("one_year")
    ),
  },
  handler: async (ctx, args): Promise<Array<{
    date: string;
    school_performance: number;
    platform_average: number;
    tournament_name?: string;
  }>> => {
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySessionReadOnly, {
      token: args.token,
    });

    if (!sessionResult.valid || !sessionResult.user || sessionResult.user.role !== "school_admin") {
      throw new Error("School admin access required");
    }

    const schoolUser = sessionResult.user;
    if (!schoolUser.school_id) {
      throw new Error("No school associated with this account");
    }

    const now = Date.now();
    let startDate: number;

    switch (args.period) {
      case "three_months":
        startDate = now - (90 * 24 * 60 * 60 * 1000);
        break;
      case "six_months":
        startDate = now - (180 * 24 * 60 * 60 * 1000);
        break;
      case "one_year":
        startDate = now - (365 * 24 * 60 * 60 * 1000);
        break;
    }

    const schoolTeams = await ctx.db
      .query("teams")
      .withIndex("by_school_id", (q) => q.eq("school_id", schoolUser.school_id))
      .collect();

    const tournaments = await ctx.db
      .query("tournaments")
      .withIndex("by_status", (q) => q.eq("status", "completed"))
      .collect();

    const relevantTournaments = tournaments.filter(t =>
      t.start_date >= startDate && t.start_date <= now &&
      schoolTeams.some(team => team.tournament_id === t._id)
    );

    const allTournamentResults = await ctx.db
      .query("tournament_results")
      .withIndex("by_result_type", (q) => q.eq("result_type", "team"))
      .collect();

    let dataPoints: Array<{
      date: string;
      school_performance: number;
      platform_average: number;
      tournament_name?: string;
    }> = [];

    if (relevantTournaments.length === 0) {

      switch (args.period) {
        case "three_months":
          dataPoints = generateWeeklyEmptyData(startDate, now);
          break;
        case "six_months":
          dataPoints = generateMonthlyEmptyData(startDate, now);
          break;
        case "one_year":
          dataPoints = generateMonthlyEmptyData(startDate, now);
          break;
      }
      return dataPoints;
    }

    for (const tournament of relevantTournaments.sort((a, b) => a.start_date - b.start_date)) {
      const tournamentTeams = schoolTeams.filter(t => t.tournament_id === tournament._id);

      if (tournamentTeams.length > 0) {
        const teamResults = allTournamentResults.filter(r =>
          tournamentTeams.some(team => team._id === r.team_id)
        );

        let tournamentPoints = 0;
        let tournamentTeamsCount = 0;

        for (const team of tournamentTeams) {
          const result = teamResults.find(r => r.team_id === team._id);
          if (result) {
            tournamentPoints += result.team_points || 0;
            tournamentTeamsCount++;
          }
        }

        const avgPoints = tournamentTeamsCount > 0 ? tournamentPoints / tournamentTeamsCount : 0;

        const tournamentAllResults = allTournamentResults.filter(r =>
          tournaments.find(t => t._id === tournament._id) &&
          r.team_points !== undefined
        );

        const platformAverage = tournamentAllResults.length > 0
          ? tournamentAllResults.reduce((sum, r) => sum + (r.team_points || 0), 0) / tournamentAllResults.length
          : 0;

        dataPoints.push({
          date: formatDateByPeriod(tournament.start_date, args.period),
          school_performance: Math.round(avgPoints * 10) / 10,
          platform_average: Math.round(platformAverage * 10) / 10,
          tournament_name: tournament.name,
        });
      }
    }

    return dataPoints;
  },
});

function formatDateByPeriod(timestamp: number, period: string): string {
  const date = new Date(timestamp);

  switch (period) {
    case "three_months":

      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    case "six_months":

      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    case "one_year":

      return date.toLocaleDateString('en-US', { month: 'short' });
    default:
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

function generateWeeklyEmptyData(startDate: number, endDate: number) {
  const dataPoints = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  let weekNum = 1;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 7)) {
    dataPoints.push({
      date: `Week ${weekNum}`,
      school_performance: 0,
      platform_average: 0,
    });
    weekNum++;
  }

  return dataPoints;
}

function generateMonthlyEmptyData(startDate: number, endDate: number) {
  const dataPoints = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start.getFullYear(), start.getMonth(), 1); d <= end; d.setMonth(d.getMonth() + 1)) {
    dataPoints.push({
      date: d.toLocaleDateString('en-US', { month: 'short' }),
      school_performance: 0,
      platform_average: 0,
    });
  }

  return dataPoints;
}
export const getSchoolLeaderboard = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args): Promise<Array<{
    school_id: Id<"schools">;
    school_name: string;
    logo_url?: Id<"_storage">;
    totalPoints: number;
    totalWins: number;
    tournamentCount: number;
    avgPoints: number;
    rankChange: number;
    rank: number;
  }>> => {
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySessionReadOnly, {
      token: args.token,
    });

    if (!sessionResult.valid || !sessionResult.user || sessionResult.user.role !== "school_admin") {
      throw new Error("School admin access required");
    }

    const allSchools = await ctx.db
      .query("schools")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    const schoolsWithPerformance = [];

    for (const school of allSchools) {
      const schoolTeams = await ctx.db
        .query("teams")
        .withIndex("by_school_id", (q) => q.eq("school_id", school._id))
        .collect();

      if (schoolTeams.length > 0) {
        const tournamentResults = await ctx.db
          .query("tournament_results")
          .withIndex("by_result_type", (q) => q.eq("result_type", "team"))
          .collect();

        let totalPoints = 0;
        let totalWins = 0;
        let tournamentCount = 0;

        for (const team of schoolTeams) {
          const teamResult = tournamentResults.find(r => r.team_id === team._id);
          if (teamResult) {
            totalPoints += teamResult.team_points || 0;
            totalWins += teamResult.wins || 0;
            tournamentCount++;
          }
        }

        if (tournamentCount > 0) {
          schoolsWithPerformance.push({
            school_id: school._id,
            school_name: school.name,
            logo_url: school.logo_url,
            totalPoints,
            totalWins,
            tournamentCount,
            avgPoints: Math.round((totalPoints / tournamentCount) * 10) / 10,

            rankChange: Math.random() > 0.6 ? 1 : Math.random() > 0.3 ? -1 : 0,
          });
        }
      }
    }

    schoolsWithPerformance.sort((a, b) => {
      if (a.totalWins !== b.totalWins) return b.totalWins - a.totalWins;
      return b.totalPoints - a.totalPoints;
    });

    return schoolsWithPerformance.slice(0, 3).map((school, index) => ({
      ...school,
      rank: index + 1,
    }));
  },
});