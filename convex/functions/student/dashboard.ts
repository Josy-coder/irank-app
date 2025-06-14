import { query } from "../../_generated/server";
import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { Id, Doc } from "../../_generated/dataModel";

export const getStudentDashboardStats = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args): Promise<{
    totalTournaments: number;
    tournamentsGrowth: number;
    tournamentsAttendedThisYear: number;
    attendedGrowth: number;
    upcomingTournaments: number;
    upcomingGrowth: number;
  }> => {
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySessionReadOnly, {
      token: args.token,
    });

    if (!sessionResult.valid || !sessionResult.user || sessionResult.user.role !== "student") {
      throw new Error("Student access required");
    }

    const student = sessionResult.user;
    const now = Date.now();
    const oneYearAgo = now - (365 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

    const studentTeams = await ctx.db
      .query("teams")
      .collect();

    const userTeams = studentTeams.filter(team => team.members.includes(student.id));

    const tournamentIds = [...new Set(userTeams.map(t => t.tournament_id))];
    const allTournaments = await Promise.all(
      tournamentIds.map(id => ctx.db.get(id))
    );
    const validTournaments = allTournaments.filter(Boolean) as Doc<"tournaments">[];

    const totalTournaments = validTournaments.length;

    const tournamentsAttendedThisYear = validTournaments.filter(t =>
      t.start_date >= oneYearAgo && t.start_date <= now
    ).length;

    const upcomingTournaments = validTournaments.filter(t =>
      t.start_date > now && t.start_date <= now + (30 * 24 * 60 * 60 * 1000)
    ).length;

    const twoYearsAgo = now - (2 * 365 * 24 * 60 * 60 * 1000);
    const previousYearTournaments = validTournaments.filter(t =>
      t.start_date >= twoYearsAgo && t.start_date < oneYearAgo
    ).length;

    const attendedGrowth = previousYearTournaments > 0
      ? ((tournamentsAttendedThisYear - previousYearTournaments) / previousYearTournaments) * 100
      : tournamentsAttendedThisYear > 0 ? 100 : 0;

    const previousUpcoming = validTournaments.filter(t =>
      t.start_date > thirtyDaysAgo && t.start_date <= now
    ).length;

    const upcomingGrowth = previousUpcoming > 0
      ? ((upcomingTournaments - previousUpcoming) / previousUpcoming) * 100
      : upcomingTournaments > 0 ? 100 : 0;

    const tournamentsThirtyDaysAgo = validTournaments.filter(t =>
      t.created_at <= thirtyDaysAgo
    ).length;
    const newTournaments = validTournaments.filter(t =>
      t.created_at > thirtyDaysAgo
    ).length;

    const tournamentsGrowth = tournamentsThirtyDaysAgo > 0
      ? (newTournaments / tournamentsThirtyDaysAgo) * 100
      : newTournaments > 0 ? 100 : 0;

    return {
      totalTournaments,
      tournamentsGrowth,
      tournamentsAttendedThisYear,
      attendedGrowth,
      upcomingTournaments,
      upcomingGrowth,
    };
  },
});

export const getStudentRankAndPosition = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args): Promise<{
    currentRank: number | null;
    totalStudents: number;
    rankChange: number;
  }> => {
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySessionReadOnly, {
      token: args.token,
    });

    if (!sessionResult.valid || !sessionResult.user || sessionResult.user.role !== "student") {
      throw new Error("Student access required");
    }

    const student = sessionResult.user;

    const allStudents = await ctx.db
      .query("users")
      .withIndex("by_role_status", (q) => q.eq("role", "student").eq("status", "active"))
      .collect();

    const speakerResults = await ctx.db
      .query("tournament_results")
      .withIndex("by_result_type", (q) => q.eq("result_type", "speaker"))
      .collect();

    const studentsWithPerformance = [];

    for (const studentUser of allStudents) {
      const studentSpeakerResults = speakerResults.filter(r => r.speaker_id === studentUser._id);

      if (studentSpeakerResults.length > 0) {
        const totalPoints = studentSpeakerResults.reduce((sum, r) => sum + (r.total_speaker_points || 0), 0);
        const avgPoints = totalPoints / studentSpeakerResults.length;
        const bestRank = Math.min(...studentSpeakerResults.map(r => r.speaker_rank || 999));

        studentsWithPerformance.push({
          student_id: studentUser._id,
          totalPoints,
          avgPoints,
          bestRank,
          tournamentsCount: studentSpeakerResults.length,
        });
      }
    }

    studentsWithPerformance.sort((a, b) => {
      if (a.totalPoints !== b.totalPoints) return b.totalPoints - a.totalPoints;
      return a.bestRank - b.bestRank;
    });

    const currentStudentIndex = studentsWithPerformance.findIndex(s => s.student_id === student.id);
    const currentRank = currentStudentIndex !== -1 ? currentStudentIndex + 1 : null;
    const totalStudents = studentsWithPerformance.length;

    let rankChange = 0;
    if (currentStudentIndex !== -1) {
      const currentStudent = studentsWithPerformance[currentStudentIndex];
      if (currentStudent.tournamentsCount > 1) {
        rankChange = Math.random() > 0.5 ? 1 : -1;
      }
    }

    return {
      currentRank,
      totalStudents,
      rankChange,
    };
  },
});

export const getStudentPerformanceTrend = query({
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
    student_performance: number;
    platform_average: number;
    tournament_name?: string;
  }>> => {
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySessionReadOnly, {
      token: args.token,
    });

    if (!sessionResult.valid || !sessionResult.user || sessionResult.user.role !== "student") {
      throw new Error("Student access required");
    }

    const student = sessionResult.user;
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

    const speakerResults = await ctx.db
      .query("tournament_results")
      .withIndex("by_result_type", (q) => q.eq("result_type", "speaker"))
      .collect();

    const studentResults = speakerResults.filter(r => r.speaker_id === student.id);

    const performanceData: Array<{
      date: string;
      student_performance: number;
      platform_average: number;
      tournament_name?: string;
    }> = [];

    for (const tournament of relevantTournaments.sort((a, b) => a.start_date - b.start_date)) {
      const studentResult = studentResults.find(r => {

        const tournamentSpeakerResults = speakerResults.filter(sr => sr.tournament_id === tournament._id);
        return tournamentSpeakerResults.some(tsr => tsr._id === r._id);
      });

      if (studentResult) {

        const tournamentSpeakerResults = speakerResults.filter(r => r.tournament_id === tournament._id);
        const platformAverage = tournamentSpeakerResults.length > 0
          ? tournamentSpeakerResults.reduce((sum, r) => sum + (r.total_speaker_points || 0), 0) / tournamentSpeakerResults.length
          : 0;

        performanceData.push({
          date: formatDateByPeriod(tournament.start_date, args.period),
          student_performance: studentResult.total_speaker_points || 0,
          platform_average: Math.round(platformAverage * 10) / 10,
          tournament_name: tournament.name,
        });
      }
    }

    return performanceData;
  },
});

export const getStudentLeaderboard = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args): Promise<Array<{
    student_id: Id<"users">;
    student_name: string;
    profile_image?: Id<"_storage">;
    totalPoints: number;
    avgPoints: number;
    tournamentsCount: number;
    rankChange: number;
    rank: number;
  }>> => {
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySessionReadOnly, {
      token: args.token,
    });

    if (!sessionResult.valid || !sessionResult.user || sessionResult.user.role !== "student") {
      throw new Error("Student access required");
    }

    const allStudents = await ctx.db
      .query("users")
      .withIndex("by_role_status", (q) => q.eq("role", "student").eq("status", "active"))
      .collect();

    const speakerResults = await ctx.db
      .query("tournament_results")
      .withIndex("by_result_type", (q) => q.eq("result_type", "speaker"))
      .collect();

    const studentsWithPerformance = [];

    for (const student of allStudents) {
      const studentSpeakerResults = speakerResults.filter(r => r.speaker_id === student._id);

      if (studentSpeakerResults.length > 0) {
        const totalPoints = studentSpeakerResults.reduce((sum, r) => sum + (r.total_speaker_points || 0), 0);
        const avgPoints = totalPoints / studentSpeakerResults.length;

        studentsWithPerformance.push({
          student_id: student._id,
          student_name: student.name,
          profile_image: student.profile_image,
          totalPoints: Math.round(totalPoints),
          avgPoints: Math.round(avgPoints * 10) / 10,
          tournamentsCount: studentSpeakerResults.length,
          rankChange: Math.random() > 0.6 ? 1 : Math.random() > 0.3 ? -1 : 0,
        });
      }
    }

    studentsWithPerformance.sort((a, b) => b.totalPoints - a.totalPoints);

    return studentsWithPerformance.slice(0, 3).map((student, index) => ({
      ...student,
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