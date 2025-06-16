import { mutation, query } from "../../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../../_generated/api";
import { Doc, Id } from "../../_generated/dataModel";

export const getStudentPerformanceAnalytics = query({
  args: {
    token: v.string(),
    date_range: v.optional(v.object({
      start: v.number(),
      end: v.number(),
    })),
    compare_to_previous_period: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{
    personal_performance: {
      current_rank: number;
      best_rank: number;
      worst_rank: number;
      avg_speaker_score: number;
      total_tournaments: number;
      total_wins: number;
      total_losses: number;
      win_rate: number;
      consistency_score: number;
      points_earned: number;
    };
    performance_trends: Array<{
      tournament_name: string;
      date: number;
      speaker_rank: number;
      speaker_points: number;
      team_rank: number;
      avg_score: number;
      improvement_from_previous: number;
    }>;
    partner_analysis: Array<{
      partner_id: Id<"users">;
      partner_name: string;
      tournaments_together: number;
      win_rate_together: number;
      avg_speaker_score_together: number;
      chemistry_score: number;
      best_performance: {
        tournament_name: string;
        team_rank: number;
        combined_speaker_points: number;
      };
    }>;
    judge_feedback_analysis: {
      strengths: Array<{ area: string; frequency: number; improvement_rate: number }>;
      weaknesses: Array<{ area: string; frequency: number; priority: "high" | "medium" | "low" }>;
      feedback_trends: Array<{
        period: string;
        avg_score: number;
        feedback_count: number;
        improvement_notes: string[];
      }>;
      judge_preferences: Array<{
        judge_name: string;
        times_judged: number;
        avg_score_from_judge: number;
        feedback_sentiment: "positive" | "neutral" | "negative";
      }>;
    };
    tournament_analysis: {
      best_formats: Array<{ format: string; avg_rank: number; participation_count: number }>;
      motion_performance: Array<{
        motion_category: string;
        avg_score: number;
        win_rate: number;
        confidence_level: number;
      }>;
      regional_performance: Array<{
        region: string;
        tournaments: number;
        avg_rank: number;
        best_rank: number;
      }>;
      difficulty_analysis: {
        beginner_tournaments: { count: number; avg_rank: number; win_rate: number };
        intermediate_tournaments: { count: number; avg_rank: number; win_rate: number };
        advanced_tournaments: { count: number; avg_rank: number; win_rate: number };
      };
    };
    peer_comparison: {
      school_ranking: number;
      regional_ranking: number;
      national_ranking: number;
      percentile: number;
      similar_experience_comparison: Array<{
        metric: string;
        your_value: number;
        peer_average: number;
        percentile: number;
      }>;
    };
    growth_trajectory: {
      skill_development: Array<{
        skill: string;
        current_level: number;
        growth_rate: number;
        projected_improvement: number;
      }>;
      predicted_next_rank: {
        range: { min: number; max: number };
        confidence: number;
        factors_influencing: string[];
      };
      improvement_roadmap: Array<{
        area: string;
        current_score: number;
        target_score: number;
        timeline: string;
        actionable_steps: string[];
      }>;
    };
    insights: Array<{
      type: "achievement" | "improvement" | "concern" | "opportunity";
      title: string;
      description: string;
      confidence: number;
      actionable_suggestions: string[];
      priority: "high" | "medium" | "low";
    }>;
  }> => {
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySessionReadOnly, {
      token: args.token,
    });

    if (!sessionResult.valid || !sessionResult.user || sessionResult.user.role !== "student") {
      throw new Error("Student access required");
    }

    const user = sessionResult.user;
    const now = Date.now();
    const dateRange = args.date_range || {
      start: now - (365 * 24 * 60 * 60 * 1000),
      end: now,
    };
    const studentResults = await ctx.db
      .query("tournament_results")
      .withIndex("by_speaker_id", (q) => q.eq("speaker_id", user.id))
      .collect();

    const relevantResults = studentResults.filter(async result => {
      const tournament = await ctx.db.get(result.tournament_id);
      return tournament &&
        result._creationTime >= dateRange.start &&
        result._creationTime <= dateRange.end;
    });

    const tournaments = await Promise.all(
      relevantResults.map(async (result) => {
        return await ctx.db.get(result.tournament_id);
      })
    );

    const validTournaments = tournaments.filter(Boolean) as Doc<"tournaments">[];

    const teams = await ctx.db.query("teams").collect();
    const studentTeams = teams.filter(team => team.members.includes(user.id));

    const teamResults = await Promise.all(
      studentTeams.map(async (team) => {
        const result = await ctx.db
          .query("tournament_results")
          .withIndex("by_team_id", (q) => q.eq("team_id", team._id))
          .first();
        return { team, result };
      })
    );

    const validTeamResults = teamResults.filter(tr => tr.result);

    let currentRank = 999;
    let bestRank = 999;
    let worstRank = 1;
    let totalSpeakerPoints = 0;
    let totalWins = 0;
    let totalLosses = 0;
    let totalScore = 0;
    let scoreCount = 0;

    if (relevantResults.length > 0) {
      const ranks = relevantResults
        .filter(r => r.speaker_rank)
        .map(r => r.speaker_rank!)
        .sort((a, b) => a - b);

      if (ranks.length > 0) {
        currentRank = relevantResults
          .filter(r => r.speaker_rank)
          .sort((a, b) => (b._creationTime || 0) - (a._creationTime || 0))[0]?.speaker_rank ?? 999;
        bestRank = Math.min(...ranks);
        worstRank = Math.max(...ranks);
      }

      totalSpeakerPoints = relevantResults.reduce((sum, r) => sum + (r.total_speaker_points || 0), 0);
      totalWins = validTeamResults.reduce((sum, tr) => sum + (tr.result!.wins || 0), 0);
      totalLosses = validTeamResults.reduce((sum, tr) => sum + (tr.result!.losses || 0), 0);

      const scoresWithValues = relevantResults.filter(r => r.average_speaker_score);
      totalScore = scoresWithValues.reduce((sum, r) => sum + r.average_speaker_score!, 0);
      scoreCount = scoresWithValues.length;
    }

    const avgSpeakerScore = scoreCount > 0 ? totalScore / scoreCount : 0;
    const winRate = (totalWins + totalLosses) > 0 ? (totalWins / (totalWins + totalLosses)) * 100 : 0;

    const ranks = relevantResults.map(r => r.speaker_rank || 999);
    const avgRank = ranks.length > 0 ? ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length : 999;
    const variance = ranks.length > 0 ? ranks.reduce((sum, rank) => sum + Math.pow(rank - avgRank, 2), 0) / ranks.length : 0;
    const consistencyScore = Math.max(0, 100 - Math.sqrt(variance));

    const personalPerformance = {
      current_rank: currentRank,
      best_rank: bestRank,
      worst_rank: worstRank === 1 ? (ranks.length > 0 ? worstRank : 999) : worstRank,
      avg_speaker_score: Math.round(avgSpeakerScore * 10) / 10,
      total_tournaments: relevantResults.length,
      total_wins: totalWins,
      total_losses: totalLosses,
      win_rate: Math.round(winRate * 10) / 10,
      consistency_score: Math.round(consistencyScore * 10) / 10,
      points_earned: totalSpeakerPoints,
    };

    const performanceTrends = await Promise.all(
      relevantResults.map(async (result, index) => {
        const tournament = validTournaments.find(t => t._id === result.tournament_id);
        const teamResult = validTeamResults.find(tr =>
          tr.team.members.includes(user.id) && tr.team.tournament_id === result.tournament_id
        );

        const previousResult = index > 0 ? relevantResults[index - 1] : null;
        const improvementFromPrevious = previousResult && result.speaker_rank && previousResult.speaker_rank
          ? previousResult.speaker_rank - result.speaker_rank
          : 0;

        return {
          tournament_name: tournament?.name || "Unknown",
          date: tournament?.start_date || Date.now(),
          speaker_rank: result.speaker_rank || 999,
          speaker_points: result.total_speaker_points || 0,
          team_rank: teamResult?.result?.team_rank || 999,
          avg_score: result.average_speaker_score || 0,
          improvement_from_previous: improvementFromPrevious,
        };
      })
    );

    performanceTrends.sort((a, b) => a.date - b.date);

    const partnerStats = new Map<Id<"users">, {
      name: string;
      tournaments: number;
      wins: number;
      losses: number;
      combinedSpeakerPoints: number[];
      bestPerformance: { tournament: string; teamRank: number; points: number };
    }>();

    for (const team of studentTeams) {
      const partner = team.members.find(memberId => memberId !== user.id);
      if (!partner) continue;

      const partnerUser = await ctx.db.get(partner);
      if (!partnerUser) continue;

      const teamResult = validTeamResults.find(tr => tr.team._id === team._id);
      if (!teamResult?.result) continue;

      const tournament = validTournaments.find(t => t._id === team.tournament_id);
      const partnerSpeakerResult = await ctx.db
        .query("tournament_results")
        .withIndex("by_tournament_id_speaker_id", (q) =>
          q.eq("tournament_id", team.tournament_id).eq("speaker_id", partner)
        )
        .first();

      const currentStats = partnerStats.get(partner) || {
        name: partnerUser.name,
        tournaments: 0,
        wins: 0,
        losses: 0,
        combinedSpeakerPoints: [],
        bestPerformance: { tournament: "", teamRank: 999, points: 0 },
      };

      currentStats.tournaments++;
      currentStats.wins += teamResult.result.wins || 0;
      currentStats.losses += teamResult.result.losses || 0;

      const studentPoints = relevantResults.find(r => r.tournament_id === team.tournament_id)?.total_speaker_points || 0;
      const partnerPoints = partnerSpeakerResult?.total_speaker_points || 0;
      const combinedPoints = studentPoints + partnerPoints;
      currentStats.combinedSpeakerPoints.push(combinedPoints);

      if (teamResult.result.team_rank && teamResult.result.team_rank < currentStats.bestPerformance.teamRank) {
        currentStats.bestPerformance = {
          tournament: tournament?.name || "Unknown",
          teamRank: teamResult.result.team_rank,
          points: combinedPoints,
        };
      }

      partnerStats.set(partner, currentStats);
    }

    const partnerAnalysis = Array.from(partnerStats.entries()).map(([partnerId, stats]) => {
      const winRate = (stats.wins + stats.losses) > 0 ? (stats.wins / (stats.wins + stats.losses)) * 100 : 0;
      const avgCombinedPoints = stats.combinedSpeakerPoints.length > 0
        ? stats.combinedSpeakerPoints.reduce((sum, points) => sum + points, 0) / stats.combinedSpeakerPoints.length
        : 0;

      const chemistryScore = Math.min(100, (winRate * 0.4) + (avgCombinedPoints * 0.003) + (stats.tournaments * 5));

      return {
        partner_id: partnerId,
        partner_name: stats.name,
        tournaments_together: stats.tournaments,
        win_rate_together: Math.round(winRate * 10) / 10,
        avg_speaker_score_together: Math.round(avgCombinedPoints * 10) / 10,
        chemistry_score: Math.round(chemistryScore * 10) / 10,
        best_performance: {
          tournament_name: stats.bestPerformance.tournament,
          team_rank: stats.bestPerformance.teamRank,
          combined_speaker_points: stats.bestPerformance.points,
        },
      };
    }).sort((a, b) => b.chemistry_score - a.chemistry_score);

    const judgingScores = await ctx.db.query("judging_scores").collect();
    const studentDebates = await Promise.all(
      studentTeams.map(async (team) => {
        const debates = await ctx.db
          .query("debates")
          .withIndex("by_tournament_id", (q) => q.eq("tournament_id", team.tournament_id))
          .collect();
        return debates.filter(d =>
          d.proposition_team_id === team._id || d.opposition_team_id === team._id
        );
      })
    );

    const allStudentDebates = studentDebates.flat();
    const studentJudgingScores = judgingScores.filter(score =>
      allStudentDebates.some(debate => debate._id === score.debate_id)
    );

    const strengthsMap = new Map<string, { frequency: number; scores: number[] }>();
    const weaknessesMap = new Map<string, { frequency: number; priority: number }>();
    const judgeStatsMap = new Map<Id<"users">, { name: string; scores: number[]; feedback: string[] }>();

    studentJudgingScores.forEach(score => {
      const studentScore = score.speaker_scores?.find(s => s.speaker_id === user.id);
      if (!studentScore) return;

      const judgeStats = judgeStatsMap.get(score.judge_id) || {
        name: "Unknown Judge",
        scores: [],
        feedback: [],
      };

      judgeStats.scores.push(studentScore.score);
      if (studentScore.comments) {
        judgeStats.feedback.push(studentScore.comments);
      }
      judgeStatsMap.set(score.judge_id, judgeStats);

      if (studentScore.comments) {
        const words = studentScore.comments.toLowerCase().split(/\s+/);

        const positiveWords = ['excellent', 'strong', 'good', 'clear', 'confident', 'logical', 'persuasive', 'articulate'];
        const negativeWords = ['weak', 'unclear', 'nervous', 'confused', 'poor', 'needs improvement', 'lacking'];

        positiveWords.forEach(word => {
          if (words.includes(word)) {
            const current = strengthsMap.get(word) || { frequency: 0, scores: [] };
            current.frequency++;
            current.scores.push(studentScore.score);
            strengthsMap.set(word, current);
          }
        });

        negativeWords.forEach(word => {
          if (words.includes(word)) {
            const current = weaknessesMap.get(word) || { frequency: 0, priority: 0 };
            current.frequency++;
            current.priority += studentScore.score < 20 ? 3 : studentScore.score < 25 ? 2 : 1;
            weaknessesMap.set(word, current);
          }
        });
      }
    });

    const strengths = Array.from(strengthsMap.entries())
      .map(([area, data]) => ({
        area,
        frequency: data.frequency,
        improvement_rate: data.scores.length > 1
          ? ((data.scores[data.scores.length - 1] - data.scores[0]) / data.scores[0]) * 100
          : 0,
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5);

    const weaknesses = Array.from(weaknessesMap.entries())
      .map(([area, data]) => ({
        area,
        frequency: data.frequency,
        priority: data.priority > 15 ? "high" as const : data.priority > 8 ? "medium" as const : "low" as const,
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5);

    const judgePreferences = await Promise.all(
      Array.from(judgeStatsMap.entries()).map(async ([judgeId, stats]) => {
        const judge = await ctx.db.get(judgeId);
        const avgScore = stats.scores.reduce((sum, score) => sum + score, 0) / stats.scores.length;
        const sentiment = avgScore > 25 ? "positive" : avgScore > 20 ? "neutral" : "negative";

        return {
          judge_name: judge?.name || "Unknown Judge",
          times_judged: stats.scores.length,
          avg_score_from_judge: Math.round(avgScore * 10) / 10,
          feedback_sentiment: sentiment as "positive" | "neutral" | "negative",
        };
      })
    );

    const feedbackTrends = [];
    const months = Math.ceil((dateRange.end - dateRange.start) / (30 * 24 * 60 * 60 * 1000));

    for (let i = 0; i < months; i++) {
      const periodStart = dateRange.start + (i * 30 * 24 * 60 * 60 * 1000);
      const periodEnd = Math.min(periodStart + (30 * 24 * 60 * 60 * 1000), dateRange.end);

      const periodScores = studentJudgingScores.filter(score =>
        score.submitted_at >= periodStart && score.submitted_at < periodEnd
      );

      if (periodScores.length === 0) continue;

      const avgScore = periodScores.reduce((sum, score) => {
        const studentScore = score.speaker_scores?.find(s => s.speaker_id === user.id);
        return sum + (studentScore?.score || 0);
      }, 0) / periodScores.length;

      const improvementNotes = periodScores
        .map(score => score.speaker_scores?.find(s => s.speaker_id === user.id)?.comments)
        .filter(Boolean)
        .slice(0, 3) as string[];

      feedbackTrends.push({
        period: new Date(periodStart).toISOString().slice(0, 7),
        avg_score: Math.round(avgScore * 10) / 10,
        feedback_count: periodScores.length,
        improvement_notes: improvementNotes,
      });
    }

    const judgeAnalysis = {
      strengths,
      weaknesses,
      feedback_trends: feedbackTrends,
      judge_preferences: judgePreferences.sort((a, b) => b.avg_score_from_judge - a.avg_score_from_judge),
    };

    const formatPerformance = new Map<string, { ranks: number[]; tournaments: number }>();
    const motionPerformance = new Map<string, { scores: number[]; wins: number; total: number }>();
    const regionPerformance = new Map<string, { tournaments: number; ranks: number[] }>();

    let beginnerCount = 0, intermediateCount = 0, advancedCount = 0;
    let beginnerRanks: number[] = [], intermediateRanks: number[] = [], advancedRanks: number[] = [];
    let beginnerWins = 0, intermediateWins = 0, advancedWins = 0;
    let beginnerTotal = 0, intermediateTotal = 0, advancedTotal = 0;

    for (const result of relevantResults) {
      const tournament = validTournaments.find(t => t._id === result.tournament_id);
      if (!tournament) continue;

      const format = tournament.format;
      const formatStats = formatPerformance.get(format) || { ranks: [], tournaments: 0 };
      if (result.speaker_rank) {
        formatStats.ranks.push(result.speaker_rank);
      }
      formatStats.tournaments++;
      formatPerformance.set(format, formatStats);

      const teamResult = validTeamResults.find(tr => tr.team.tournament_id === result.tournament_id);
      const wins = teamResult?.result?.wins || 0;
      const losses = teamResult?.result?.losses || 0;

      const location = tournament.location || "Unknown";
      const region = location.includes("Rwanda") ? "Rwanda" :
        location.includes("Uganda") ? "Uganda" :
          location.includes("Kenya") ? "Kenya" : "Other";

      const regionStats = regionPerformance.get(region) || { tournaments: 0, ranks: [] };
      regionStats.tournaments++;
      if (result.speaker_rank) {
        regionStats.ranks.push(result.speaker_rank);
      }
      regionPerformance.set(region, regionStats);

      const difficulty = tournament.name.toLowerCase().includes("beginner") || tournament.name.toLowerCase().includes("novice") ? "beginner" :
        tournament.name.toLowerCase().includes("advanced") || tournament.name.toLowerCase().includes("open") ? "advanced" : "intermediate";

      if (difficulty === "beginner") {
        beginnerCount++;
        if (result.speaker_rank) beginnerRanks.push(result.speaker_rank);
        beginnerWins += wins;
        beginnerTotal += wins + losses;
      } else if (difficulty === "advanced") {
        advancedCount++;
        if (result.speaker_rank) advancedRanks.push(result.speaker_rank);
        advancedWins += wins;
        advancedTotal += wins + losses;
      } else {
        intermediateCount++;
        if (result.speaker_rank) intermediateRanks.push(result.speaker_rank);
        intermediateWins += wins;
        intermediateTotal += wins + losses;
      }

      const motionCategory = tournament.format === "BritishParliamentary" ? "BP" :
          tournament.format === "WorldSchools" ? "WS" : "Other";

      const motionStats = motionPerformance.get(motionCategory) || { scores: [], wins: 0, total: 0 };
      if (result.average_speaker_score) {
        motionStats.scores.push(result.average_speaker_score);
      }
      motionStats.wins += wins;
      motionStats.total += wins + losses;
      motionPerformance.set(motionCategory, motionStats);
    }

    const bestFormats = Array.from(formatPerformance.entries())
      .map(([format, stats]) => ({
        format,
        avg_rank: stats.ranks.length > 0 ? stats.ranks.reduce((sum, rank) => sum + rank, 0) / stats.ranks.length : 999,
        participation_count: stats.tournaments,
      }))
      .sort((a, b) => a.avg_rank - b.avg_rank);

    const motionAnalysis = Array.from(motionPerformance.entries())
      .map(([category, stats]) => ({
        motion_category: category,
        avg_score: stats.scores.length > 0 ? stats.scores.reduce((sum, score) => sum + score, 0) / stats.scores.length : 0,
        win_rate: stats.total > 0 ? (stats.wins / stats.total) * 100 : 0,
        confidence_level: Math.min(100, stats.scores.length * 10 + (stats.total * 5)),
      }));

    const regionalAnalysis = Array.from(regionPerformance.entries())
      .map(([region, stats]) => ({
        region,
        tournaments: stats.tournaments,
        avg_rank: stats.ranks.length > 0 ? stats.ranks.reduce((sum, rank) => sum + rank, 0) / stats.ranks.length : 999,
        best_rank: stats.ranks.length > 0 ? Math.min(...stats.ranks) : 999,
      }));

    const difficultyAnalysis = {
      beginner_tournaments: {
        count: beginnerCount,
        avg_rank: beginnerRanks.length > 0 ? beginnerRanks.reduce((sum, rank) => sum + rank, 0) / beginnerRanks.length : 999,
        win_rate: beginnerTotal > 0 ? (beginnerWins / beginnerTotal) * 100 : 0,
      },
      intermediate_tournaments: {
        count: intermediateCount,
        avg_rank: intermediateRanks.length > 0 ? intermediateRanks.reduce((sum, rank) => sum + rank, 0) / intermediateRanks.length : 999,
        win_rate: intermediateTotal > 0 ? (intermediateWins / intermediateTotal) * 100 : 0,
      },
      advanced_tournaments: {
        count: advancedCount,
        avg_rank: advancedRanks.length > 0 ? advancedRanks.reduce((sum, rank) => sum + rank, 0) / advancedRanks.length : 999,
        win_rate: advancedTotal > 0 ? (advancedWins / advancedTotal) * 100 : 0,
      },
    };

    const tournamentAnalysis = {
      best_formats: bestFormats,
      motion_performance: motionAnalysis,
      regional_performance: regionalAnalysis,
      difficulty_analysis: difficultyAnalysis,
    };

    const allStudents = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "student"))
      .collect();

    const schoolStudents = user.school_id ? await ctx.db
      .query("users")
      .withIndex("by_school_id_role", (q) =>
        q.eq("school_id", user.school_id).eq("role", "student")
      )
      .collect() : [];

    const allStudentResults = await Promise.all(
      allStudents.map(async (student) => {
        const results = await ctx.db
          .query("tournament_results")
          .withIndex("by_speaker_id", (q) => q.eq("speaker_id", student._id))
          .collect();
        return { student, results };
      })
    );

    const validStudentResults = allStudentResults.filter(sr => sr.results.length > 0);

    const schoolRanking = schoolStudents.length > 0 ?
      schoolStudents.filter(student => {
        const studentResults = validStudentResults.find(sr => sr.student._id === student._id);
        if (!studentResults) return false;
        const avgRank = studentResults.results.reduce((sum, r) => sum + (r.speaker_rank || 999), 0) / studentResults.results.length;
        return avgRank < personalPerformance.current_rank;
      }).length + 1 : 1;

    const betterStudents = validStudentResults.filter(sr => {
      const avgRank = sr.results.reduce((sum, r) => sum + (r.speaker_rank || 999), 0) / sr.results.length;
      return avgRank < personalPerformance.current_rank;
    }).length;

    const regionalRanking = betterStudents + 1;
    const nationalRanking = betterStudents + 1;
    const percentile = validStudentResults.length > 0 ?
      ((validStudentResults.length - betterStudents) / validStudentResults.length) * 100 : 50;

    const similarExperienceStudents = validStudentResults.filter(sr =>
      Math.abs(sr.results.length - personalPerformance.total_tournaments) <= 2
    );

    const similarComparison = [
      {
        metric: "Average Speaker Score",
        your_value: personalPerformance.avg_speaker_score,
        peer_average: similarExperienceStudents.length > 0 ?
          similarExperienceStudents.reduce((sum, sr) => {
            const avgScore = sr.results.reduce((s, r) => s + (r.average_speaker_score || 0), 0) / sr.results.length;
            return sum + avgScore;
          }, 0) / similarExperienceStudents.length : 0,
        percentile: 0,
      },
      {
        metric: "Tournament Win Rate",
        your_value: personalPerformance.win_rate,
        peer_average: 0,
        percentile: 0,
      },
    ];

    similarComparison.forEach(comp => {
      const betterPeers = similarExperienceStudents.filter(sr => {
        if (comp.metric === "Average Speaker Score") {
          const avgScore = sr.results.reduce((s, r) => s + (r.average_speaker_score || 0), 0) / sr.results.length;
          return avgScore > comp.your_value;
        }
        return false;
      }).length;
      comp.percentile = similarExperienceStudents.length > 0 ?
        ((similarExperienceStudents.length - betterPeers) / similarExperienceStudents.length) * 100 : 50;
    });

    const peerComparison = {
      school_ranking: schoolRanking,
      regional_ranking: regionalRanking,
      national_ranking: nationalRanking,
      percentile: Math.round(percentile),
      similar_experience_comparison: similarComparison,
    };

    const skillDevelopment = [
      {
        skill: "Argumentation",
        current_level: Math.min(100, personalPerformance.avg_speaker_score * 3.5),
        growth_rate: strengths.find(s => s.area.includes('logical'))?.improvement_rate || 0,
        projected_improvement: 0,
      },
      {
        skill: "Delivery",
        current_level: Math.min(100, personalPerformance.consistency_score),
        growth_rate: strengths.find(s => s.area.includes('confident'))?.improvement_rate || 0,
        projected_improvement: 0,
      },
      {
        skill: "Teamwork",
        current_level: Math.min(100, partnerAnalysis.length > 0 ?
          partnerAnalysis.reduce((sum, p) => sum + p.chemistry_score, 0) / partnerAnalysis.length : 50),
        growth_rate: 0,
        projected_improvement: 0,
      },
    ];

    skillDevelopment.forEach(skill => {
      skill.projected_improvement = Math.min(100, skill.current_level + (skill.growth_rate * 0.3));
    });

    const predictedRankRange = {
      min: Math.max(1, personalPerformance.best_rank - 5),
      max: Math.min(500, personalPerformance.current_rank + 10),
    };

    const confidence = Math.min(95, 40 + (personalPerformance.total_tournaments * 3) + personalPerformance.consistency_score * 0.3);

    const factorsInfluencing = [];
    if (personalPerformance.consistency_score > 70) factorsInfluencing.push("High consistency");
    if (personalPerformance.win_rate > 60) factorsInfluencing.push("Strong win rate");
    if (weaknesses.length > 0) factorsInfluencing.push("Areas for improvement identified");
    if (partnerAnalysis.length > 0) factorsInfluencing.push("Partnership experience");

    const improvementRoadmap = [
      {
        area: "Speaker Score Improvement",
        current_score: personalPerformance.avg_speaker_score,
        target_score: Math.min(30, personalPerformance.avg_speaker_score + 3),
        timeline: "3-6 months",
        actionable_steps: [
          "Focus on argument structure and clarity",
          "Practice delivery and timing",
          "Study successful speakers in your format",
        ],
      },
      {
        area: "Ranking Consistency",
        current_score: personalPerformance.consistency_score,
        target_score: Math.min(100, personalPerformance.consistency_score + 15),
        timeline: "6-12 months",
        actionable_steps: [
          "Develop pre-tournament preparation routine",
          "Work on adapting to different motion types",
          "Build mental resilience for pressure situations",
        ],
      },
    ];

    if (weaknesses.length > 0) {
      improvementRoadmap.push({
        area: `Address ${weaknesses[0].area}`,
        current_score: 0,
        target_score: 80,
        timeline: "2-4 months",
        actionable_steps: [
          `Focus specifically on ${weaknesses[0].area}`,
          "Seek targeted feedback from experienced debaters",
          "Practice exercises addressing this weakness",
        ],
      });
    }

    const growthTrajectory = {
      skill_development: skillDevelopment,
      predicted_next_rank: {
        range: predictedRankRange,
        confidence: Math.round(confidence),
        factors_influencing: factorsInfluencing,
      },
      improvement_roadmap: improvementRoadmap,
    };

    const insights = [];

    if (personalPerformance.best_rank <= 10) {
      insights.push({
        type: "achievement" as const,
        title: "Top 10 Performance Achieved",
        description: `You achieved rank #${personalPerformance.best_rank}, placing you among the top speakers`,
        confidence: 95,
        actionable_suggestions: [
          "Aim for consistency at this level",
          "Consider mentoring newer debaters",
          "Set sights on breaking at major tournaments",
        ],
        priority: "high" as const,
      });
    }

    if (performanceTrends.length >= 3) {
      const recentTrends = performanceTrends.slice(-3);
      const isImproving = recentTrends.every((trend, i) =>
        i === 0 || trend.speaker_rank <= recentTrends[i-1].speaker_rank
      );

      if (isImproving) {
        insights.push({
          type: "improvement" as const,
          title: "Consistent Improvement Trend",
          description: "Your rankings have been steadily improving over recent tournaments",
          confidence: 85,
          actionable_suggestions: [
            "Continue current preparation methods",
            "Document what's working well",
            "Gradually increase tournament difficulty",
          ],
          priority: "medium" as const,
        });
      }
    }

    if (personalPerformance.consistency_score < 50) {
      insights.push({
        type: "concern" as const,
        title: "Inconsistent Performance",
        description: "Your rankings vary significantly between tournaments",
        confidence: 80,
        actionable_suggestions: [
          "Develop a consistent preparation routine",
          "Focus on adaptability across different motion types",
          "Work with a coach on mental preparation",
        ],
        priority: "high" as const,
      });
    }

    if (partnerAnalysis.length > 0) {
      const bestPartner = partnerAnalysis[0];
      if (bestPartner.chemistry_score > 80) {
        insights.push({
          type: "opportunity" as const,
          title: "Strong Partnership Identified",
          description: `You have excellent chemistry with ${bestPartner.partner_name}`,
          confidence: 90,
          actionable_suggestions: [
            "Consider forming a regular partnership",
            "Develop specialized strategies together",
            "Enter major tournaments as a team",
          ],
          priority: "medium" as const,
        });
      }
    }

    if (bestFormats.length > 0 && bestFormats[0].avg_rank < personalPerformance.current_rank * 0.8) {
      insights.push({
        type: "opportunity" as const,
        title: `Strong ${bestFormats[0].format} Performance`,
        description: `You perform significantly better in ${bestFormats[0].format} format`,
        confidence: 75,
        actionable_suggestions: [
          `Focus on ${bestFormats[0].format} tournaments`,
          `Study the specific skills needed for ${bestFormats[0].format}`,
          "Apply successful strategies to other formats",
        ],
        priority: "medium" as const,
      });
    }

    if (personalPerformance.total_tournaments < 5) {
      insights.push({
        type: "opportunity" as const,
        title: "Gain More Tournament Experience",
        description: "Participating in more tournaments will help improve your skills and rankings",
        confidence: 85,
        actionable_suggestions: [
          "Aim to participate in at least one tournament per month",
          "Start with tournaments matching your current skill level",
          "Focus on learning rather than just winning",
        ],
        priority: "high" as const,
      });
    }

    return {
      personal_performance: personalPerformance,
      performance_trends: performanceTrends,
      partner_analysis: partnerAnalysis,
      judge_feedback_analysis: judgeAnalysis,
      tournament_analysis: tournamentAnalysis,
      peer_comparison: peerComparison,
      growth_trajectory: growthTrajectory,
      insights: insights,
    };
  },
});

export const getStudentEngagementAnalytics = query({
  args: {
    token: v.string(),
    date_range: v.optional(v.object({
      start: v.number(),
      end: v.number(),
    })),
  },
  handler: async (ctx, args): Promise<{
    participation_metrics: {
      tournaments_participated: number;
      debates_completed: number;
      judging_assignments: number;
      volunteer_hours: number;
      community_contributions: number;
      engagement_score: number;
    };
    activity_timeline: Array<{
      date: number;
      activity_type: "tournament" | "judging" | "practice" | "community";
      description: string;
      points_earned: number;
      achievement_unlocked?: string;
    }>;
    learning_progress: {
      skills_acquired: Array<{
        skill: string;
        proficiency_level: number;
        date_acquired: number;
        evidence: string[];
      }>;
      knowledge_areas: Array<{
        area: string;
        confidence_level: number;
        topics_mastered: string[];
        areas_for_growth: string[];
      }>;
      debate_formats_experience: Array<{
        format: string;
        tournaments_participated: number;
        skill_level: "beginner" | "intermediate" | "advanced";
        last_participated: number;
      }>;
    };
    social_connections: {
      debate_network: Array<{
        connection_type: "teammate" | "opponent" | "judge" | "mentor";
        name: string;
        school: string;
        interaction_count: number;
        relationship_strength: number;
      }>;
      mentorship: {
        mentors: Array<{
          name: string;
          role: string;
          guidance_areas: string[];
          interaction_frequency: number;
        }>;
        mentees: Array<{
          name: string;
          help_provided: string[];
          progress_observed: string;
        }>;
      };
      community_involvement: {
        event_attendance: number;
        workshop_participation: number;
        leadership_roles: string[];
        community_contributions: string[];
      };
    };
    goal_tracking: {
      current_goals: Array<{
        goal_id: string;
        title: string;
        description: string;
        target_date: number;
        progress_percentage: number;
        milestones: Array<{
          milestone: string;
          completed: boolean;
          date_completed?: number;
        }>;
      }>;
      completed_goals: Array<{
        title: string;
        completion_date: number;
        achievement_level: "exceeded" | "met" | "partially_met";
        reflection: string;
      }>;
      recommendations: Array<{
        goal_type: "short_term" | "medium_term" | "long_term";
        title: string;
        description: string;
        estimated_timeline: string;
        difficulty: "easy" | "moderate" | "challenging";
      }>;
    };
  }> => {
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySessionReadOnly, {
      token: args.token,
    });

    if (!sessionResult.valid || !sessionResult.user || sessionResult.user.role !== "student") {
      throw new Error("Student access required");
    }

    const user = sessionResult.user;
    const now = Date.now();
    const dateRange = args.date_range || {
      start: now - (365 * 24 * 60 * 60 * 1000),
      end: now,
    };

    const studentResults = await ctx.db
      .query("tournament_results")
      .withIndex("by_speaker_id", (q) => q.eq("speaker_id", user.id))
      .collect();

    const studentTeams = await ctx.db.query("teams").collect();
    const userTeams = studentTeams.filter(team => team.members.includes(user.id));

    const debates = await ctx.db.query("debates").collect();
    const userDebates = debates.filter(debate =>
      userTeams.some(team =>
        team._id === debate.proposition_team_id || team._id === debate.opposition_team_id
      )
    );

    const judgingScores = await ctx.db.query("judging_scores").collect();
    const userJudgingAssignments = judgingScores.filter(score => score.judge_id === user.id);

    const tournaments = await ctx.db.query("tournaments").collect();
    const userTournaments = tournaments.filter(tournament =>
      userTeams.some(team => team.tournament_id === tournament._id)
    );

    const participationMetrics = {
      tournaments_participated: userTournaments.filter(t =>
        t.start_date >= dateRange.start && t.start_date <= dateRange.end
      ).length,
      debates_completed: userDebates.filter(d =>
        d.start_time !== undefined && d.start_time >= dateRange.start && d.start_time <= dateRange.end && d.status === "completed"
      ).length,
      judging_assignments: userJudgingAssignments.filter(j =>
        j.submitted_at >= dateRange.start && j.submitted_at <= dateRange.end
      ).length,
      volunteer_hours: userJudgingAssignments.length * 2,
      community_contributions: userJudgingAssignments.length + (userTournaments.length * 0.5),
      engagement_score: 0,
    };

    participationMetrics.engagement_score = Math.min(100,
      (participationMetrics.tournaments_participated * 10) +
      (participationMetrics.debates_completed * 2) +
      (participationMetrics.judging_assignments * 5) +
      (participationMetrics.volunteer_hours)
    );

    const activityTimeline: { date: number; activity_type: "tournament" | "judging"; description: string; points_earned: number; achievement_unlocked?: string | undefined; }[] = [];

    userTournaments.forEach(tournament => {
      if (tournament.start_date >= dateRange.start && tournament.start_date <= dateRange.end) {
        const tournamentResults = studentResults.filter(r => r.tournament_id === tournament._id);
        const pointsEarned = tournamentResults.reduce((sum, r) => sum + (r.total_speaker_points || 0), 0);

        activityTimeline.push({
          date: tournament.start_date,
          activity_type: "tournament" as const,
          description: `Participated in ${tournament.name}`,
          points_earned: pointsEarned,
          achievement_unlocked: tournamentResults.some(r => r.speaker_rank && r.speaker_rank <= 10)
            ? "Top 10 Speaker" : undefined,
        });
      }
    });

    userJudgingAssignments.forEach(assignment => {
      if (assignment.submitted_at >= dateRange.start && assignment.submitted_at <= dateRange.end) {
        activityTimeline.push({
          date: assignment.submitted_at,
          activity_type: "judging" as const,
          description: "Served as judge",
          points_earned: 50,
        });
      }
    });

    activityTimeline.sort((a, b) => b.date - a.date);

    const skillsAcquired = [];
    const knowledgeAreas = [];

    if (participationMetrics.tournaments_participated >= 3) {
      skillsAcquired.push({
        skill: "Tournament Experience",
        proficiency_level: Math.min(100, participationMetrics.tournaments_participated * 15),
        date_acquired: userTournaments[2]?.start_date || now,
        evidence: [`Participated in ${participationMetrics.tournaments_participated} tournaments`],
      });
    }

    if (participationMetrics.judging_assignments >= 2) {
      skillsAcquired.push({
        skill: "Judging & Evaluation",
        proficiency_level: Math.min(100, participationMetrics.judging_assignments * 20),
        date_acquired: userJudgingAssignments[1]?.submitted_at || now,
        evidence: [`Judged ${participationMetrics.judging_assignments} debates`],
      });
    }

    const formatExperience = new Map<string, { count: number; lastDate: number }>();
    userTournaments.forEach(tournament => {
      const current = formatExperience.get(tournament.format) || { count: 0, lastDate: 0 };
      current.count++;
      current.lastDate = Math.max(current.lastDate, tournament.start_date);
      formatExperience.set(tournament.format, current);
    });

    const formatArray = Array.from(formatExperience.entries()).map(([format, data]) => ({
      format,
      tournaments_participated: data.count,
      skill_level: data.count >= 5 ? "advanced" as const : data.count >= 2 ? "intermediate" as const : "beginner" as const,
      last_participated: data.lastDate,
    }));

    const formatCounts = Array.from(formatExperience.keys());
    if (formatCounts.length > 0) {
      knowledgeAreas.push({
        area: "Debate Formats",
        confidence_level: Math.min(100, formatCounts.length * 25),
        topics_mastered: formatCounts.filter(format => formatExperience.get(format)!.count >= 3),
        areas_for_growth: formatCounts.filter(format => formatExperience.get(format)!.count < 2),
      });
    }

    const learningProgress = {
      skills_acquired: skillsAcquired,
      knowledge_areas: knowledgeAreas,
      debate_formats_experience: formatArray,
    };

    const debateNetwork = [];
    const mentorshipConnections = { mentors: [], mentees: [] };

    const teammates = new Set<Id<"users">>();
    const opponents = new Set<Id<"users">>();

    userTeams.forEach(team => {
      team.members.forEach(memberId => {
        if (memberId !== user.id) {
          teammates.add(memberId);
        }
      });
    });

    userDebates.forEach(debate => {
      const userTeam = userTeams.find(team =>
        team._id === debate.proposition_team_id || team._id === debate.opposition_team_id
      );

      if (userTeam) {
        const opposingTeamId = userTeam._id === debate.proposition_team_id
          ? debate.opposition_team_id
          : debate.proposition_team_id;

        const opposingTeam = studentTeams.find(team => team._id === opposingTeamId);
        if (opposingTeam) {
          opposingTeam.members.forEach(memberId => opponents.add(memberId));
        }
      }
    });

    const networkConnections = await Promise.all([
      ...Array.from(teammates).map(async (teammateId) => {
        const teammate = await ctx.db.get(teammateId);
        const school = teammate?.school_id ? await ctx.db.get(teammate.school_id) : null;
        const interactionCount = userTeams.filter(team => team.members.includes(teammateId)).length;

        return teammate ? {
          connection_type: "teammate" as const,
          name: teammate.name,
          school: school?.name || "Unknown",
          interaction_count: interactionCount,
          relationship_strength: Math.min(100, interactionCount * 20),
        } : null;
      }),
      ...Array.from(opponents).slice(0, 10).map(async (opponentId) => {
        const opponent = await ctx.db.get(opponentId);
        const school = opponent?.school_id ? await ctx.db.get(opponent.school_id) : null;
        const interactionCount = userDebates.filter(debate => {
          const opposingTeam = studentTeams.find(team =>
            (team._id === debate.proposition_team_id || team._id === debate.opposition_team_id) &&
            team.members.includes(opponentId)
          );
          return opposingTeam !== undefined;
        }).length;

        return opponent ? {
          connection_type: "opponent" as const,
          name: opponent.name,
          school: school?.name || "Unknown",
          interaction_count: interactionCount,
          relationship_strength: Math.min(100, interactionCount * 10),
        } : null;
      })
    ]);

    debateNetwork.push(...networkConnections.filter(Boolean) as any[]);

    const socialConnections = {
      debate_network: debateNetwork.sort((a, b) => b.relationship_strength - a.relationship_strength),
      mentorship: mentorshipConnections,
      community_involvement: {
        event_attendance: participationMetrics.tournaments_participated,
        workshop_participation: 0,
        leadership_roles: participationMetrics.judging_assignments > 5 ? ["Experienced Judge"] : [],
        community_contributions: [`Judged ${participationMetrics.judging_assignments} debates`],
      },
    };

    const currentGoals = [];
    const completedGoals: any[] = [];
    const recommendations = [];

    if (participationMetrics.tournaments_participated < 10) {
      currentGoals.push({
        goal_id: "tournament_experience",
        title: "Gain Tournament Experience",
        description: "Participate in at least 10 tournaments to build experience",
        target_date: now + (180 * 24 * 60 * 60 * 1000),
        progress_percentage: (participationMetrics.tournaments_participated / 10) * 100,
        milestones: [
          { milestone: "5 tournaments completed", completed: participationMetrics.tournaments_participated >= 5 },
          { milestone: "Different formats tried", completed: formatArray.length >= 2 },
          { milestone: "10 tournaments completed", completed: participationMetrics.tournaments_participated >= 10 },
        ],
      });
    }

    if (studentResults.length > 0) {
      const bestRank = Math.min(...studentResults.map(r => r.speaker_rank || 999));
      if (bestRank > 20) {
        currentGoals.push({
          goal_id: "top_speaker",
          title: "Achieve Top 20 Speaker Ranking",
          description: "Break into top 20 speakers in a tournament",
          target_date: now + (120 * 24 * 60 * 60 * 1000),
          progress_percentage: Math.max(0, 100 - (bestRank / 20 * 100)),
          milestones: [
            { milestone: "Top 50 achieved", completed: bestRank <= 50 },
            { milestone: "Top 30 achieved", completed: bestRank <= 30 },
            { milestone: "Top 20 achieved", completed: bestRank <= 20 },
          ],
        });
      }
    }

    recommendations.push(
      {
        goal_type: "short_term" as const,
        title: "Improve Speaking Skills",
        description: "Focus on delivery and argumentation in next 3 tournaments",
        estimated_timeline: "2-3 months",
        difficulty: "moderate" as const,
      },
      {
        goal_type: "medium_term" as const,
        title: "Develop Judging Expertise",
        description: "Judge at least 20 debates to understand evaluation criteria",
        estimated_timeline: "6 months",
        difficulty: "easy" as const,
      },
      {
        goal_type: "long_term" as const,
        title: "Tournament Breaking Goal",
        description: "Break to elimination rounds in a major tournament",
        estimated_timeline: "12-18 months",
        difficulty: "challenging" as const,
      }
    );

    const goalTracking = {
      current_goals: currentGoals,
      completed_goals: completedGoals,
      recommendations: recommendations,
    };

    return {
      participation_metrics: participationMetrics,
      activity_timeline: activityTimeline.slice(0, 20),
      learning_progress: learningProgress,
      social_connections: socialConnections,
      goal_tracking: goalTracking,
    };
  },
});

export const getStudentCompetitiveIntelligence = query({
  args: {
    token: v.string(),
    competitor_student_ids: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, args): Promise<{
    rival_analysis: Array<{
      student_id: Id<"users">;
      student_name: string;
      school_name: string;
      head_to_head_record: {
        wins: number;
        losses: number;
        draws: number;
        win_rate: number;
      };
      comparative_performance: {
        your_avg_rank: number;
        their_avg_rank: number;
        rank_difference: number;
        your_avg_score: number;
        their_avg_score: number;
        score_difference: number;
      };
      tournament_overlap: Array<{
        tournament_name: string;
        your_rank: number;
        their_rank: number;
        performance_gap: number;
      }>;
      rivalry_strength: number;
      improvement_opportunities: string[];
    }>;
    school_comparison: {
      peer_schools: Array<{
        school_name: string;
        avg_student_rank: number;
        top_performers: number;
        tournament_overlap: number;
        competitive_threat: "low" | "medium" | "high";
      }>;
      your_school_position: {
        ranking_among_peers: number;
        your_contribution: number;
        areas_of_strength: string[];
        improvement_potential: string[];
      };
    };
    tournament_intelligence: Array<{
      tournament_name: string;
      format: string;
      your_best_rank: number;
      competition_level: "beginner" | "intermediate" | "advanced";
      success_probability: number;
      strategic_insights: string[];
      recommended_preparation: string[];
    }>;
    judge_preferences: Array<{
      judge_name: string;
      times_judged_you: number;
      your_avg_score: number;
      judge_scoring_pattern: "generous" | "moderate" | "strict";
      preference_indicators: string[];
      preparation_tips: string[];
    }>;
  }> => {
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySessionReadOnly, {
      token: args.token,
    });

    if (!sessionResult.valid || !sessionResult.user || sessionResult.user.role !== "student") {
      throw new Error("Student access required");
    }

    const user = sessionResult.user;

    const studentResults = await ctx.db
      .query("tournament_results")
      .withIndex("by_speaker_id", (q) => q.eq("speaker_id", user.id))
      .collect();

    const tournaments = await Promise.all(
      studentResults.map(result => ctx.db.get(result.tournament_id))
    );

    const validTournaments = tournaments.filter(Boolean) as Doc<"tournaments">[];

    let competitorStudents: Doc<"users">[];
    if (args.competitor_student_ids && args.competitor_student_ids.length > 0) {
      competitorStudents = await Promise.all(
        args.competitor_student_ids.map(id => ctx.db.get(id))
      ).then(students => students.filter(Boolean) as Doc<"users">[]);
    } else {
      const allStudents = await ctx.db
        .query("users")
        .withIndex("by_role", (q) => q.eq("role", "student"))
        .collect();

      const competitorResults = await Promise.all(
        allStudents.map(async (student) => {
          if (student._id === user.id) return null;

          const results = await ctx.db
            .query("tournament_results")
            .withIndex("by_speaker_id", (q) => q.eq("speaker_id", student._id))
            .collect();

          const sharedTournaments = results.filter(result =>
            validTournaments.some(t => t._id === result.tournament_id)
          );

          return sharedTournaments.length >= 2 ? student : null;
        })
      );

      competitorStudents = competitorResults.filter(Boolean) as Doc<"users">[];
      competitorStudents = competitorStudents.slice(0, 15);
    }

    const rivalAnalysis = await Promise.all(
      competitorStudents.map(async (competitor) => {
        const competitorResults = await ctx.db
          .query("tournament_results")
          .withIndex("by_speaker_id", (q) => q.eq("speaker_id", competitor._id))
          .collect();

        const sharedTournaments = validTournaments.filter(tournament =>
          competitorResults.some(cr => cr.tournament_id === tournament._id)
        );

        const teams = await ctx.db.query("teams").collect();
        const userTeams = teams.filter(team => team.members.includes(user.id));
        const competitorTeams = teams.filter(team => team.members.includes(competitor._id));

        const debates = await ctx.db.query("debates").collect();

        let wins = 0, losses = 0, draws = 0;

        for (const debate of debates) {
          const userTeam = userTeams.find(team =>
            team._id === debate.proposition_team_id || team._id === debate.opposition_team_id
          );
          const competitorTeam = competitorTeams.find(team =>
            team._id === debate.proposition_team_id || team._id === debate.opposition_team_id
          );

          if (userTeam && competitorTeam && userTeam._id !== competitorTeam._id) {
            const userResult = await ctx.db
              .query("tournament_results")
              .withIndex("by_team_id", (q) => q.eq("team_id", userTeam._id))
              .first();
            const competitorResult = await ctx.db
              .query("tournament_results")
              .withIndex("by_team_id", (q) => q.eq("team_id", competitorTeam._id))
              .first();

            if (userResult && competitorResult) {
              if ((userResult.team_rank || 999) < (competitorResult.team_rank || 999)) {
                wins++;
              } else if ((userResult.team_rank || 999) > (competitorResult.team_rank || 999)) {
                losses++;
              } else {
                draws++;
              }
            }
          }
        }

        const totalGames = wins + losses + draws;
        const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0;

        const yourResults = studentResults.filter(result =>
          sharedTournaments.some(t => t._id === result.tournament_id)
        );
        const theirResults = competitorResults.filter(result =>
          sharedTournaments.some(t => t._id === result.tournament_id)
        );

        const yourAvgRank = yourResults.length > 0
          ? yourResults.reduce((sum, r) => sum + (r.speaker_rank || 999), 0) / yourResults.length
          : 999;
        const theirAvgRank = theirResults.length > 0
          ? theirResults.reduce((sum, r) => sum + (r.speaker_rank || 999), 0) / theirResults.length
          : 999;

        const yourAvgScore = yourResults.length > 0
          ? yourResults.reduce((sum, r) => sum + (r.average_speaker_score || 0), 0) / yourResults.length
          : 0;
        const theirAvgScore = theirResults.length > 0
          ? theirResults.reduce((sum, r) => sum + (r.average_speaker_score || 0), 0) / theirResults.length
          : 0;

        const tournamentOverlap = await Promise.all(
          sharedTournaments.map(async (tournament) => {
            const yourResult = yourResults.find(r => r.tournament_id === tournament._id);
            const theirResult = theirResults.find(r => r.tournament_id === tournament._id);

            return {
              tournament_name: tournament.name,
              your_rank: yourResult?.speaker_rank || 999,
              their_rank: theirResult?.speaker_rank || 999,
              performance_gap: (yourResult?.speaker_rank || 999) - (theirResult?.speaker_rank || 999),
            };
          })
        );

        const rivalryStrength = Math.min(100,
          (sharedTournaments.length * 15) +
          (totalGames * 10) +
          (Math.abs(yourAvgRank - theirAvgRank) < 20 ? 25 : 0)
        );

        const improvementOpportunities = [];
        if (theirAvgRank < yourAvgRank) {
          improvementOpportunities.push("Study their tournament preparation methods");
          improvementOpportunities.push("Analyze their speaking style and techniques");
        }
        if (theirAvgScore > yourAvgScore) {
          improvementOpportunities.push("Focus on improving content and delivery");
        }
        if (wins < losses) {
          improvementOpportunities.push("Develop strategies specific to this competitor");
        }

        const school = competitor.school_id ? await ctx.db.get(competitor.school_id) : null;

        return {
          student_id: competitor._id,
          student_name: competitor.name,
          school_name: school?.name || "Unknown School",
          head_to_head_record: {
            wins,
            losses,
            draws,
            win_rate: Math.round(winRate * 10) / 10,
          },
          comparative_performance: {
            your_avg_rank: Math.round(yourAvgRank),
            their_avg_rank: Math.round(theirAvgRank),
            rank_difference: Math.round(yourAvgRank - theirAvgRank),
            your_avg_score: Math.round(yourAvgScore * 10) / 10,
            their_avg_score: Math.round(theirAvgScore * 10) / 10,
            score_difference: Math.round((yourAvgScore - theirAvgScore) * 10) / 10,
          },
          tournament_overlap: tournamentOverlap,
          rivalry_strength: Math.round(rivalryStrength),
          improvement_opportunities: improvementOpportunities,
        };
      })
    );

    const schools = await ctx.db.query("schools").collect();
    const userSchool = user.school_id ? await ctx.db.get(user.school_id) : null;

    const peerSchools = await Promise.all(
      schools
        .filter(school => school._id !== user.school_id && school.country === (userSchool?.country || "Rwanda"))
        .slice(0, 10)
        .map(async (school) => {
          const schoolStudents = await ctx.db
            .query("users")
            .withIndex("by_school_id_role", (q) =>
              q.eq("school_id", school._id).eq("role", "student")
            )
            .collect();

          const schoolResults = await Promise.all(
            schoolStudents.map(async (student) => {
              return await ctx.db
                .query("tournament_results")
                .withIndex("by_speaker_id", (q) => q.eq("speaker_id", student._id))
                .collect();
            })
          );

          const allSchoolResults = schoolResults.flat();
          const avgRank = allSchoolResults.length > 0
            ? allSchoolResults.reduce((sum, r) => sum + (r.speaker_rank || 999), 0) / allSchoolResults.length
            : 999;

          const topPerformers = schoolStudents.filter(student => {
            const studentResults = schoolResults.find(sr => sr.length > 0);
            if (!studentResults) return false;
            const bestRank = Math.min(...studentResults.map(r => r.speaker_rank || 999));
            return bestRank <= 20;
          }).length;

          const tournamentOverlap = validTournaments.filter(tournament => {
            return allSchoolResults.some(result => result.tournament_id === tournament._id);
          }).length;

          const threat = avgRank < 100 && topPerformers > 2 ? "high" :
            avgRank < 200 && topPerformers > 0 ? "medium" : "low";

          return {
            school_name: school.name,
            avg_student_rank: Math.round(avgRank),
            top_performers: topPerformers,
            tournament_overlap: tournamentOverlap,
            competitive_threat: threat as "low" | "medium" | "high",
          };
        })
    );

    const yourSchoolStudents = userSchool ? await ctx.db
      .query("users")
      .withIndex("by_school_id_role", (q) =>
        q.eq("school_id", userSchool._id).eq("role", "student")
      )
      .collect() : [];

    const yourSchoolResults = await Promise.all(
      yourSchoolStudents.map(async (student) => {
        const results = await ctx.db
          .query("tournament_results")
          .withIndex("by_speaker_id", (q) => q.eq("speaker_id", student._id))
          .collect();
        return { student, results };
      })
    );

    const yourRank = studentResults.length > 0
      ? studentResults.reduce((sum, r) => sum + (r.speaker_rank || 999), 0) / studentResults.length
      : 999;

    const betterSchoolmates = yourSchoolResults.filter(sr => {
      if (sr.student._id === user.id || sr.results.length === 0) return false;
      const avgRank = sr.results.reduce((sum, r) => sum + (r.speaker_rank || 999), 0) / sr.results.length;
      return avgRank < yourRank;
    }).length;

    const schoolRanking = betterSchoolmates + 1;
    const yourContribution = yourSchoolStudents.length > 0 ?
      (yourSchoolStudents.length - betterSchoolmates) / yourSchoolStudents.length * 100 : 100;

    const schoolComparison = {
      peer_schools: peerSchools.sort((a, b) => a.avg_student_rank - b.avg_student_rank),
      your_school_position: {
        ranking_among_peers: schoolRanking,
        your_contribution: Math.round(yourContribution),
        areas_of_strength: yourRank < 100 ? ["Strong individual performance"] : [],
        improvement_potential: yourRank > 200 ? ["Focus on consistent performance"] : [],
      },
    };

    const tournamentIntelligence = await Promise.all(
      validTournaments.slice(0, 10).map(async (tournament) => {
        const allResults = await ctx.db
          .query("tournament_results")
          .withIndex("by_tournament_id", (q) => q.eq("tournament_id", tournament._id))
          .collect();

        const yourResult = studentResults.find(r => r.tournament_id === tournament._id);
        const competitionLevel = allResults.length < 50 ? "beginner" :
          allResults.length < 150 ? "intermediate" : "advanced";

        const avgRankInTournament = allResults.length > 0
          ? allResults.reduce((sum, r) => sum + (r.speaker_rank || 999), 0) / allResults.length
          : 999;

        const successProbability = yourResult ?
          Math.max(0, 100 - ((yourResult.speaker_rank || 999) / allResults.length * 100)) :
          Math.max(0, 100 - (yourRank / avgRankInTournament * 100));

        const strategicInsights = [];
        const recommendedPreparation = [];

        if (tournament.format === "BritishParliamentary") {
          strategicInsights.push("Focus on position-specific strategies");
          recommendedPreparation.push("Practice opening, closing, and extension speeches");
        }
        if (competitionLevel === "advanced") {
          strategicInsights.push("Expect high-level opposition research");
          recommendedPreparation.push("Prepare for complex philosophical motions");
        }
        if (yourResult && yourResult.speaker_rank && yourResult.speaker_rank > avgRankInTournament) {
          strategicInsights.push("This tournament format may not suit your style");
          recommendedPreparation.push("Focus on adapting to this tournament's judging criteria");
        }

        return {
          tournament_name: tournament.name,
          format: tournament.format,
          your_best_rank: yourResult?.speaker_rank || 999,
          competition_level: competitionLevel as "beginner" | "intermediate" | "advanced",
          success_probability: Math.round(successProbability),
          strategic_insights: strategicInsights,
          recommended_preparation: recommendedPreparation,
        };
      })
    );

    const judgingScores = await ctx.db.query("judging_scores").collect();
    const teams = await ctx.db.query("teams").collect();
    const userTeams = teams.filter(team => team.members.includes(user.id));
    const debates = await ctx.db.query("debates").collect();

    const userDebates = debates.filter(debate =>
      userTeams.some(team =>
        team._id === debate.proposition_team_id || team._id === debate.opposition_team_id
      )
    );

    const judgeStatsMap = new Map<Id<"users">, {
      name: string;
      scores: number[];
      timesJudged: number;
      avgScore: number;
    }>();

    judgingScores.forEach(score => {
      if (userDebates.some(debate => debate._id === score.debate_id)) {
        const studentScore = score.speaker_scores?.find(s => s.speaker_id === user.id);
        if (studentScore) {
          const current = judgeStatsMap.get(score.judge_id) || {
            name: "Unknown Judge",
            scores: [],
            timesJudged: 0,
            avgScore: 0,
          };
          current.scores.push(studentScore.score);
          current.timesJudged++;
          judgeStatsMap.set(score.judge_id, current);
        }
      }
    });

    const judgePreferences = await Promise.all(
      Array.from(judgeStatsMap.entries())
        .filter(([_, stats]) => stats.timesJudged >= 2)
        .map(async ([judgeId, stats]) => {
          const judge = await ctx.db.get(judgeId);
          stats.avgScore = stats.scores.reduce((sum, score) => sum + score, 0) / stats.scores.length;
          stats.name = judge?.name || "Unknown Judge";

          const allJudgeScores = judgingScores.filter(score => score.judge_id === judgeId);
          const allScores = allJudgeScores.flatMap(score =>
            score.speaker_scores?.map(s => s.score) || []
          );
          const judgeAvg = allScores.length > 0
            ? allScores.reduce((sum, score) => sum + score, 0) / allScores.length
            : 25;

          const scoringPattern = judgeAvg > 27 ? "generous" : judgeAvg < 23 ? "strict" : "moderate";

          const preferenceIndicators = [];
          const preparationTips = [];

          if (stats.avgScore > judgeAvg + 2) {
            preferenceIndicators.push("Favors your speaking style");
            preparationTips.push("Continue your current approach");
          } else if (stats.avgScore < judgeAvg - 2) {
            preferenceIndicators.push("May prefer different style");
            preparationTips.push("Adapt your delivery for this judge");
          }

          if (scoringPattern === "strict") {
            preparationTips.push("Prepare thoroughly and avoid risks");
          } else if (scoringPattern === "generous") {
            preparationTips.push("Take calculated risks in argumentation");
          }

          return {
            judge_name: stats.name,
            times_judged_you: stats.timesJudged,
            your_avg_score: Math.round(stats.avgScore * 10) / 10,
            judge_scoring_pattern: scoringPattern as "generous" | "moderate" | "strict",
            preference_indicators: preferenceIndicators,
            preparation_tips: preparationTips,
          };
        })
    );

    return {
      rival_analysis: rivalAnalysis.sort((a, b) => b.rivalry_strength - a.rivalry_strength),
      school_comparison: schoolComparison,
      tournament_intelligence: tournamentIntelligence,
      judge_preferences: judgePreferences.sort((a, b) => b.your_avg_score - a.your_avg_score),
    };
  },
});

export const exportStudentAnalyticsData = query({
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

    if (!sessionResult.valid || !sessionResult.user || sessionResult.user.role !== "student") {
      throw new Error("Student access required");
    }

    const exportData: Record<string, any> = {};

    if (args.sections.includes("performance")) {
      const performanceData = await ctx.runQuery(api.functions.student.analytics.getStudentPerformanceAnalytics, {
        token: args.token,
        date_range: args.date_range,
      });

      exportData.performance_summary = {
        current_rank: performanceData.personal_performance.current_rank,
        best_rank: performanceData.personal_performance.best_rank,
        avg_speaker_score: performanceData.personal_performance.avg_speaker_score,
        total_tournaments: performanceData.personal_performance.total_tournaments,
        win_rate: performanceData.personal_performance.win_rate,
        consistency_score: performanceData.personal_performance.consistency_score,
      };

      exportData.performance_trends = performanceData.performance_trends.map(trend => ({
        tournament_name: trend.tournament_name,
        date: new Date(trend.date).toLocaleDateString(),
        speaker_rank: trend.speaker_rank,
        speaker_points: trend.speaker_points,
        team_rank: trend.team_rank,
        avg_score: trend.avg_score,
      }));

      exportData.partner_analysis = performanceData.partner_analysis.map(partner => ({
        partner_name: partner.partner_name,
        tournaments_together: partner.tournaments_together,
        win_rate_together: partner.win_rate_together,
        chemistry_score: partner.chemistry_score,
      }));

      exportData.tournament_analysis = performanceData.tournament_analysis.best_formats.map(format => ({
        format: format.format,
        avg_rank: format.avg_rank,
        participation_count: format.participation_count,
      }));
    }

    if (args.sections.includes("engagement")) {
      const engagementData = await ctx.runQuery(api.functions.student.analytics.getStudentEngagementAnalytics, {
        token: args.token,
        date_range: args.date_range,
      });

      exportData.participation_summary = engagementData.participation_metrics;
      exportData.activity_timeline = engagementData.activity_timeline.map(activity => ({
        date: new Date(activity.date).toLocaleDateString(),
        activity_type: activity.activity_type,
        description: activity.description,
        points_earned: activity.points_earned,
      }));
      exportData.learning_progress = engagementData.learning_progress.skills_acquired;
    }

    if (args.sections.includes("competitive")) {
      const competitiveData = await ctx.runQuery(api.functions.student.analytics.getStudentCompetitiveIntelligence, {
        token: args.token,
      });

      exportData.rival_analysis = competitiveData.rival_analysis.map(rival => ({
        student_name: rival.student_name,
        school_name: rival.school_name,
        head_to_head_wins: rival.head_to_head_record.wins,
        head_to_head_losses: rival.head_to_head_record.losses,
        your_avg_rank: rival.comparative_performance.your_avg_rank,
        their_avg_rank: rival.comparative_performance.their_avg_rank,
        rivalry_strength: rival.rivalry_strength,
      }));

      exportData.judge_preferences = competitiveData.judge_preferences.map(judge => ({
        judge_name: judge.judge_name,
        times_judged: judge.times_judged_you,
        your_avg_score: judge.your_avg_score,
        scoring_pattern: judge.judge_scoring_pattern,
      }));
    }

    return exportData;
  },
});

export const generateStudentAnalyticsReport = mutation({
  args: {
    token: v.string(),
    report_config: v.object({
      title: v.string(),
      sections: v.array(v.string()),
      date_range: v.optional(v.object({
        start: v.number(),
        end: v.number(),
      })),
      include_insights: v.optional(v.boolean()),
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

    if (!sessionResult.valid || !sessionResult.user || sessionResult.user.role !== "student") {
      throw new Error("Student access required");
    }

    const reportId = `student_report_${sessionResult.user.id}_${Date.now()}`;
    const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000);

    const reportData: any = {};

    if (args.report_config.sections.includes("performance")) {
      reportData.performance = await ctx.runQuery(api.functions.student.analytics.getStudentPerformanceAnalytics, {
        token: args.token,
        date_range: args.report_config.date_range,
      });
    }

    if (args.report_config.sections.includes("engagement")) {
      reportData.engagement = await ctx.runQuery(api.functions.student.analytics.getStudentEngagementAnalytics, {
        token: args.token,
        date_range: args.report_config.date_range,
      });
    }

    if (args.report_config.sections.includes("competitive")) {
      reportData.competitive = await ctx.runQuery(api.functions.student.analytics.getStudentCompetitiveIntelligence, {
        token: args.token,
      });
    }

    await ctx.db.insert("report_shares", {
      report_type: "tournament",
      report_id: JSON.stringify({
        config: args.report_config,
        data: reportData,
        student_id: sessionResult.user.id,
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
      description: `Generated student analytics report: ${args.report_config.title}`,
    });

    return {
      report_id: reportId,
      report_url: `${process.env.FRONTEND_SITE_URL}/reports/student/${reportId}`,
      generated_at: Date.now(),
      expires_at: expiresAt,
    };
  },
});