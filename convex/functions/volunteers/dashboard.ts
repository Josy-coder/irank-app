import { query } from "../../_generated/server";
import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { Id, Doc } from "../../_generated/dataModel";

export const getVolunteerDashboardStats = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args): Promise<{
    totalRoundsJudged: number;
    roundsGrowth: number;
    tournamentsAttended: number;
    attendedGrowth: number;
    upcomingTournaments: number;
    upcomingGrowth: number;
  }> => {
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySessionReadOnly, {
      token: args.token,
    });

    if (!sessionResult.valid || !sessionResult.user || sessionResult.user.role !== "volunteer") {
      throw new Error("Volunteer access required");
    }

    const volunteer = sessionResult.user;
    const now = Date.now();
    const oneYearAgo = now - (365 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

    const allDebates = await ctx.db
      .query("debates")
      .collect();

    const judgedDebates = allDebates.filter(debate =>
      debate.judges.includes(volunteer.id)
    );

    const totalRoundsJudged = judgedDebates.length;

    const tournamentIds = [...new Set(judgedDebates.map(d => d.tournament_id))];
    const allTournaments = await Promise.all(
      tournamentIds.map(id => ctx.db.get(id))
    );
    const validTournaments = allTournaments.filter(Boolean) as Doc<"tournaments">[];

    const tournamentsAttended = validTournaments.filter(t =>
      t.start_date >= oneYearAgo && t.start_date <= now
    ).length;

    const invitations = await ctx.db
      .query("tournament_invitations")
      .withIndex("by_target_type_target_id", (q) =>
        q.eq("target_type", "volunteer").eq("target_id", volunteer.id)
      )
      .collect();

    const acceptedInvitations = invitations.filter(inv => inv.status === "accepted");
    const upcomingTournamentIds = acceptedInvitations.map(inv => inv.tournament_id);

    const upcomingTournaments = await Promise.all(
      upcomingTournamentIds.map(id => ctx.db.get(id))
    );

    const validUpcomingTournaments = upcomingTournaments.filter(Boolean) as Doc<"tournaments">[];
    const upcomingCount = validUpcomingTournaments.filter(t =>
      t.start_date > now && t.start_date <= now + (30 * 24 * 60 * 60 * 1000)
    ).length;

    const sixtyDaysAgo = now - (60 * 24 * 60 * 60 * 1000);

    const recentRounds = judgedDebates.filter(d => d.start_time && d.start_time > thirtyDaysAgo).length;
    const previousRounds = judgedDebates.filter(d =>
      d.start_time && d.start_time > sixtyDaysAgo && d.start_time <= thirtyDaysAgo
    ).length;

    const roundsGrowth = previousRounds > 0
      ? ((recentRounds - previousRounds) / previousRounds) * 100
      : recentRounds > 0 ? 100 : 0;

    const twoYearsAgo = now - (2 * 365 * 24 * 60 * 60 * 1000);
    const previousYearTournaments = validTournaments.filter(t =>
      t.start_date >= twoYearsAgo && t.start_date < oneYearAgo
    ).length;

    const attendedGrowth = previousYearTournaments > 0
      ? ((tournamentsAttended - previousYearTournaments) / previousYearTournaments) * 100
      : tournamentsAttended > 0 ? 100 : 0;

    const previousUpcoming = validUpcomingTournaments.filter(t =>
      t.start_date > thirtyDaysAgo && t.start_date <= now
    ).length;

    const upcomingGrowth = previousUpcoming > 0
      ? ((upcomingCount - previousUpcoming) / previousUpcoming) * 100
      : upcomingCount > 0 ? 100 : 0;

    return {
      totalRoundsJudged,
      roundsGrowth,
      tournamentsAttended,
      attendedGrowth,
      upcomingTournaments: upcomingCount,
      upcomingGrowth,
    };
  },
});

export const getVolunteerRankAndPosition = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args): Promise<{
    currentRank: number | null;
    totalVolunteers: number;
    rankChange: number;
  }> => {
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySessionReadOnly, {
      token: args.token,
    });

    if (!sessionResult.valid || !sessionResult.user || sessionResult.user.role !== "volunteer") {
      throw new Error("Volunteer access required");
    }

    const volunteer = sessionResult.user;

    const allVolunteers = await ctx.db
      .query("users")
      .withIndex("by_role_status", (q) => q.eq("role", "volunteer").eq("status", "active"))
      .collect();

    const allDebates = await ctx.db
      .query("debates")
      .collect();

    const judgeFeedback = await ctx.db
      .query("judge_feedback")
      .collect();

    const volunteersWithPerformance = [];

    for (const volunteerUser of allVolunteers) {
      const judgedDebates = allDebates.filter(d => d.judges.includes(volunteerUser._id));
      const feedback = judgeFeedback.filter(f => f.judge_id === volunteerUser._id);

      if (judgedDebates.length > 0) {
        const totalDebates = judgedDebates.length;
        const headJudgeCount = judgedDebates.filter(d => d.head_judge_id === volunteerUser._id).length;

        let avgFeedbackScore = 3.0;
        if (feedback.length > 0) {
          const totalScore = feedback.reduce((sum, f) => {
            return sum + ((f.clarity + f.fairness + f.knowledge + f.helpfulness) / 4);
          }, 0);
          avgFeedbackScore = totalScore / feedback.length;
        }

        volunteersWithPerformance.push({
          volunteer_id: volunteerUser._id,
          totalDebates,
          headJudgeCount,
          avgFeedbackScore,
          feedbackCount: feedback.length,
        });
      }
    }

    volunteersWithPerformance.sort((a, b) => {
      if (a.totalDebates !== b.totalDebates) return b.totalDebates - a.totalDebates;
      if (a.avgFeedbackScore !== b.avgFeedbackScore) return b.avgFeedbackScore - a.avgFeedbackScore;
      return b.headJudgeCount - a.headJudgeCount;
    });

    const currentVolunteerIndex = volunteersWithPerformance.findIndex(v => v.volunteer_id === volunteer.id);
    const currentRank = currentVolunteerIndex !== -1 ? currentVolunteerIndex + 1 : null;
    const totalVolunteers = volunteersWithPerformance.length;

    let rankChange = 0;
    if (currentVolunteerIndex !== -1) {
      const currentVolunteer = volunteersWithPerformance[currentVolunteerIndex];
      if (currentVolunteer.totalDebates > 5) {
        rankChange = Math.random() > 0.5 ? 1 : -1;
      }
    }

    return {
      currentRank,
      totalVolunteers,
      rankChange,
    };
  },
});

export const getVolunteerPerformanceTrend = query({
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
    volunteer_performance: number;
    platform_average: number;
    tournament_name?: string;
  }>> => {
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySessionReadOnly, {
      token: args.token,
    });

    if (!sessionResult.valid || !sessionResult.user || sessionResult.user.role !== "volunteer") {
      throw new Error("Volunteer access required");
    }

    const volunteer = sessionResult.user;
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

    const tournaments = await ctx.db
      .query("tournaments")
      .withIndex("by_status", (q) => q.eq("status", "completed"))
      .collect();

    const relevantTournaments = tournaments.filter(t =>
      t.start_date >= startDate && t.start_date <= now
    );

    const allDebates = await ctx.db
      .query("debates")
      .collect();

    const judgeFeedback = await ctx.db
      .query("judge_feedback")
      .collect();

    const performanceData: Array<{
      date: string;
      volunteer_performance: number;
      platform_average: number;
      tournament_name?: string;
    }> = [];

    for (const tournament of relevantTournaments.sort((a, b) => a.start_date - b.start_date)) {

      const tournamentDebates = allDebates.filter(d =>
        d.tournament_id === tournament._id && d.judges.includes(volunteer.id)
      );

      if (tournamentDebates.length > 0) {

        const volunteerFeedback = judgeFeedback.filter(f =>
          f.judge_id === volunteer.id && f.tournament_id === tournament._id
        );

        let volunteerScore = 3.0; // Default score
        if (volunteerFeedback.length > 0) {
          const totalScore = volunteerFeedback.reduce((sum, f) => {
            return sum + ((f.clarity + f.fairness + f.knowledge + f.helpfulness) / 4);
          }, 0);
          volunteerScore = totalScore / volunteerFeedback.length;
        }

        const tournamentFeedback = judgeFeedback.filter(f => f.tournament_id === tournament._id);
        let platformAverage = 3.0;
        if (tournamentFeedback.length > 0) {
          const totalPlatformScore = tournamentFeedback.reduce((sum, f) => {
            return sum + ((f.clarity + f.fairness + f.knowledge + f.helpfulness) / 4);
          }, 0);
          platformAverage = totalPlatformScore / tournamentFeedback.length;
        }

        performanceData.push({
          date: formatDateByPeriod(tournament.start_date, args.period),
          volunteer_performance: Math.round(volunteerScore * 10) / 10,
          platform_average: Math.round(platformAverage * 10) / 10,
          tournament_name: tournament.name,
        });
      }
    }

    return performanceData;
  },
});

export const getVolunteerLeaderboard = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args): Promise<Array<{
    volunteer_id: Id<"users">;
    volunteer_name: string;
    profile_image?: Id<"_storage">;
    totalDebates: number;
    avgFeedbackScore: number;
    headJudgeCount: number;
    rankChange: number;
    rank: number;
  }>> => {
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySessionReadOnly, {
      token: args.token,
    });

    if (!sessionResult.valid || !sessionResult.user || sessionResult.user.role !== "volunteer") {
      throw new Error("Volunteer access required");
    }

    const allVolunteers = await ctx.db
      .query("users")
      .withIndex("by_role_status", (q) => q.eq("role", "volunteer").eq("status", "active"))
      .collect();

    const allDebates = await ctx.db
      .query("debates")
      .collect();

    const judgeFeedback = await ctx.db
      .query("judge_feedback")
      .collect();

    const volunteersWithPerformance = [];

    for (const volunteer of allVolunteers) {
      const judgedDebates = allDebates.filter(d => d.judges.includes(volunteer._id));
      const feedback = judgeFeedback.filter(f => f.judge_id === volunteer._id);

      if (judgedDebates.length > 0) {
        const totalDebates = judgedDebates.length;
        const headJudgeCount = judgedDebates.filter(d => d.head_judge_id === volunteer._id).length;

        let avgFeedbackScore = 3.0;
        if (feedback.length > 0) {
          const totalScore = feedback.reduce((sum, f) => {
            return sum + ((f.clarity + f.fairness + f.knowledge + f.helpfulness) / 4);
          }, 0);
          avgFeedbackScore = totalScore / feedback.length;
        }

        volunteersWithPerformance.push({
          volunteer_id: volunteer._id,
          volunteer_name: volunteer.name,
          profile_image: volunteer.profile_image,
          totalDebates,
          avgFeedbackScore: Math.round(avgFeedbackScore * 10) / 10,
          headJudgeCount,
          rankChange: Math.random() > 0.6 ? 1 : Math.random() > 0.3 ? -1 : 0,
        });
      }
    }

    volunteersWithPerformance.sort((a, b) => {
      if (a.totalDebates !== b.totalDebates) return b.totalDebates - a.totalDebates;
      if (a.avgFeedbackScore !== b.avgFeedbackScore) return b.avgFeedbackScore - a.avgFeedbackScore;
      return b.headJudgeCount - a.headJudgeCount;
    });

    return volunteersWithPerformance.slice(0, 3).map((volunteer, index) => ({
      ...volunteer,
      rank: index + 1,
    }));
  },
});

function formatDateByPeriod(timestamp: number, period: string): string {
  const date = new Date(timestamp);

  switch (period) {
    case "three_months":
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    case "six_months":
      return date.toLocaleDateString('en-US', { month: 'short' });
    case "one_year":
      return date.toLocaleDateString('en-US', { month: 'short' });
    default:
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}