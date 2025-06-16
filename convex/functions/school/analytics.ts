import { mutation, query } from "../../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../../_generated/api";
import { Doc, Id } from "../../_generated/dataModel";

export const getSchoolPerformanceAnalytics = query({
  args: {
    token: v.string(),
    date_range: v.optional(v.object({
      start: v.number(),
      end: v.number(),
    })),
    compare_to_previous_period: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{
    performance_trends: Array<{
      period: string;
      avg_team_rank: number;
      avg_speaker_score: number;
      win_rate: number;
      tournaments_participated: number;
      total_points: number;
    }>;
    student_development: Array<{
      student_id: Id<"users">;
      student_name: string;
      improvement_trajectory: {
        tournaments: Array<{
          tournament_name: string;
          date: number;
          speaker_rank: number;
          speaker_points: number;
          team_rank: number;
        }>;
        trend: "improving" | "declining" | "stable";
        improvement_rate: number;
      };
      current_performance: {
        avg_speaker_score: number;
        total_tournaments: number;
        best_rank: number;
        consistency_score: number;
      };
      predicted_next_performance: {
        likely_rank_range: { min: number; max: number };
        confidence: number;
        improvement_areas: string[];
      };
    }>;
    team_performance: Array<{
      team_id: Id<"teams">;
      team_name: string;
      tournament_id: Id<"tournaments">;
      tournament_name: string;
      performance: {
        rank: number;
        wins: number;
        total_points: number;
        avg_speaker_score: number;
        debates_count: number;
      };
      member_performances: Array<{
        student_id: Id<"users">;
        student_name: string;
        speaker_rank: number;
        speaker_points: number;
        avg_score: number;
        improvement_from_last: number;
      }>;
    }>;
    benchmarking: {
      school_rank_in_region: number;
      school_rank_by_type: number;
      similar_schools_comparison: Array<{
        school_name: string;
        school_type: string;
        avg_performance: number;
        student_count: number;
      }>;
      performance_percentile: number;
    };
    financial_analytics: {
      total_investment: number;
      cost_per_student: number;
      cost_per_tournament: number;
      roi_metrics: {
        tournaments_per_rwf: number;
        ranking_improvement_per_rwf: number;
      };
      payment_history: Array<{
        tournament_name: string;
        amount: number;
        date: number;
        currency: string;
        teams_registered: number;
      }>;
    };
    insights: Array<{
      type: "achievement" | "improvement" | "concern" | "opportunity";
      title: string;
      description: string;
      confidence: number;
      actionable_suggestions: string[];
    }>;
    summary_stats: {
      total_students: number;
      active_students: number;
      total_tournaments: number;
      avg_team_rank: number;
      trends: {
        students: number | null;
        tournaments: number | null;
        performance: number | null;
      };
    };
  }> => {
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySessionReadOnly, {
      token: args.token,
    });

    if (!sessionResult.valid || !sessionResult.user || sessionResult.user.role !== "school_admin") {
      throw new Error("School admin access required");
    }

    const user = sessionResult.user;
    if (!user.school_id) {
      throw new Error("User not associated with a school");
    }

    const school = await ctx.db.get(user.school_id);
    if (!school) {
      throw new Error("School not found");
    }

    const now = Date.now();
    const dateRange = args.date_range || {
      start: now - (365 * 24 * 60 * 60 * 1000),
      end: now,
    };

    const comparisonPeriod = args.compare_to_previous_period ? {
      start: dateRange.start - (dateRange.end - dateRange.start),
      end: dateRange.start,
    } : null;

    const tournaments = await ctx.db.query("tournaments")
      .filter((q) =>
        q.and(
          q.gte(q.field("start_date"), dateRange.start),
          q.lte(q.field("start_date"), dateRange.end),
          q.eq(q.field("status"), "completed")
        )
      )
      .collect();

    const schoolTeams = await ctx.db
      .query("teams")
      .withIndex("by_school_id", (q) => q.eq("school_id", user.school_id!))
      .collect();

    const relevantTeams = schoolTeams.filter(team =>
      tournaments.some(t => t._id === team.tournament_id)
    );

    const teamResults = await Promise.all(
      relevantTeams.map(async (team) => {
        const results = await ctx.db
          .query("tournament_results")
          .withIndex("by_tournament_id_team_id", (q) =>
            q.eq("tournament_id", team.tournament_id).eq("team_id", team._id)
          )
          .first();
        return { team, results };
      })
    );

    const schoolStudents = await ctx.db
      .query("users")
      .withIndex("by_school_id_role", (q) =>
        q.eq("school_id", user.school_id!).eq("role", "student")
      )
      .collect();

    const speakerResults = await Promise.all(
      schoolStudents.map(async (student) => {
        const results = await ctx.db
          .query("tournament_results")
          .withIndex("by_speaker_id", (q) => q.eq("speaker_id", student._id))
          .collect();

        const tournamentResults = results.filter(result =>
          tournaments.some(t => t._id === result.tournament_id)
        );

        return { student, results: tournamentResults };
      })
    );

    let trends = { students: null, tournaments: null, performance: null } as {
      students: number | null;
      tournaments: number | null;
      performance: number | null;
    };

    if (comparisonPeriod) {
      const prevTournaments = await ctx.db.query("tournaments")
        .filter((q) =>
          q.and(
            q.gte(q.field("start_date"), comparisonPeriod.start),
            q.lte(q.field("start_date"), comparisonPeriod.end),
            q.eq(q.field("status"), "completed")
          )
        )
        .collect();

      const prevStudentsCount = await ctx.db
        .query("users")
        .withIndex("by_school_id_role", (q) =>
          q.eq("school_id", user.school_id!).eq("role", "student")
        )
        .filter((q) => q.lte(q.field("created_at"), comparisonPeriod.end))
        .collect();

      const prevSchoolTeams = schoolTeams.filter(team =>
        prevTournaments.some(t => t._id === team.tournament_id)
      );

      const prevTeamResults = await Promise.all(
        prevSchoolTeams.map(async (team) => {
          const results = await ctx.db
            .query("tournament_results")
            .withIndex("by_tournament_id_team_id", (q) =>
              q.eq("tournament_id", team.tournament_id).eq("team_id", team._id)
            )
            .first();
          return { team, results };
        })
      );

      if (prevStudentsCount.length > 0) {
        trends.students = ((schoolStudents.length - prevStudentsCount.length) / prevStudentsCount.length) * 100;
      }

      if (prevTournaments.length > 0) {
        trends.tournaments = ((tournaments.length - prevTournaments.length) / prevTournaments.length) * 100;
      }

      const currentAvgRank = teamResults.length > 0
        ? teamResults.reduce((sum, tr) => sum + (tr.results?.team_rank || 999), 0) / teamResults.length
        : 999;

      const prevAvgRank = prevTeamResults.length > 0
        ? prevTeamResults.reduce((sum, tr) => sum + (tr.results?.team_rank || 999), 0) / prevTeamResults.length
        : 999;

      if (prevAvgRank !== 999 && currentAvgRank !== 999) {

        trends.performance = ((prevAvgRank - currentAvgRank) / prevAvgRank) * 100;
      }
    }

    const performanceTrends = [];
    const quarters = Math.ceil((dateRange.end - dateRange.start) / (90 * 24 * 60 * 60 * 1000));

    for (let i = 0; i < quarters; i++) {
      const periodStart = dateRange.start + (i * 90 * 24 * 60 * 60 * 1000);
      const periodEnd = Math.min(periodStart + (90 * 24 * 60 * 60 * 1000), dateRange.end);

      const periodTournaments = tournaments.filter(t =>
        t.start_date >= periodStart && t.start_date < periodEnd
      );

      if (periodTournaments.length === 0) continue;

      const periodTeamResults = teamResults.filter(({ team }) =>
        periodTournaments.some(t => t._id === team.tournament_id)
      );

      const periodSpeakerResults = speakerResults.flatMap(({ results }) =>
        results.filter(result =>
          periodTournaments.some(t => t._id === result.tournament_id)
        )
      );

      const avgTeamRank = periodTeamResults.length > 0
        ? periodTeamResults.reduce((sum, { results }) => sum + (results?.team_rank || 999), 0) / periodTeamResults.length
        : 0;

      const avgSpeakerScore = periodSpeakerResults.length > 0
        ? periodSpeakerResults.reduce((sum, result) => sum + (result.average_speaker_score || 0), 0) / periodSpeakerResults.length
        : 0;

      const totalWins = periodTeamResults.reduce((sum, { results }) => sum + (results?.wins || 0), 0);
      const totalGames = periodTeamResults.reduce((sum, { results }) => sum + ((results?.wins || 0) + (results?.losses || 0)), 0);
      const winRate = totalGames > 0 ? (totalWins / totalGames) * 100 : 0;

      const totalPoints = periodSpeakerResults.reduce((sum, result) => sum + (result.total_speaker_points || 0), 0);

      performanceTrends.push({
        period: `Q${i + 1} ${new Date(periodStart).getFullYear()}`,
        avg_team_rank: Math.round(avgTeamRank * 10) / 10,
        avg_speaker_score: Math.round(avgSpeakerScore * 10) / 10,
        win_rate: Math.round(winRate * 10) / 10,
        tournaments_participated: periodTournaments.length,
        total_points: totalPoints,
      });
    }

    const studentDevelopment = await Promise.all(
      schoolStudents.map(async (student) => {
        const studentResults = speakerResults.find(sr => sr.student._id === student._id)?.results || [];

        if (studentResults.length === 0) {
          return {
            student_id: student._id,
            student_name: student.name,
            improvement_trajectory: {
              tournaments: [],
              trend: "stable" as const,
              improvement_rate: 0,
            },
            current_performance: {
              avg_speaker_score: 0,
              total_tournaments: 0,
              best_rank: 999,
              consistency_score: 0,
            },
            predicted_next_performance: {
              likely_rank_range: { min: 999, max: 999 },
              confidence: 0,
              improvement_areas: [],
            },
          };
        }

        const tournamentPerformances = await Promise.all(
          studentResults.map(async (result) => {
            const tournament = tournaments.find(t => t._id === result.tournament_id);
            const teamResult = teamResults.find(tr =>
              tr.results && tr.team.members.includes(student._id) && tr.team.tournament_id === result.tournament_id
            );

            return {
              tournament_name: tournament?.name || "Unknown",
              date: tournament?.start_date || 0,
              speaker_rank: result.speaker_rank || 999,
              speaker_points: result.total_speaker_points || 0,
              team_rank: teamResult?.results?.team_rank || 999,
            };
          })
        );

        tournamentPerformances.sort((a, b) => a.date - b.date);

        let trend: "improving" | "declining" | "stable" = "stable";
        let improvementRate = 0;

        if (tournamentPerformances.length >= 2) {
          const firstHalf = tournamentPerformances.slice(0, Math.ceil(tournamentPerformances.length / 2));
          const secondHalf = tournamentPerformances.slice(Math.ceil(tournamentPerformances.length / 2));

          const firstHalfAvgRank = firstHalf.reduce((sum, p) => sum + p.speaker_rank, 0) / firstHalf.length;
          const secondHalfAvgRank = secondHalf.reduce((sum, p) => sum + p.speaker_rank, 0) / secondHalf.length;

          const rankChange = firstHalfAvgRank - secondHalfAvgRank;
          improvementRate = Math.abs(rankChange / firstHalfAvgRank) * 100;

          if (rankChange > firstHalfAvgRank * 0.1) {
            trend = "improving";
          } else if (rankChange < -firstHalfAvgRank * 0.1) {
            trend = "declining";
          }
        }

        const avgScore = studentResults.reduce((sum, r) => sum + (r.average_speaker_score || 0), 0) / studentResults.length;
        const bestRank = Math.min(...studentResults.map(r => r.speaker_rank || 999));

        const ranks = studentResults.map(r => r.speaker_rank || 999);
        const avgRank = ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length;
        const variance = ranks.reduce((sum, rank) => sum + Math.pow(rank - avgRank, 2), 0) / ranks.length;
        const consistency = Math.max(0, 100 - Math.sqrt(variance));

        let predictedRankRange = { min: bestRank, max: Math.min(bestRank + 10, 999) };
        let confidence = 50;
        const improvementAreas: string[] = [];

        if (trend === "improving") {
          predictedRankRange = {
            min: Math.max(1, bestRank - Math.ceil(improvementRate * 0.2)),
            max: bestRank
          };
          confidence = Math.min(85, 60 + improvementRate);
        } else if (trend === "declining") {
          predictedRankRange = {
            min: bestRank,
            max: Math.min(999, bestRank + Math.ceil(improvementRate * 0.3))
          };
          confidence = Math.min(75, 50 + improvementRate * 0.5);
          improvementAreas.push("Focus on consistency", "Review recent feedback");
        }

        if (avgScore < 20) {
          improvementAreas.push("Work on content knowledge and argumentation");
        }
        if (consistency < 70) {
          improvementAreas.push("Focus on maintaining consistent performance");
        }
        if (tournamentPerformances.length < 3) {
          improvementAreas.push("Participate in more tournaments for experience");
        }

        return {
          student_id: student._id,
          student_name: student.name,
          improvement_trajectory: {
            tournaments: tournamentPerformances,
            trend,
            improvement_rate: Math.round(improvementRate * 10) / 10,
          },
          current_performance: {
            avg_speaker_score: Math.round(avgScore * 10) / 10,
            total_tournaments: studentResults.length,
            best_rank: bestRank,
            consistency_score: Math.round(consistency * 10) / 10,
          },
          predicted_next_performance: {
            likely_rank_range: predictedRankRange,
            confidence: Math.round(confidence),
            improvement_areas: improvementAreas,
          },
        };
      })
    );

    const teamPerformance = await Promise.all(
      relevantTeams.map(async (team) => {
        const tournament = tournaments.find(t => t._id === team.tournament_id);
        const results = teamResults.find(tr => tr.team._id === team._id)?.results;

        const memberPerformances = await Promise.all(
          team.members.map(async (memberId) => {
            const member = await ctx.db.get(memberId);
            const memberResult = await ctx.db
              .query("tournament_results")
              .withIndex("by_tournament_id_speaker_id", (q) =>
                q.eq("tournament_id", team.tournament_id).eq("speaker_id", memberId)
              )
              .first();

            const previousResults = await ctx.db
              .query("tournament_results")
              .withIndex("by_speaker_id", (q) => q.eq("speaker_id", memberId))
              .collect();

            const sortedResults = previousResults
              .filter(r => tournaments.find(t => t._id === r.tournament_id && t.start_date < tournament!.start_date))
              .sort((a, b) => {
                const tournamentA = tournaments.find(t => t._id === a.tournament_id);
                const tournamentB = tournaments.find(t => t._id === b.tournament_id);
                return (tournamentB?.start_date || 0) - (tournamentA?.start_date || 0);
              });

            const previousResult = sortedResults[0];
            const improvementFromLast = previousResult
              ? (previousResult.speaker_rank || 999) - (memberResult?.speaker_rank || 999)
              : 0;

            return {
              student_id: memberId,
              student_name: member?.name || "Unknown",
              speaker_rank: memberResult?.speaker_rank || 999,
              speaker_points: memberResult?.total_speaker_points || 0,
              avg_score: memberResult?.average_speaker_score || 0,
              improvement_from_last: improvementFromLast,
            };
          })
        );

        return {
          team_id: team._id,
          team_name: team.name,
          tournament_id: team.tournament_id,
          tournament_name: tournament?.name || "Unknown",
          performance: {
            rank: results?.team_rank || 999,
            wins: results?.wins || 0,
            total_points: results?.team_points || 0,
            avg_speaker_score: memberPerformances.reduce((sum, m) => sum + m.avg_score, 0) / memberPerformances.length,
            debates_count: (results?.wins || 0) + (results?.losses || 0),
          },
          member_performances: memberPerformances.sort((a, b) => a.speaker_rank - b.speaker_rank),
        };
      })
    );

    const allSchools = await ctx.db.query("schools")
      .filter((q) => q.eq(q.field("country"), school.country))
      .collect();

    const schoolsByType = allSchools.filter(s => s.type === school.type);

    const similarSchoolsData = await Promise.all(
      schoolsByType.slice(0, 10).map(async (similarSchool) => {
        if (similarSchool._id === school._id) return null;

        const similarSchoolTeams = await ctx.db
          .query("teams")
          .withIndex("by_school_id", (q) => q.eq("school_id", similarSchool._id))
          .collect();

        const similarSchoolResults = await Promise.all(
          similarSchoolTeams.map(async (team) => {
            return await ctx.db
              .query("tournament_results")
              .withIndex("by_team_id", (q) => q.eq("team_id", team._id))
              .first();
          })
        );

        const validResults = similarSchoolResults.filter(Boolean);
        const avgPerformance = validResults.length > 0
          ? validResults.reduce((sum, result) => sum + (1000 - (result!.team_rank || 999)), 0) / validResults.length
          : 0;

        const studentCount = await ctx.db
          .query("users")
          .withIndex("by_school_id_role", (q) =>
            q.eq("school_id", similarSchool._id).eq("role", "student")
          )
          .collect();

        return {
          school_name: similarSchool.name,
          school_type: similarSchool.type,
          avg_performance: Math.round(avgPerformance),
          student_count: studentCount.length,
        };
      })
    );

    const similarSchools = similarSchoolsData.filter(Boolean) as any[];

    const schoolAvgPerformance = teamResults.length > 0
      ? teamResults.reduce((sum, { results }) => sum + (1000 - (results?.team_rank || 999)), 0) / teamResults.length
      : 0;

    const schoolsBetter = similarSchools.filter(s => s.avg_performance > schoolAvgPerformance).length;
    const performancePercentile = similarSchools.length > 0
      ? ((similarSchools.length - schoolsBetter) / similarSchools.length) * 100
      : 50;

    const payments = await ctx.db
      .query("payments")
      .withIndex("by_school_id", (q) => q.eq("school_id", user.school_id!))
      .collect();

    const relevantPayments = payments.filter(payment =>
      payment.created_at >= dateRange.start &&
      payment.created_at <= dateRange.end &&
      payment.status === "completed"
    );

    const totalInvestment = relevantPayments.reduce((sum, payment) => sum + payment.amount, 0);
    const uniqueTournaments = new Set(relevantPayments.map(p => p.tournament_id)).size;
    const totalTeamsRegistered = relevantTeams.length;

    const paymentHistory = await Promise.all(
      relevantPayments.map(async (payment) => {
        const tournament = await ctx.db.get(payment.tournament_id);
        const tournamentTeams = relevantTeams.filter(t => t.tournament_id === payment.tournament_id);

        return {
          tournament_name: tournament?.name || "Unknown",
          amount: payment.amount,
          date: payment.created_at,
          currency: payment.currency,
          teams_registered: tournamentTeams.length,
        };
      })
    );

    const insights: any[] = [];

    const topPerformers = studentDevelopment
      .filter(s => s.current_performance.best_rank <= 10)
      .sort((a, b) => a.current_performance.best_rank - b.current_performance.best_rank);

    if (topPerformers.length > 0) {
      insights.push({
        type: "achievement",
        title: `Top 10 Performers: ${topPerformers.length} students`,
        description: `${topPerformers[0].student_name} achieved rank #${topPerformers[0].current_performance.best_rank}`,
        confidence: 95,
        actionable_suggestions: [
          "Celebrate and showcase these achievements",
          "Have top performers mentor newer students",
          "Consider entering them in higher-level competitions"
        ],
      });
    }

    const improvingStudents = studentDevelopment.filter(s => s.improvement_trajectory.trend === "improving");
    if (improvingStudents.length > 0) {
      insights.push({
        type: "improvement",
        title: `${improvingStudents.length} students showing improvement`,
        description: `Average improvement rate: ${(improvingStudents.reduce((sum, s) => sum + s.improvement_trajectory.improvement_rate, 0) / improvingStudents.length).toFixed(1)}%`,
        confidence: 80,
        actionable_suggestions: [
          "Continue current coaching methods",
          "Document what's working well",
          "Share successful strategies with other students"
        ],
      });
    }

    const decliningStudents = studentDevelopment.filter(s => s.improvement_trajectory.trend === "declining");
    if (decliningStudents.length > 0) {
      insights.push({
        type: "concern",
        title: `${decliningStudents.length} students showing decline`,
        description: "Some students may need additional support",
        confidence: 75,
        actionable_suggestions: [
          "Review individual feedback and identify common issues",
          "Provide additional coaching or mentoring",
          "Consider adjusting tournament participation strategy"
        ],
      });
    }

    if (performancePercentile > 75) {
      insights.push({
        type: "opportunity",
        title: "School performing above average",
        description: `Your school is in the ${Math.round(performancePercentile)}th percentile`,
        confidence: 85,
        actionable_suggestions: [
          "Consider participating in higher-tier competitions",
          "Share your school's success strategies with the community",
          "Expand your debate program"
        ],
      });
    }

    if (totalInvestment > 0 && uniqueTournaments > 0) {
      const costPerTournament = totalInvestment / uniqueTournaments;
      const avgTournamentFee = costPerTournament / (totalTeamsRegistered / uniqueTournaments || 1);

      if (avgTournamentFee > 50000) {
        insights.push({
          type: "opportunity",
          title: "High tournament participation costs",
          description: `Average cost per tournament: ${avgTournamentFee.toLocaleString()} RWF`,
          confidence: 70,
          actionable_suggestions: [
            "Look for tournaments with reduced fees for multiple teams",
            "Consider hosting your own tournament to offset costs",
            "Seek sponsorship opportunities"
          ],
        });
      }
    }

    const sixMonthsAgo = now - (180 * 24 * 60 * 60 * 1000);
    const recentTournaments = await ctx.db.query("tournaments")
      .filter((q) =>
        q.and(
          q.gte(q.field("start_date"), sixMonthsAgo),
          q.lte(q.field("start_date"), now)
        )
      )
      .collect();

    const recentTeams = schoolTeams.filter(team =>
      recentTournaments.some(t => t._id === team.tournament_id)
    );

    const activeStudentIds = new Set();
    recentTeams.forEach(team => {
      team.members.forEach(memberId => activeStudentIds.add(memberId));
    });

    return {
      performance_trends: performanceTrends,
      student_development: studentDevelopment,
      team_performance: teamPerformance,
      benchmarking: {
        school_rank_in_region: schoolsBetter + 1,
        school_rank_by_type: schoolsBetter + 1,
        similar_schools_comparison: similarSchools,
        performance_percentile: Math.round(performancePercentile),
      },
      financial_analytics: {
        total_investment: totalInvestment,
        cost_per_student: schoolStudents.length > 0 ? totalInvestment / schoolStudents.length : 0,
        cost_per_tournament: uniqueTournaments > 0 ? totalInvestment / uniqueTournaments : 0,
        roi_metrics: {
          tournaments_per_rwf: totalInvestment > 0 ? uniqueTournaments / (totalInvestment / 1000) : 0,
          ranking_improvement_per_rwf: totalInvestment > 0 && performanceTrends.length >= 2
            ? (performanceTrends[performanceTrends.length - 1].avg_team_rank - performanceTrends[0].avg_team_rank) / (totalInvestment / 1000)
            : 0,
        },
        payment_history: paymentHistory.sort((a, b) => b.date - a.date),
      },
      insights: insights,
      summary_stats: {
        total_students: schoolStudents.length,
        active_students: activeStudentIds.size,
        total_tournaments: tournaments.length,
        avg_team_rank: teamResults.length > 0
          ? teamResults.reduce((sum, { results }) => sum + (results?.team_rank || 999), 0) / teamResults.length
          : 0,
        trends: trends,
      },
    };
  },
});

export const getSchoolOperationalAnalytics = query({
  args: {
    token: v.string(),
    date_range: v.optional(v.object({
      start: v.number(),
      end: v.number(),
    })),
  },
  handler: async (ctx, args): Promise<{
    student_engagement: {
      total_students: number;
      active_students: number;
      inactive_students: number;
      new_registrations: number;
      dropout_rate: number;
      engagement_trends: Array<{
        period: string;
        active_count: number;
        participation_rate: number;
        tournament_signups: number;
      }>;
      student_activity_distribution: Array<{
        activity_level: "high" | "medium" | "low" | "inactive";
        count: number;
        percentage: number;
      }>;
    };
    resource_utilization: {
      tournaments_participated: number;
      teams_formed: number;
      avg_team_size: number;
      team_formation_patterns: Array<{
        tournament_name: string;
        teams_registered: number;
        students_participated: number;
        formation_efficiency: number;
      }>;
      geographic_reach: Array<{
        tournament_location: string;
        distance_km: number;
        participation_count: number;
        travel_cost_estimate: number;
      }>;
    };
    seasonal_trends: {
      performance_by_season: Array<{
        season: "Q1" | "Q2" | "Q3" | "Q4";
        year: number;
        tournaments_participated: number;
        avg_performance: number;
        student_participation: number;
        improvement_rate: number;
      }>;
      tournament_preferences: Array<{
        tournament_format: string;
        participation_count: number;
        avg_performance: number;
        preference_score: number;
      }>;
    };
    coaching_effectiveness: {
      student_improvement_correlation: Array<{
        coaching_period: string;
        students_improved: number;
        students_declined: number;
        avg_improvement_rate: number;
        coaching_roi: number;
      }>;
      feedback_analysis: {
        common_strengths: Array<{ strength: string; frequency: number }>;
        common_weaknesses: Array<{ weakness: string; frequency: number }>;
        improvement_suggestions: Array<{ suggestion: string; effectiveness_score: number }>;
      };
    };
  }> => {
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySessionReadOnly, {
      token: args.token,
    });

    if (!sessionResult.valid || !sessionResult.user || sessionResult.user.role !== "school_admin") {
      throw new Error("School admin access required");
    }

    const user = sessionResult.user;
    if (!user.school_id) {
      throw new Error("User not associated with a school");
    }

    const now = Date.now();
    const dateRange = args.date_range || {
      start: now - (365 * 24 * 60 * 60 * 1000),
      end: now,
    };

    const schoolStudents = await ctx.db
      .query("users")
      .withIndex("by_school_id_role", (q) =>
        q.eq("school_id", user.school_id!).eq("role", "student")
      )
      .collect();

    const schoolTeams = await ctx.db
      .query("teams")
      .withIndex("by_school_id", (q) => q.eq("school_id", user.school_id!))
      .collect();

    const tournaments = await Promise.all(
      schoolTeams.map(async (team) => {
        return await ctx.db.get(team.tournament_id);
      })
    );

    const validTournaments = tournaments.filter(Boolean).filter(t =>
      t!.start_date >= dateRange.start && t!.start_date <= dateRange.end
    ) as Doc<"tournaments">[];

    const relevantTeams = schoolTeams.filter(team =>
      validTournaments.some(t => t._id === team.tournament_id)
    );

    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = now - (60 * 24 * 60 * 60 * 1000);

    const activeStudents = schoolStudents.filter(student => {
      const recentParticipation = relevantTeams.some(team =>
        team.members.includes(student._id) &&
        validTournaments.find(t => t._id === team.tournament_id && t.start_date >= thirtyDaysAgo)
      );
      return recentParticipation || (student.last_login_at && student.last_login_at >= thirtyDaysAgo);
    });

    const newRegistrations = schoolStudents.filter(student =>
      student.created_at >= dateRange.start && student.created_at <= dateRange.end
    );

    const previousPeriodStudents = schoolStudents.filter(student =>
      student.created_at < dateRange.start
    );

    const activeInPreviousPeriod = previousPeriodStudents.filter(student => {
      return relevantTeams.some(team =>
        team.members.includes(student._id) &&
        validTournaments.find(t => t._id === team.tournament_id && t.start_date < sixtyDaysAgo)
      );
    });

    const stillActive = activeInPreviousPeriod.filter(student =>
      activeStudents.some(active => active._id === student._id)
    );

    const dropoutRate = activeInPreviousPeriod.length > 0
      ? ((activeInPreviousPeriod.length - stillActive.length) / activeInPreviousPeriod.length) * 100
      : 0;

    const engagementTrends = [];
    const months = Math.ceil((dateRange.end - dateRange.start) / (30 * 24 * 60 * 60 * 1000));

    for (let i = 0; i < months; i++) {
      const periodStart = dateRange.start + (i * 30 * 24 * 60 * 60 * 1000);
      const periodEnd = Math.min(periodStart + (30 * 24 * 60 * 60 * 1000), dateRange.end);

      const periodTournaments = validTournaments.filter(t =>
        t.start_date >= periodStart && t.start_date < periodEnd
      );

      const periodTeams = relevantTeams.filter(team =>
        periodTournaments.some(t => t._id === team.tournament_id)
      );

      const uniqueStudents = new Set();
      periodTeams.forEach(team => {
        team.members.forEach(memberId => uniqueStudents.add(memberId));
      });

      const tournamentSignups = periodTeams.length;
      const participationRate = schoolStudents.length > 0
        ? (uniqueStudents.size / schoolStudents.length) * 100
        : 0;

      engagementTrends.push({
        period: new Date(periodStart).toISOString().slice(0, 7),
        active_count: uniqueStudents.size,
        participation_rate: Math.round(participationRate * 10) / 10,
        tournament_signups: tournamentSignups,
      });
    }

    const activityLevels = new Map<string, number>();
    schoolStudents.forEach(student => {
      const studentTeams = relevantTeams.filter(team => team.members.includes(student._id));
      const participationCount = studentTeams.length;

      let level: "high" | "medium" | "low" | "inactive";
      if (participationCount === 0) {
        level = "inactive";
      } else if (participationCount >= 5) {
        level = "high";
      } else if (participationCount >= 2) {
        level = "medium";
      } else {
        level = "low";
      }

      activityLevels.set(level, (activityLevels.get(level) || 0) + 1);
    });

    const studentActivityDistribution = Array.from(activityLevels.entries()).map(([level, count]) => ({
      activity_level: level as "high" | "medium" | "low" | "inactive",
      count,
      percentage: Math.round((count / schoolStudents.length) * 100 * 10) / 10,
    }));

    const teamFormationPatterns = await Promise.all(
      validTournaments.map(async (tournament) => {
        const tournamentTeams = relevantTeams.filter(team => team.tournament_id === tournament._id);
        const studentsParticipated = new Set();
        tournamentTeams.forEach(team => {
          team.members.forEach(memberId => studentsParticipated.add(memberId));
        });

        const formationEfficiency = schoolStudents.length > 0
          ? (studentsParticipated.size / schoolStudents.length) * 100
          : 0;

        return {
          tournament_name: tournament.name,
          teams_registered: tournamentTeams.length,
          students_participated: studentsParticipated.size,
          formation_efficiency: Math.round(formationEfficiency * 10) / 10,
        };
      })
    );

    const geographicReach = await Promise.all(
      validTournaments.map(async (tournament) => {
        const participationCount = relevantTeams.filter(team => team.tournament_id === tournament._id).length;
        const estimatedDistance = tournament.location ? 50 : 0;
        const travelCostEstimate = estimatedDistance * participationCount * 500;

        return {
          tournament_location: tournament.location || "Virtual",
          distance_km: estimatedDistance,
          participation_count: participationCount,
          travel_cost_estimate: travelCostEstimate,
        };
      })
    );

    const seasonalPerformance = [];
    const currentYear = new Date().getFullYear();
    const years = [currentYear - 1, currentYear];

    for (const year of years) {
      for (let quarter = 1; quarter <= 4; quarter++) {
        const quarterStart = new Date(year, (quarter - 1) * 3, 1).getTime();
        const quarterEnd = new Date(year, quarter * 3, 0).getTime();

        const quarterTournaments = validTournaments.filter(t =>
          t.start_date >= quarterStart && t.start_date <= quarterEnd
        );

        if (quarterTournaments.length === 0) continue;

        const quarterTeams = relevantTeams.filter(team =>
          quarterTournaments.some(t => t._id === team.tournament_id)
        );

        const quarterResults = await Promise.all(
          quarterTeams.map(async (team) => {
            return await ctx.db
              .query("tournament_results")
              .withIndex("by_team_id", (q) => q.eq("team_id", team._id))
              .first();
          })
        );

        const validResults = quarterResults.filter(Boolean);
        const avgPerformance = validResults.length > 0
          ? validResults.reduce((sum, result) => sum + (1000 - (result!.team_rank || 999)), 0) / validResults.length
          : 0;

        const uniqueStudents = new Set();
        quarterTeams.forEach(team => {
          team.members.forEach(memberId => uniqueStudents.add(memberId));
        });

        const prevQuarterStart = quarterStart - (90 * 24 * 60 * 60 * 1000);
        const prevQuarterEnd = quarterStart;
        const prevQuarterTournaments = validTournaments.filter(t =>
          t.start_date >= prevQuarterStart && t.start_date < prevQuarterEnd
        );

        const prevQuarterTeams = relevantTeams.filter(team =>
          prevQuarterTournaments.some(t => t._id === team.tournament_id)
        );

        const prevQuarterResults = await Promise.all(
          prevQuarterTeams.map(async (team) => {
            return await ctx.db
              .query("tournament_results")
              .withIndex("by_team_id", (q) => q.eq("team_id", team._id))
              .first();
          })
        );

        const prevValidResults = prevQuarterResults.filter(Boolean);
        const prevAvgPerformance = prevValidResults.length > 0
          ? prevValidResults.reduce((sum, result) => sum + (1000 - (result!.team_rank || 999)), 0) / prevValidResults.length
          : 0;

        const improvementRate = prevAvgPerformance > 0
          ? ((avgPerformance - prevAvgPerformance) / prevAvgPerformance) * 100
          : 0;

        seasonalPerformance.push({
          season: `Q${quarter}` as "Q1" | "Q2" | "Q3" | "Q4",
          year: year,
          tournaments_participated: quarterTournaments.length,
          avg_performance: Math.round(avgPerformance),
          student_participation: uniqueStudents.size,
          improvement_rate: Math.round(improvementRate * 10) / 10,
        });
      }
    }

    const formatPreferences = new Map<string, { count: number; performance: number[] }>();

    for (const tournament of validTournaments) {
      const tournamentTeams = relevantTeams.filter(team => team.tournament_id === tournament._id);

      if (!formatPreferences.has(tournament.format)) {
        formatPreferences.set(tournament.format, { count: 0, performance: [] });
      }

      const formatData = formatPreferences.get(tournament.format)!;
      formatData.count += tournamentTeams.length;

      const tournamentResults = await Promise.all(
        tournamentTeams.map(async (team) => {
          return await ctx.db
            .query("tournament_results")
            .withIndex("by_team_id", (q) => q.eq("team_id", team._id))
            .first();
        })
      );

      const validResults = tournamentResults.filter(Boolean);
      const performances = validResults.map(result => 1000 - (result!.team_rank || 999));
      formatData.performance.push(...performances);
    }

    const tournamentPreferences = Array.from(formatPreferences.entries()).map(([format, data]) => {
      const avgPerformance = data.performance.length > 0
        ? data.performance.reduce((sum, perf) => sum + perf, 0) / data.performance.length
        : 0;

      const preferenceScore = (data.count * 0.6) + (avgPerformance * 0.4);

      return {
        tournament_format: format,
        participation_count: data.count,
        avg_performance: Math.round(avgPerformance),
        preference_score: Math.round(preferenceScore * 10) / 10,
      };
    }).sort((a, b) => b.preference_score - a.preference_score);

    const coachingPeriods = [];
    const sixMonthPeriods = Math.ceil((dateRange.end - dateRange.start) / (180 * 24 * 60 * 60 * 1000));

    for (let i = 0; i < sixMonthPeriods; i++) {
      const periodStart = dateRange.start + (i * 180 * 24 * 60 * 60 * 1000);
      const periodEnd = Math.min(periodStart + (180 * 24 * 60 * 60 * 1000), dateRange.end);

      const periodTournaments = validTournaments.filter(t =>
        t.start_date >= periodStart && t.start_date < periodEnd
      );

      if (periodTournaments.length === 0) continue;

      let studentsImproved = 0;
      let studentsDeclined = 0;
      let totalImprovementRate = 0;
      let studentsWithData = 0;

      for (const student of schoolStudents) {
        const studentResults = await ctx.db
          .query("tournament_results")
          .withIndex("by_speaker_id", (q) => q.eq("speaker_id", student._id))
          .collect();

        const periodResults = studentResults.filter(result =>
          periodTournaments.some(t => t._id === result.tournament_id)
        ).sort((a, b) => {
          const tournamentA = validTournaments.find(t => t._id === a.tournament_id);
          const tournamentB = validTournaments.find(t => t._id === b.tournament_id);
          return (tournamentA?.start_date || 0) - (tournamentB?.start_date || 0);
        });

        if (periodResults.length < 2) continue;

        const firstResult = periodResults[0];
        const lastResult = periodResults[periodResults.length - 1];

        const improvementRate = ((firstResult.speaker_rank || 999) - (lastResult.speaker_rank || 999)) / (firstResult.speaker_rank || 999) * 100;

        if (improvementRate > 5) {
          studentsImproved++;
        } else if (improvementRate < -5) {
          studentsDeclined++;
        }

        totalImprovementRate += improvementRate;
        studentsWithData++;
      }

      const avgImprovementRate = studentsWithData > 0 ? totalImprovementRate / studentsWithData : 0;
      const coachingROI = avgImprovementRate > 0 ? avgImprovementRate * 10 : 0;

      coachingPeriods.push({
        coaching_period: `${new Date(periodStart).toISOString().slice(0, 7)} to ${new Date(periodEnd).toISOString().slice(0, 7)}`,
        students_improved: studentsImproved,
        students_declined: studentsDeclined,
        avg_improvement_rate: Math.round(avgImprovementRate * 10) / 10,
        coaching_roi: Math.round(coachingROI * 10) / 10,
      });
    }

    const judgingScores = await ctx.db.query("judging_scores").collect();
    const schoolDebates = await Promise.all(
      relevantTeams.map(async (team) => {
        const debates = await ctx.db
          .query("debates")
          .withIndex("by_tournament_id", (q) => q.eq("tournament_id", team.tournament_id))
          .collect();
        return debates.filter(d =>
          d.proposition_team_id === team._id || d.opposition_team_id === team._id
        );
      })
    );

    const allSchoolDebates = schoolDebates.flat();
    const schoolJudgingScores = judgingScores.filter(score =>
      allSchoolDebates.some(debate => debate._id === score.debate_id)
    );

    const strengthsMap = new Map<string, number>();
    const weaknessesMap = new Map<string, number>();
    const suggestionsMap = new Map<string, number>();

    schoolJudgingScores.forEach(score => {
      score.speaker_scores.forEach(speakerScore => {
        if (schoolStudents.some(student => student._id === speakerScore.speaker_id)) {
          if (speakerScore.comments) {
            const words = speakerScore.comments.toLowerCase().split(/\s+/);

            const positiveWords = ['excellent', 'strong', 'good', 'clear', 'confident', 'logical', 'persuasive'];
            const negativeWords = ['weak', 'unclear', 'nervous', 'confused', 'poor', 'needs improvement'];

            positiveWords.forEach(word => {
              if (words.includes(word)) {
                strengthsMap.set(word, (strengthsMap.get(word) || 0) + 1);
              }
            });

            negativeWords.forEach(word => {
              if (words.includes(word)) {
                weaknessesMap.set(word, (weaknessesMap.get(word) || 0) + 1);
              }
            });

            if (words.includes('practice') || words.includes('work on') || words.includes('improve')) {
              suggestionsMap.set('practice more', (suggestionsMap.get('practice more') || 0) + 1);
            }
            if (words.includes('evidence') || words.includes('research')) {
              suggestionsMap.set('strengthen evidence', (suggestionsMap.get('strengthen evidence') || 0) + 1);
            }
            if (words.includes('speaking') || words.includes('delivery')) {
              suggestionsMap.set('improve delivery', (suggestionsMap.get('improve delivery') || 0) + 1);
            }
          }
        }
      });
    });

    const commonStrengths = Array.from(strengthsMap.entries())
      .map(([strength, frequency]) => ({ strength, frequency }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5);

    const commonWeaknesses = Array.from(weaknessesMap.entries())
      .map(([weakness, frequency]) => ({ weakness, frequency }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5);

    const improvementSuggestions = Array.from(suggestionsMap.entries())
      .map(([suggestion, frequency]) => ({
        suggestion,
        effectiveness_score: Math.min(100, frequency * 10)
      }))
      .sort((a, b) => b.effectiveness_score - a.effectiveness_score)
      .slice(0, 5);

    return {
      student_engagement: {
        total_students: schoolStudents.length,
        active_students: activeStudents.length,
        inactive_students: schoolStudents.length - activeStudents.length,
        new_registrations: newRegistrations.length,
        dropout_rate: Math.round(dropoutRate * 10) / 10,
        engagement_trends: engagementTrends,
        student_activity_distribution: studentActivityDistribution,
      },
      resource_utilization: {
        tournaments_participated: validTournaments.length,
        teams_formed: relevantTeams.length,
        avg_team_size: relevantTeams.length > 0
          ? Math.round((relevantTeams.reduce((sum, team) => sum + team.members.length, 0) / relevantTeams.length) * 10) / 10
          : 0,
        team_formation_patterns: teamFormationPatterns,
        geographic_reach: geographicReach,
      },
      seasonal_trends: {
        performance_by_season: seasonalPerformance,
        tournament_preferences: tournamentPreferences,
      },
      coaching_effectiveness: {
        student_improvement_correlation: coachingPeriods,
        feedback_analysis: {
          common_strengths: commonStrengths,
          common_weaknesses: commonWeaknesses,
          improvement_suggestions: improvementSuggestions,
        },
      },
    };
  },
});

export const exportSchoolAnalyticsData = query({
  args: {
    token: v.string(),
    export_format: v.union(v.literal("csv"), v.literal("excel"), v.literal("pdf")),
    sections: v.array(v.string()),
    date_range: v.optional(v.object({
      start: v.number(),
      end: v.number(),
    })),
  },
  handler: async (ctx, args): Promise<Record<string, any>> => {
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySessionReadOnly, {
      token: args.token,
    });

    if (!sessionResult.valid || !sessionResult.user || sessionResult.user.role !== "school_admin") {
      throw new Error("School admin access required");
    }

    const exportData: Record<string, any> = {};

    if (args.sections.includes("performance")) {
      const performanceData = await ctx.runQuery(api.functions.school.analytics.getSchoolPerformanceAnalytics, {
        token: args.token,
        date_range: args.date_range,
      });

      exportData.performance_trends = performanceData.performance_trends;
      exportData.student_development = performanceData.student_development.map(student => ({
        student_name: student.student_name,
        avg_speaker_score: student.current_performance.avg_speaker_score,
        total_tournaments: student.current_performance.total_tournaments,
        best_rank: student.current_performance.best_rank,
        consistency_score: student.current_performance.consistency_score,
        trend: student.improvement_trajectory.trend,
        improvement_rate: student.improvement_trajectory.improvement_rate,
        predicted_min_rank: student.predicted_next_performance.likely_rank_range.min,
        predicted_max_rank: student.predicted_next_performance.likely_rank_range.max,
        confidence: student.predicted_next_performance.confidence,
      }));
      exportData.team_performance = performanceData.team_performance.map(team => ({
        team_name: team.team_name,
        tournament_name: team.tournament_name,
        rank: team.performance.rank,
        wins: team.performance.wins,
        total_points: team.performance.total_points,
        avg_speaker_score: team.performance.avg_speaker_score,
        debates_count: team.performance.debates_count,
      }));
      exportData.financial_summary = {
        total_investment: performanceData.financial_analytics.total_investment,
        cost_per_student: performanceData.financial_analytics.cost_per_student,
        cost_per_tournament: performanceData.financial_analytics.cost_per_tournament,
      };
    }

    if (args.sections.includes("operational")) {
      const operationalData = await ctx.runQuery(api.functions.school.analytics.getSchoolOperationalAnalytics, {
        token: args.token,
        date_range: args.date_range,
      });

      exportData.engagement_summary = {
        total_students: operationalData.student_engagement.total_students,
        active_students: operationalData.student_engagement.active_students,
        dropout_rate: operationalData.student_engagement.dropout_rate,
        new_registrations: operationalData.student_engagement.new_registrations,
      };
      exportData.engagement_trends = operationalData.student_engagement.engagement_trends;
      exportData.resource_utilization = operationalData.resource_utilization;
      exportData.seasonal_performance = operationalData.seasonal_trends.performance_by_season;
      exportData.tournament_preferences = operationalData.seasonal_trends.tournament_preferences;
      exportData.coaching_effectiveness = operationalData.coaching_effectiveness.student_improvement_correlation;
    }

    return exportData;
  },
});

export const getSchoolAchievementsAndBadges = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args): Promise<{
    achievements: Array<{
      id: string;
      title: string;
      description: string;
      type: "performance" | "participation" | "improvement" | "milestone";
      earned_date: number;
      criteria_met: boolean;
      progress: number;
      icon: string;
      rarity: "common" | "rare" | "epic" | "legendary";
    }>;
    available_badges: Array<{
      id: string;
      title: string;
      description: string;
      criteria: string;
      progress: number;
      max_progress: number;
      locked: boolean;
    }>;
    school_level: {
      current_level: number;
      experience_points: number;
      points_to_next_level: number;
      level_benefits: string[];
    };
    leaderboard_position: {
      regional_rank: number;
      national_rank: number;
      improvement_rank: number;
    };
  }> => {
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySessionReadOnly, {
      token: args.token,
    });

    if (!sessionResult.valid || !sessionResult.user || sessionResult.user.role !== "school_admin") {
      throw new Error("School admin access required");
    }

    const user = sessionResult.user;
    if (!user.school_id) {
      throw new Error("User not associated with a school");
    }

    const school = await ctx.db.get(user.school_id);
    if (!school) {
      throw new Error("School not found");
    }

    const schoolTeams = await ctx.db
      .query("teams")
      .withIndex("by_school_id", (q) => q.eq("school_id", user.school_id!))
      .collect();

    const teamResults = await Promise.all(
      schoolTeams.map(async (team) => {
        const result = await ctx.db
          .query("tournament_results")
          .withIndex("by_team_id", (q) => q.eq("team_id", team._id))
          .first();
        return { team, result };
      })
    );

    const schoolStudents = await ctx.db
      .query("users")
      .withIndex("by_school_id_role", (q) =>
        q.eq("school_id", user.school_id!).eq("role", "student")
      )
      .collect();

    const speakerResults = await Promise.all(
      schoolStudents.map(async (student) => {
        const results = await ctx.db
          .query("tournament_results")
          .withIndex("by_speaker_id", (q) => q.eq("speaker_id", student._id))
          .collect();
        return { student, results };
      })
    );

    const achievements = [];
    const now = Date.now();

    const topRanks = teamResults.filter(tr => tr.result && tr.result.team_rank && tr.result.team_rank <= 3);
    if (topRanks.length >= 1) {
      achievements.push({
        id: "first_podium",
        title: "First Podium Finish",
        description: "Achieved a top 3 ranking in a tournament",
        type: "performance" as const,
        earned_date: now,
        criteria_met: true,
        progress: 100,
        icon: "trophy",
        rarity: "common" as const,
      });
    }

    const topSpeakers = speakerResults.filter(sr =>
      sr.results.some(result => result.speaker_rank && result.speaker_rank <= 10)
    );
    if (topSpeakers.length >= 1) {
      achievements.push({
        id: "top_speaker",
        title: "Rising Star",
        description: "Had a student achieve top 10 speaker ranking",
        type: "performance" as const,
        earned_date: now,
        criteria_met: true,
        progress: 100,
        icon: "star",
        rarity: "rare" as const,
      });
    }

    const totalTournaments = new Set(schoolTeams.map(team => team.tournament_id)).size;
    if (totalTournaments >= 5) {
      achievements.push({
        id: "tournament_veteran",
        title: "Tournament Veteran",
        description: "Participated in 5 or more tournaments",
        type: "participation" as const,
        earned_date: now,
        criteria_met: true,
        progress: 100,
        icon: "calendar",
        rarity: "common" as const,
      });
    }

    if (totalTournaments >= 20) {
      achievements.push({
        id: "tournament_champion",
        title: "Tournament Champion",
        description: "Participated in 20 or more tournaments",
        type: "participation" as const,
        earned_date: now,
        criteria_met: true,
        progress: 100,
        icon: "crown",
        rarity: "epic" as const,
      });
    }

    if (schoolStudents.length >= 10) {
      achievements.push({
        id: "growing_program",
        title: "Growing Program",
        description: "Built a debate program with 10+ active students",
        type: "milestone" as const,
        earned_date: now,
        criteria_met: true,
        progress: 100,
        icon: "users",
        rarity: "rare" as const,
      });
    }

    const availableBadges = [
      {
        id: "consistency_king",
        title: "Consistency King",
        description: "Maintain consistent performance across tournaments",
        criteria: "Average team rank variance < 3 positions across 5+ tournaments",
        progress: Math.min(100, totalTournaments * 20),
        max_progress: 100,
        locked: totalTournaments < 5,
      },
      {
        id: "improvement_master",
        title: "Improvement Master",
        description: "Show significant improvement over time",
        criteria: "Improve average ranking by 20% over 6 months",
        progress: 0,
        max_progress: 100,
        locked: true,
      },
      {
        id: "mentor_school",
        title: "Mentor School",
        description: "Help other schools improve their programs",
        criteria: "Share resources and mentor 3+ schools",
        progress: 0,
        max_progress: 100,
        locked: true,
      },
    ];

    const totalWins = teamResults.reduce((sum, tr) => sum + (tr.result?.wins || 0), 0);
    const totalPoints = speakerResults.reduce((sum, sr) =>
      sum + sr.results.reduce((subSum, result) => subSum + (result.total_speaker_points || 0), 0), 0
    );

    const experiencePoints = (totalWins * 100) + (totalPoints * 2) + (totalTournaments * 50);
    const currentLevel = Math.floor(experiencePoints / 1000) + 1;
    const pointsToNextLevel = ((currentLevel) * 1000) - experiencePoints;

    const allSchools = await ctx.db.query("schools")
      .filter((q) => q.eq(q.field("country"), school.country))
      .collect();

    const schoolPerformances = await Promise.all(
      allSchools.map(async (sch) => {
        const teams = await ctx.db
          .query("teams")
          .withIndex("by_school_id", (q) => q.eq("school_id", sch._id))
          .collect();

        const results = await Promise.all(
          teams.map(async (team) => {
            return await ctx.db
              .query("tournament_results")
              .withIndex("by_team_id", (q) => q.eq("team_id", team._id))
              .first();
          })
        );

        const validResults = results.filter(Boolean);
        const avgRank = validResults.length > 0
          ? validResults.reduce((sum, result) => sum + (result!.team_rank || 999), 0) / validResults.length
          : 999;

        return { school: sch, avgRank, totalTeams: teams.length };
      })
    );

    const schoolAvgRank = teamResults.length > 0
      ? teamResults.reduce((sum, tr) => sum + (tr.result?.team_rank || 999), 0) / teamResults.length
      : 999;

    const betterSchools = schoolPerformances.filter(sp => sp.avgRank < schoolAvgRank && sp.totalTeams > 0);
    const regionalRank = betterSchools.length + 1;

    return {
      achievements,
      available_badges: availableBadges,
      school_level: {
        current_level: currentLevel,
        experience_points: experiencePoints,
        points_to_next_level: pointsToNextLevel,
        level_benefits: [
          "Access to advanced analytics",
          "Priority tournament registration",
          "Mentorship opportunities",
          "Exclusive training resources"
        ],
      },
      leaderboard_position: {
        regional_rank: regionalRank,
        national_rank: regionalRank,
        improvement_rank: regionalRank,
      },
    };
  },
});

export const getSchoolCompetitiveIntelligence = query({
  args: {
    token: v.string(),
    competitor_school_ids: v.optional(v.array(v.id("schools"))),
    analysis_depth: v.optional(v.union(v.literal("basic"), v.literal("detailed"), v.literal("comprehensive"))),
  },
  handler: async (ctx, args): Promise<{
    competitor_analysis: Array<{
      school_id: Id<"schools">;
      school_name: string;
      school_type: string;
      competitive_metrics: {
        avg_team_rank: number;
        win_rate: number;
        total_tournaments: number;
        top_performers: number;
        consistency_score: number;
      };
      strengths: string[];
      weaknesses: string[];
      threat_level: "low" | "medium" | "high" | "critical";
      recommendations: string[];
    }>;
    market_positioning: {
      our_rank_in_region: number;
      our_rank_by_type: number;
      market_share: number;
      growth_trajectory: "declining" | "stable" | "growing" | "accelerating";
      competitive_advantages: string[];
      areas_for_improvement: string[];
    };
    tournament_intelligence: Array<{
      tournament_name: string;
      our_performance: number;
      competitor_performances: Array<{
        school_name: string;
        rank: number;
        teams_sent: number;
      }>;
      opportunities: string[];
      threats: string[];
    }>;
    recruitment_insights: {
      top_feeder_schools: Array<{
        school_name: string;
        students_transferred: number;
        retention_rate: number;
      }>;
      talent_pipeline_strength: number;
      recruitment_effectiveness: number;
      recommended_targets: string[];
    };
  }> => {
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySessionReadOnly, {
      token: args.token,
    });

    if (!sessionResult.valid || !sessionResult.user || sessionResult.user.role !== "school_admin") {
      throw new Error("School admin access required");
    }

    const user = sessionResult.user;
    if (!user.school_id) {
      throw new Error("User not associated with a school");
    }

    const school = await ctx.db.get(user.school_id);
    if (!school) {
      throw new Error("School not found");
    }
    let competitorSchools: Doc<"schools">[];
    if (args.competitor_school_ids && args.competitor_school_ids.length > 0) {
      competitorSchools = await Promise.all(
        args.competitor_school_ids.map(id => ctx.db.get(id))
      ).then(schools => schools.filter(Boolean) as Doc<"schools">[]);
    } else {
      competitorSchools = await ctx.db.query("schools")
        .filter((q) =>
          q.and(
            q.eq(q.field("country"), school.country),
            q.eq(q.field("type"), school.type),
            q.neq(q.field("_id"), user.school_id!)
          )
        )
        .collect();

      competitorSchools = competitorSchools.slice(0, 10);
    }

    const ourTeams = await ctx.db
      .query("teams")
      .withIndex("by_school_id", (q) => q.eq("school_id", user.school_id!))
      .collect();

    const ourResults = await Promise.all(
      ourTeams.map(async (team) => {
        const result = await ctx.db
          .query("tournament_results")
          .withIndex("by_team_id", (q) => q.eq("team_id", team._id))
          .first();
        return { team, result };
      })
    );

    const competitorAnalysis = await Promise.all(
      competitorSchools.map(async (competitor) => {
        const competitorTeams = await ctx.db
          .query("teams")
          .withIndex("by_school_id", (q) => q.eq("school_id", competitor._id))
          .collect();

        const competitorResults = await Promise.all(
          competitorTeams.map(async (team) => {
            const result = await ctx.db
              .query("tournament_results")
              .withIndex("by_team_id", (q) => q.eq("team_id", team._id))
              .first();
            return { team, result };
          })
        );

        const validResults = competitorResults.filter(cr => cr.result);
        const avgTeamRank = validResults.length > 0
          ? validResults.reduce((sum, cr) => sum + (cr.result!.team_rank || 999), 0) / validResults.length
          : 999;

        const totalWins = validResults.reduce((sum, cr) => sum + (cr.result!.wins || 0), 0);
        const totalGames = validResults.reduce((sum, cr) => sum + ((cr.result!.wins || 0) + (cr.result!.losses || 0)), 0);
        const winRate = totalGames > 0 ? (totalWins / totalGames) * 100 : 0;

        const topPerformers = validResults.filter(cr => cr.result!.team_rank && cr.result!.team_rank <= 10).length;

        const ranks = validResults.map(cr => cr.result!.team_rank || 999);
        const avgRank = ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length;
        const variance = ranks.reduce((sum, rank) => sum + Math.pow(rank - avgRank, 2), 0) / ranks.length;
        const consistencyScore = Math.max(0, 100 - Math.sqrt(variance));

        const strengths: string[] = [];
        const weaknesses: string[] = [];

        if (avgTeamRank < 50) strengths.push("Consistently high team rankings");
        if (winRate > 70) strengths.push("High win rate");
        if (topPerformers > 2) strengths.push("Multiple top-performing teams");
        if (consistencyScore > 80) strengths.push("Consistent performance");
        if (competitorTeams.length > ourTeams.length) strengths.push("Large program size");

        if (avgTeamRank > 200) weaknesses.push("Lower average rankings");
        if (winRate < 40) weaknesses.push("Below-average win rate");
        if (topPerformers === 0) weaknesses.push("No top-tier teams");
        if (consistencyScore < 50) weaknesses.push("Inconsistent performance");
        if (competitorTeams.length < 3) weaknesses.push("Limited program size");

        let threatLevel: "low" | "medium" | "high" | "critical" = "low";
        if (avgTeamRank < 100 && winRate > 60) threatLevel = "high";
        else if (avgTeamRank < 200 && winRate > 50) threatLevel = "medium";
        if (topPerformers > 3) threatLevel = "critical";

        const recommendations: string[] = [];
        if (threatLevel === "high" || threatLevel === "critical") {
          recommendations.push("Monitor their recruitment and coaching strategies");
          recommendations.push("Analyze their tournament selection patterns");
        }
        if (strengths.includes("High win rate")) {
          recommendations.push("Study their debate preparation methods");
        }
        if (weaknesses.includes("Inconsistent performance")) {
          recommendations.push("Opportunity to recruit their underperforming students");
        }

        return {
          school_id: competitor._id,
          school_name: competitor.name,
          school_type: competitor.type,
          competitive_metrics: {
            avg_team_rank: Math.round(avgTeamRank),
            win_rate: Math.round(winRate * 10) / 10,
            total_tournaments: new Set(competitorTeams.map(team => team.tournament_id)).size,
            top_performers: topPerformers,
            consistency_score: Math.round(consistencyScore),
          },
          strengths,
          weaknesses,
          threat_level: threatLevel,
          recommendations,
        };
      })
    );

    const allSchoolsInRegion = await ctx.db.query("schools")
      .filter((q) => q.eq(q.field("country"), school.country))
      .collect();
    allSchoolsInRegion.filter(s => s.type === school.type);

    const ourAvgRank = ourResults.length > 0
      ? ourResults.reduce((sum, or) => sum + (or.result?.team_rank || 999), 0) / ourResults.length
      : 999;

    const betterSchoolsInRegion = competitorAnalysis.filter(ca => ca.competitive_metrics.avg_team_rank < ourAvgRank).length;
    const betterSchoolsByType = competitorAnalysis.filter(ca =>
      ca.school_type === school.type && ca.competitive_metrics.avg_team_rank < ourAvgRank
    ).length;

    const totalActiveSchools = competitorAnalysis.filter(ca => ca.competitive_metrics.total_tournaments > 0).length + 1;
    const marketShare = totalActiveSchools > 0 ? (1 / totalActiveSchools) * 100 : 0;

    const recentResults = ourResults.filter(or => {
      const sixMonthsAgo = Date.now() - (180 * 24 * 60 * 60 * 1000);
      return or.team && or.team.created_at >= sixMonthsAgo;
    });

    const olderResults = ourResults.filter(or => {
      const sixMonthsAgo = Date.now() - (180 * 24 * 60 * 60 * 1000);
      return or.team && or.team.created_at < sixMonthsAgo;
    });

    let growthTrajectory: "declining" | "stable" | "growing" | "accelerating" = "stable";
    if (recentResults.length > olderResults.length) {
      const recentAvg = recentResults.length > 0
        ? recentResults.reduce((sum, rr) => sum + (rr.result?.team_rank || 999), 0) / recentResults.length
        : 999;
      const olderAvg = olderResults.length > 0
        ? olderResults.reduce((sum, or) => sum + (or.result?.team_rank || 999), 0) / olderResults.length
        : 999;

      const improvement = ((olderAvg - recentAvg) / olderAvg) * 100;
      if (improvement > 20) growthTrajectory = "accelerating";
      else if (improvement > 5) growthTrajectory = "growing";
      else if (improvement < -10) growthTrajectory = "declining";
    }

    const competitiveAdvantages: string[] = [];
    const areasForImprovement: string[] = [];

    const ourWinRate = ourResults.length > 0
      ? (ourResults.reduce((sum, or) => sum + (or.result?.wins || 0), 0) /
      ourResults.reduce((sum, or) => sum + ((or.result?.wins || 0) + (or.result?.losses || 0)), 0)) * 100
      : 0;

    const avgCompetitorWinRate = competitorAnalysis.length > 0
      ? competitorAnalysis.reduce((sum, ca) => sum + ca.competitive_metrics.win_rate, 0) / competitorAnalysis.length
      : 0;

    if (ourWinRate > avgCompetitorWinRate) {
      competitiveAdvantages.push("Above-average win rate");
    } else {
      areasForImprovement.push("Improve win rate");
    }

    if (ourAvgRank < 100) {
      competitiveAdvantages.push("Strong tournament performance");
    } else if (ourAvgRank > 200) {
      areasForImprovement.push("Improve tournament rankings");
    }

    const ourTournamentCount = new Set(ourTeams.map(team => team.tournament_id)).size;
    const avgCompetitorTournaments = competitorAnalysis.length > 0
      ? competitorAnalysis.reduce((sum, ca) => sum + ca.competitive_metrics.total_tournaments, 0) / competitorAnalysis.length
      : 0;

    if (ourTournamentCount > avgCompetitorTournaments) {
      competitiveAdvantages.push("High tournament participation");
    } else {
      areasForImprovement.push("Increase tournament participation");
    }

    const tournamentIntelligence = [];
    const allTournaments = await ctx.db.query("tournaments")
      .filter((q) => q.eq(q.field("status"), "completed"))
      .collect();

    const recentTournaments = allTournaments
      .filter(t => t.start_date >= Date.now() - (365 * 24 * 60 * 60 * 1000))
      .slice(0, 10);

    for (const tournament of recentTournaments) {
      const ourTeamInTournament = ourTeams.find(team => team.tournament_id === tournament._id);
      if (!ourTeamInTournament) continue;

      const ourResult = await ctx.db
        .query("tournament_results")
        .withIndex("by_team_id", (q) => q.eq("team_id", ourTeamInTournament._id))
        .first();

      const allTeamsInTournament = await ctx.db
        .query("teams")
        .withIndex("by_tournament_id", (q) => q.eq("tournament_id", tournament._id))
        .collect();

      const competitorPerformances = [];
      for (const team of allTeamsInTournament) {
        if (!team.school_id || team.school_id === user.school_id) continue;

        const teamSchool = await ctx.db.get(team.school_id);
        if (!teamSchool || !competitorSchools.some(cs => cs._id === teamSchool._id)) continue;

        const teamResult = await ctx.db
          .query("tournament_results")
          .withIndex("by_team_id", (q) => q.eq("team_id", team._id))
          .first();

        if (teamResult) {
          competitorPerformances.push({
            school_name: teamSchool.name,
            rank: teamResult.team_rank || 999,
            teams_sent: 1,
          });
        }
      }

      const opportunities: string[] = [];
      const threats: string[] = [];

      const ourRank = ourResult?.team_rank || 999;
      const betterCompetitors = competitorPerformances.filter(cp => cp.rank < ourRank);
      const worseCompetitors = competitorPerformances.filter(cp => cp.rank > ourRank);

      if (worseCompetitors.length > betterCompetitors.length) {
        opportunities.push("Strong performance relative to competitors");
      }
      if (betterCompetitors.length > 2) {
        threats.push("Multiple competitors performing better");
      }
      if (competitorPerformances.some(cp => cp.rank <= 5)) {
        threats.push("Competitors achieving top-tier results");
      }

      tournamentIntelligence.push({
        tournament_name: tournament.name,
        our_performance: ourRank,
        competitor_performances: competitorPerformances.sort((a, b) => a.rank - b.rank),
        opportunities,
        threats,
      });
    }

    const ourStudents = await ctx.db
      .query("users")
      .withIndex("by_school_id_role", (q) =>
        q.eq("school_id", user.school_id!).eq("role", "student")
      )
      .collect();

    const studentTransfers = [];
    const oneYearAgo = Date.now() - (365 * 24 * 60 * 60 * 1000);

    for (const student of ourStudents) {
      if (student.created_at >= oneYearAgo) {
        studentTransfers.push({
          student_id: student._id,
          transfer_date: student.created_at,
        });
      }
    }

    const retainedStudents = ourStudents.filter(student => {
      return ourTeams.some(team =>
        team.members.includes(student._id) && team.created_at >= oneYearAgo
      );
    });

    const retentionRate = ourStudents.length > 0
      ? (retainedStudents.length / ourStudents.length) * 100
      : 0;

    const topFeederSchools = [
      {
        school_name: "Various High Schools",
        students_transferred: studentTransfers.length,
        retention_rate: retentionRate,
      }
    ];

    const talentPipelineStrength = Math.min(100, (ourStudents.length * 10) + (retentionRate * 0.5));
    const recruitmentEffectiveness = Math.min(100, (studentTransfers.length * 20) + retentionRate);

    const recommendedTargets = [
      "High schools with strong academic programs",
      "Schools in nearby regions with debate interest",
      "International schools seeking debate opportunities"
    ];

    if (areasForImprovement.includes("Improve tournament rankings")) {
      recommendedTargets.push("Experienced debaters from competitive schools");
    }

    return {
      competitor_analysis: competitorAnalysis.sort((a, b) =>
        (b.threat_level === "critical" ? 4 : b.threat_level === "high" ? 3 : b.threat_level === "medium" ? 2 : 1) -
        (a.threat_level === "critical" ? 4 : a.threat_level === "high" ? 3 : a.threat_level === "medium" ? 2 : 1)
      ),
      market_positioning: {
        our_rank_in_region: betterSchoolsInRegion + 1,
        our_rank_by_type: betterSchoolsByType + 1,
        market_share: Math.round(marketShare * 10) / 10,
        growth_trajectory: growthTrajectory,
        competitive_advantages: competitiveAdvantages,
        areas_for_improvement: areasForImprovement,
      },
      tournament_intelligence: tournamentIntelligence,
      recruitment_insights: {
        top_feeder_schools: topFeederSchools,
        talent_pipeline_strength: Math.round(talentPipelineStrength),
        recruitment_effectiveness: Math.round(recruitmentEffectiveness),
        recommended_targets: recommendedTargets,
      },
    };
  },
});

export const generateSchoolAnalyticsReport = mutation({
  args: {
    token: v.string(),
    report_config: v.object({
      title: v.string(),
      sections: v.array(v.string()),
      date_range: v.optional(v.object({
        start: v.number(),
        end: v.number(),
      })),
      include_predictions: v.optional(v.boolean()),
      include_recommendations: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, args): Promise<{
    report_id: string;
    report_url: string;
    generated_at: number;
    expires_at: number;
  }> => {
    const sessionResult = await ctx.runMutation(internal.functions.auth.verifySession, {
      token: args.token,
    });

    if (!sessionResult.valid || !sessionResult.user || sessionResult.user.role !== "school_admin") {
      throw new Error("School admin access required");
    }

    const reportId = `school_report_${sessionResult.user.id}_${Date.now()}`;
    const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000);

    const reportData: any = {};

    if (args.report_config.sections.includes("performance")) {
      reportData.performance = await ctx.runQuery(api.functions.school.analytics.getSchoolPerformanceAnalytics, {
        token: args.token,
        date_range: args.report_config.date_range,
      });
    }

    if (args.report_config.sections.includes("operational")) {
      reportData.operational = await ctx.runQuery(api.functions.school.analytics.getSchoolOperationalAnalytics, {
        token: args.token,
        date_range: args.report_config.date_range,
      });
    }

    if (args.report_config.sections.includes("achievements")) {
      reportData.achievements = await ctx.runQuery(api.functions.school.analytics.getSchoolAchievementsAndBadges, {
        token: args.token,
      });
    }

    if (args.report_config.sections.includes("competitive_intelligence")) {
      reportData.competitive = await ctx.runQuery(api.functions.school.analytics.getSchoolCompetitiveIntelligence, {
        token: args.token,
        analysis_depth: "comprehensive",
      });
    }

    await ctx.db.insert("report_shares", {
      report_type: "tournament",
      report_id: JSON.stringify({
        config: args.report_config,
        data: reportData,
        school_id: sessionResult.user.school_id,
      }),
      access_token: reportId,
      created_by: sessionResult.user.id,
      expires_at: expiresAt,
      view_count: 0,
      created_at: Date.now(),
    });

    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: sessionResult.user.id,
      action: "system_setting_changed",
      resource_type: "report_shares",
      resource_id: reportId,
      description: `Generated school analytics report: ${args.report_config.title}`,
    });

    return {
      report_id: reportId,
      report_url: `${process.env.FRONTEND_SITE_URL}/reports/school/${reportId}`,
      generated_at: Date.now(),
      expires_at: expiresAt,
    };
  },
});