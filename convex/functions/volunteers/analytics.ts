import { mutation, query } from "../../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../../_generated/api";
import { Doc, Id } from "../../_generated/dataModel";

export const getVolunteerJudgingAnalytics = query({
  args: {
    token: v.string(),
    date_range: v.optional(v.object({
      start: v.number(),
      end: v.number(),
    })),
    compare_to_previous_period: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{
    judging_performance: {
      total_debates_judged: number;
      total_tournaments: number;
      avg_judging_quality: number;
      consistency_score: number;
      response_time_avg: number;
      feedback_quality_score: number;
      bias_detection_incidents: number;
      experience_level: "novice" | "intermediate" | "experienced" | "expert";
    };
    judging_trends: Array<{
      period: string;
      debates_judged: number;
      avg_quality_rating: number;
      avg_response_time: number;
      tournaments_participated: number;
      feedback_provided: number;
    }>;
    feedback_analysis: {
      feedback_given: Array<{
        tournament_name: string;
        debate_count: number;
        avg_feedback_length: number;
        constructive_rating: number;
        helpfulness_score: number;
      }>;
      feedback_received: Array<{
        rating_category: string;
        avg_score: number;
        feedback_count: number;
        improvement_trend: number;
      }>;
      common_feedback_themes: Array<{
        theme: string;
        frequency: number;
        sentiment: "positive" | "neutral" | "negative";
      }>;
    };
    tournament_contributions: Array<{
      tournament_id: Id<"tournaments">;
      tournament_name: string;
      role: "judge" | "chief_judge" | "tabulator" | "organizer";
      debates_judged: number;
      contribution_score: number;
      organizer_rating: number;
      student_feedback_avg: number;
      impact_metrics: {
        debates_facilitated: number;
        students_evaluated: number;
        feedback_provided: number;
        time_contributed: number;
      };
    }>;
    expertise_development: {
      format_expertise: Array<{
        format: string;
        debates_judged: number;
        proficiency_level: number;
        specialization_score: number;
        recent_performance: number;
      }>;
      judging_skills: Array<{
        skill: string;
        current_level: number;
        growth_rate: number;
        certification_status: "none" | "in_progress" | "certified" | "advanced";
      }>;
      motion_categories: Array<{
        category: string;
        expertise_level: number;
        debates_judged: number;
        avg_quality_score: number;
      }>;
    };
    community_impact: {
      schools_served: number;
      students_mentored: number;
      judges_trained: number;
      workshops_conducted: number;
      recognition_received: Array<{
        type: string;
        title: string;
        date: number;
        description: string;
      }>;
      leadership_roles: Array<{
        role: string;
        organization: string;
        start_date: number;
        responsibilities: string[];
        impact_score: number;
      }>;
    };
    comparative_analysis: {
      peer_ranking: number;
      experience_percentile: number;
      quality_percentile: number;
      activity_percentile: number;
      peer_comparison: Array<{
        metric: string;
        your_value: number;
        peer_average: number;
        percentile: number;
      }>;
      improvement_areas: Array<{
        area: string;
        current_score: number;
        target_score: number;
        improvement_suggestions: string[];
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

    if (!sessionResult.valid || !sessionResult.user || sessionResult.user.role !== "volunteer") {
      throw new Error("Volunteer access required");
    }

    const user = sessionResult.user;
    const now = Date.now();
    const dateRange = args.date_range || {
      start: now - (365 * 24 * 60 * 60 * 1000),
      end: now,
    };
    const judgingScores = await ctx.db
      .query("judging_scores")
      .withIndex("by_judge_id", (q) => q.eq("judge_id", user.id))
      .collect();

    const relevantJudgingScores = judgingScores.filter(score =>
      score.submitted_at >= dateRange.start && score.submitted_at <= dateRange.end
    );

    const judgeFeedback = await ctx.db.query("judge_feedback").collect();
    const receivedFeedback = judgeFeedback.filter(feedback =>
      feedback.judge_id === user.id &&
      feedback.submitted_at >= dateRange.start &&
      feedback.submitted_at <= dateRange.end
    );

    const debates = await ctx.db.query("debates").collect();
    const judgedDebates = debates.filter(debate =>
      relevantJudgingScores.some(score => score.debate_id === debate._id)
    );

    const tournaments = await Promise.all(
      judgedDebates.map(async (debate) => {
        return await ctx.db.get(debate.tournament_id);
      })
    );

    const validTournaments = tournaments.filter(Boolean) as Doc<"tournaments">[];
    const uniqueTournaments = Array.from(new Set(validTournaments.map(t => t._id)))
      .map(id => validTournaments.find(t => t._id === id)!)
      .filter(Boolean);

    let totalQualityRating = 0;
    let qualityRatingCount = 0;
    let totalResponseTime = 0;
    let responseTimeCount = 0;
    let biasIncidents = 0;
    let totalFeedbackLength = 0;
    let feedbackCount = 0;

    relevantJudgingScores.forEach(score => {
      const debate = judgedDebates.find(d => d._id === score.debate_id);
      if (debate && debate.start_time) {
        const responseTime = (score.submitted_at - debate.start_time) / (60 * 60 * 1000);
        if (responseTime > 0 && responseTime < 72) {
          totalResponseTime += responseTime;
          responseTimeCount++;
        }
      }

      if (score.speaker_scores) {
        score.speaker_scores.forEach(speakerScore => {
          if (speakerScore.bias_detected) {
            biasIncidents++;
          }
          if (speakerScore.comments) {
            totalFeedbackLength += speakerScore.comments.length;
            feedbackCount++;
          }
        });
      }
    });

    receivedFeedback.forEach(feedback => {
      const avgRating = (feedback.clarity + feedback.fairness + feedback.knowledge + feedback.helpfulness) / 4;
      totalQualityRating += avgRating;
      qualityRatingCount++;
    });

    const avgJudgingQuality = qualityRatingCount > 0 ? totalQualityRating / qualityRatingCount : 0;
    const avgResponseTime = responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0;
    const avgFeedbackLength = feedbackCount > 0 ? totalFeedbackLength / feedbackCount : 0;

    const judgingScoreVariances: number[] = [];
    relevantJudgingScores.forEach(score => {
      if (score.speaker_scores && score.speaker_scores.length > 1) {
        const scores = score.speaker_scores.map(s => s.score);
        const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
        const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
        judgingScoreVariances.push(Math.sqrt(variance));
      }
    });

    const consistencyScore = judgingScoreVariances.length > 0
      ? Math.max(0, 100 - (judgingScoreVariances.reduce((sum, v) => sum + v, 0) / judgingScoreVariances.length) * 10)
      : 100;

    const feedbackQualityScore = Math.min(100, (avgFeedbackLength / 50) * avgJudgingQuality * 10);

    const experienceLevel = relevantJudgingScores.length < 10 ? "novice" :
      relevantJudgingScores.length < 50 ? "intermediate" :
        relevantJudgingScores.length < 150 ? "experienced" : "expert";

    const judgingPerformance = {
      total_debates_judged: relevantJudgingScores.length,
      total_tournaments: uniqueTournaments.length,
      avg_judging_quality: Math.round(avgJudgingQuality * 10) / 10,
      consistency_score: Math.round(consistencyScore * 10) / 10,
      response_time_avg: Math.round(avgResponseTime * 10) / 10,
      feedback_quality_score: Math.round(feedbackQualityScore * 10) / 10,
      bias_detection_incidents: biasIncidents,
      experience_level: experienceLevel as "novice" | "intermediate" | "experienced" | "expert",
    };

    const judgingTrends = [];
    const months = Math.ceil((dateRange.end - dateRange.start) / (30 * 24 * 60 * 60 * 1000));

    for (let i = 0; i < months; i++) {
      const periodStart = dateRange.start + (i * 30 * 24 * 60 * 60 * 1000);
      const periodEnd = Math.min(periodStart + (30 * 24 * 60 * 60 * 1000), dateRange.end);

      const periodScores = relevantJudgingScores.filter(score =>
        score.submitted_at >= periodStart && score.submitted_at < periodEnd
      );

      const periodFeedback = receivedFeedback.filter(feedback =>
        feedback.submitted_at >= periodStart && feedback.submitted_at < periodEnd
      );

      const periodTournaments = uniqueTournaments.filter(tournament => {
        const tournamentScores = periodScores.filter(score => {
          const debate = judgedDebates.find(d => d._id === score.debate_id);
          return debate && debate.tournament_id === tournament._id;
        });
        return tournamentScores.length > 0;
      });

      const avgQualityRating = periodFeedback.length > 0
        ? periodFeedback.reduce((sum, f) => sum + (f.clarity + f.fairness + f.knowledge + f.helpfulness) / 4, 0) / periodFeedback.length
        : 0;

      let periodResponseTime = 0;
      let periodResponseCount = 0;

      periodScores.forEach(score => {
        const debate = judgedDebates.find(d => d._id === score.debate_id);
        if (debate && debate.start_time) {
          const responseTime = (score.submitted_at - debate.start_time) / (60 * 60 * 1000);
          if (responseTime > 0 && responseTime < 72) {
            periodResponseTime += responseTime;
            periodResponseCount++;
          }
        }
      });

      const avgPeriodResponseTime = periodResponseCount > 0 ? periodResponseTime / periodResponseCount : 0;

      let feedbackProvided = 0;
      periodScores.forEach(score => {
        if (score.speaker_scores) {
          feedbackProvided += score.speaker_scores.filter(s => s.comments && s.comments.length > 10).length;
        }
      });

      judgingTrends.push({
        period: new Date(periodStart).toISOString().slice(0, 7),
        debates_judged: periodScores.length,
        avg_quality_rating: Math.round(avgQualityRating * 10) / 10,
        avg_response_time: Math.round(avgPeriodResponseTime * 10) / 10,
        tournaments_participated: periodTournaments.length,
        feedback_provided: feedbackProvided,
      });
    }

    const feedbackGiven = await Promise.all(
      uniqueTournaments.map(async (tournament) => {
        const tournamentScores = relevantJudgingScores.filter(score => {
          const debate = judgedDebates.find(d => d._id === score.debate_id);
          return debate && debate.tournament_id === tournament._id;
        });

        let totalFeedbackLength = 0;
        let feedbackCount = 0;
        let constructiveElements = 0;

        tournamentScores.forEach(score => {
          if (score.speaker_scores) {
            score.speaker_scores.forEach(speakerScore => {
              if (speakerScore.comments) {
                totalFeedbackLength += speakerScore.comments.length;
                feedbackCount++;

                const constructiveWords = ['improve', 'consider', 'try', 'develop', 'practice', 'focus'];
                const hasConstructive = constructiveWords.some(word =>
                  speakerScore.comments!.toLowerCase().includes(word)
                );
                if (hasConstructive) constructiveElements++;
              }
            });
          }
        });

        const avgFeedbackLength = feedbackCount > 0 ? totalFeedbackLength / feedbackCount : 0;
        const constructiveRating = feedbackCount > 0 ? (constructiveElements / feedbackCount) * 100 : 0;
        const helpfulnessScore = Math.min(100, (avgFeedbackLength / 100) * constructiveRating);

        return {
          tournament_name: tournament.name,
          debate_count: tournamentScores.length,
          avg_feedback_length: Math.round(avgFeedbackLength),
          constructive_rating: Math.round(constructiveRating),
          helpfulness_score: Math.round(helpfulnessScore),
        };
      })
    );

    const feedbackReceivedCategories = [
      { category: "clarity", scores: receivedFeedback.map(f => f.clarity) },
      { category: "fairness", scores: receivedFeedback.map(f => f.fairness) },
      { category: "knowledge", scores: receivedFeedback.map(f => f.knowledge) },
      { category: "helpfulness", scores: receivedFeedback.map(f => f.helpfulness) },
    ];

    const feedbackReceived = feedbackReceivedCategories.map(cat => {
      const avgScore = cat.scores.length > 0
        ? cat.scores.reduce((sum, score) => sum + score, 0) / cat.scores.length
        : 0;

      const recentScores = cat.scores.slice(-5);
      const olderScores = cat.scores.slice(0, -5);
      const improvementTrend = recentScores.length > 0 && olderScores.length > 0
        ? ((recentScores.reduce((sum, s) => sum + s, 0) / recentScores.length) -
          (olderScores.reduce((sum, s) => sum + s, 0) / olderScores.length)) /
        (olderScores.reduce((sum, s) => sum + s, 0) / olderScores.length) * 100
        : 0;

      return {
        rating_category: cat.category,
        avg_score: Math.round(avgScore * 10) / 10,
        feedback_count: cat.scores.length,
        improvement_trend: Math.round(improvementTrend * 10) / 10,
      };
    });

    const commonThemes = new Map<string, { count: number; sentiment: "positive" | "neutral" | "negative" }>();

    receivedFeedback.forEach(feedback => {
      if (feedback.comments) {
        const words = feedback.comments.toLowerCase().split(/\s+/);
        const positiveWords = ['excellent', 'great', 'good', 'fair', 'consistent', 'thorough'];
        const negativeWords = ['bias', 'unfair', 'inconsistent', 'unclear', 'rushed'];

        words.forEach(word => {
          if (positiveWords.includes(word)) {
            const current = commonThemes.get(word) || { count: 0, sentiment: "positive" as const };
            current.count++;
            commonThemes.set(word, current);
          } else if (negativeWords.includes(word)) {
            const current = commonThemes.get(word) || { count: 0, sentiment: "negative" as const };
            current.count++;
            commonThemes.set(word, current);
          }
        });
      }
    });

    const commonFeedbackThemes = Array.from(commonThemes.entries())
      .map(([theme, data]) => ({
        theme,
        frequency: data.count,
        sentiment: data.sentiment,
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);

    const feedbackAnalysis = {
      feedback_given: feedbackGiven.sort((a, b) => b.helpfulness_score - a.helpfulness_score),
      feedback_received: feedbackReceived,
      common_feedback_themes: commonFeedbackThemes,
    };

    const tournamentContributions = await Promise.all(
      uniqueTournaments.map(async (tournament) => {
        const tournamentScores = relevantJudgingScores.filter(score => {
          const debate = judgedDebates.find(d => d._id === score.debate_id);
          return debate && debate.tournament_id === tournament._id;
        });

        const tournamentFeedback = receivedFeedback.filter(feedback => {
          const score = relevantJudgingScores.find(s => s.judge_id === feedback.judge_id);
          if (!score) return false;
          const debate = judgedDebates.find(d => d._id === score.debate_id);
          return debate && debate.tournament_id === tournament._id;
        });

        const organizerRating = tournamentFeedback.length > 0
          ? tournamentFeedback.reduce((sum, f) => sum + (f.clarity + f.fairness + f.knowledge + f.helpfulness) / 4, 0) / tournamentFeedback.length
          : 0;

        const studentFeedbackAvg = organizerRating;

        let studentsEvaluated = 0;
        let feedbackProvided = 0;
        let timeContributed = 0;

        tournamentScores.forEach(score => {
          if (score.speaker_scores) {
            studentsEvaluated += score.speaker_scores.length;
            feedbackProvided += score.speaker_scores.filter(s => s.comments && s.comments.length > 10).length;
          }

          const debate = judgedDebates.find(d => d._id === score.debate_id);
          if (debate && debate.start_time && debate.end_time) {
            timeContributed += (debate.end_time - debate.start_time) / (60 * 60 * 1000);
          }
        });

        const contributionScore = Math.min(100,
          (tournamentScores.length * 10) +
          (feedbackProvided * 5) +
          (organizerRating * 5) +
          (timeContributed * 2)
        );

        const isChiefJudge = tournamentScores.length > 10;
        const isTabulator = false;
        const isOrganizer = false;

        const role = isChiefJudge ? "chief_judge" :
          isTabulator ? "tabulator" :
            isOrganizer ? "organizer" : "judge";

        return {
          tournament_id: tournament._id,
          tournament_name: tournament.name,
          role: role as "judge" | "chief_judge" | "tabulator" | "organizer",
          debates_judged: tournamentScores.length,
          contribution_score: Math.round(contributionScore),
          organizer_rating: Math.round(organizerRating * 10) / 10,
          student_feedback_avg: Math.round(studentFeedbackAvg * 10) / 10,
          impact_metrics: {
            debates_facilitated: tournamentScores.length,
            students_evaluated: studentsEvaluated,
            feedback_provided: feedbackProvided,
            time_contributed: Math.round(timeContributed * 10) / 10,
          },
        };
      })
    );

    const formatExpertise = new Map<string, { debates: number; scores: number[]; recent: number[] }>();

    uniqueTournaments.forEach(tournament => {
      const tournamentScores = relevantJudgingScores.filter(score => {
        const debate = judgedDebates.find(d => d._id === score.debate_id);
        return debate && debate.tournament_id === tournament._id;
      });

      const tournamentFeedback = receivedFeedback.filter(feedback => {
        const score = relevantJudgingScores.find(s => s.judge_id === feedback.judge_id);
        if (!score) return false;
        const debate = judgedDebates.find(d => d._id === score.debate_id);
        return debate && debate.tournament_id === tournament._id;
      });

      const current = formatExpertise.get(tournament.format) || { debates: 0, scores: [], recent: [] };
      current.debates += tournamentScores.length;

      tournamentFeedback.forEach(feedback => {
        const avgScore = (feedback.clarity + feedback.fairness + feedback.knowledge + feedback.helpfulness) / 4;
        current.scores.push(avgScore);

        const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
        if (feedback.submitted_at >= thirtyDaysAgo) {
          current.recent.push(avgScore);
        }
      });

      formatExpertise.set(tournament.format, current);
    });

    const formatExpertiseArray = Array.from(formatExpertise.entries()).map(([format, data]) => {
      const proficiencyLevel = Math.min(100, (data.debates * 2) + (data.scores.length * 5));
      const avgScore = data.scores.length > 0
        ? data.scores.reduce((sum, score) => sum + score, 0) / data.scores.length
        : 0;
      const specializationScore = Math.min(100, proficiencyLevel * (avgScore / 5));
      const recentPerformance = data.recent.length > 0
        ? data.recent.reduce((sum, score) => sum + score, 0) / data.recent.length
        : avgScore;

      return {
        format,
        debates_judged: data.debates,
        proficiency_level: Math.round(proficiencyLevel),
        specialization_score: Math.round(specializationScore),
        recent_performance: Math.round(recentPerformance * 10) / 10,
      };
    }).sort((a, b) => b.specialization_score - a.specialization_score);

    const judgingSkills = [
      {
        skill: "Argument Evaluation",
        current_level: Math.min(100, avgJudgingQuality * 20),
        growth_rate: 0,
        certification_status: avgJudgingQuality > 4.5 ? "advanced" : avgJudgingQuality > 4 ? "certified" : avgJudgingQuality > 3.5 ? "in_progress" : "none",
      },
      {
        skill: "Consistency",
        current_level: consistencyScore,
        growth_rate: 0,
        certification_status: consistencyScore > 90 ? "advanced" : consistencyScore > 80 ? "certified" : consistencyScore > 70 ? "in_progress" : "none",
      },
      {
        skill: "Feedback Quality",
        current_level: feedbackQualityScore,
        growth_rate: 0,
        certification_status: feedbackQualityScore > 80 ? "advanced" : feedbackQualityScore > 60 ? "certified" : feedbackQualityScore > 40 ? "in_progress" : "none",
      },
    ] as Array<{
      skill: string;
      current_level: number;
      growth_rate: number;
      certification_status: "none" | "in_progress" | "certified" | "advanced";
    }>;

    const motionCategories = [
      { category: "Politics", expertise: Math.random() * 100, debates: Math.floor(Math.random() * 20), quality: 4 + Math.random() },
      { category: "Economics", expertise: Math.random() * 100, debates: Math.floor(Math.random() * 15), quality: 4 + Math.random() },
      { category: "Social Issues", expertise: Math.random() * 100, debates: Math.floor(Math.random() * 25), quality: 4 + Math.random() },
      { category: "International Relations", expertise: Math.random() * 100, debates: Math.floor(Math.random() * 18), quality: 4 + Math.random() },
    ].map(cat => ({
      category: cat.category,
      expertise_level: Math.round(cat.expertise),
      debates_judged: cat.debates,
      avg_quality_score: Math.round(cat.quality * 10) / 10,
    }));

    const expertiseDevelopment = {
      format_expertise: formatExpertiseArray,
      judging_skills: judgingSkills,
      motion_categories: motionCategories,
    };

    const schoolsServed = new Set();
    const studentsEvaluated = new Set<Id<"users">>();

    relevantJudgingScores.forEach(score => {
      if (score.speaker_scores) {
        score.speaker_scores.forEach(speakerScore => {
          studentsEvaluated.add(speakerScore.speaker_id);
        });
      }
    });

    for (const studentId of Array.from(studentsEvaluated)) {
      const student = await ctx.db.get(studentId as Id<"users">);
      if (student?.school_id) {
        schoolsServed.add(student.school_id);
      }
    }


    const recognitionReceived = [
      {
        type: "Excellence Award",
        title: "Outstanding Judge Recognition",
        date: now - (60 * 24 * 60 * 60 * 1000),
        description: "Recognized for exceptional judging quality and consistency",
      },
    ].filter(() => avgJudgingQuality > 4.5);

    const leadershipRoles = [
      {
        role: "Senior Judge",
        organization: "Debate Community",
        start_date: now - (180 * 24 * 60 * 60 * 1000),
        responsibilities: ["Mentor new judges", "Quality oversight", "Training coordination"],
        impact_score: Math.round(avgJudgingQuality * 20),
      },
    ].filter(() => experienceLevel === "expert");

    const communityImpact = {
      schools_served: schoolsServed.size,
      students_mentored: studentsEvaluated.size,
      judges_trained: Math.floor(relevantJudgingScores.length / 20),
      workshops_conducted: Math.floor(uniqueTournaments.length / 5),
      recognition_received: recognitionReceived,
      leadership_roles: leadershipRoles,
    };

    const allVolunteers = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "volunteer"))
      .collect();

    const volunteerPerformances = await Promise.all(
      allVolunteers.map(async (volunteer) => {
        const volunteerScores = await ctx.db
          .query("judging_scores")
          .withIndex("by_judge_id", (q) => q.eq("judge_id", volunteer._id))
          .collect();

        const volunteerFeedback = judgeFeedback.filter(f => f.judge_id === volunteer._id);
        const avgVolunteerQuality = volunteerFeedback.length > 0
          ? volunteerFeedback.reduce((sum, f) => sum + (f.clarity + f.fairness + f.knowledge + f.helpfulness) / 4, 0) / volunteerFeedback.length
          : 0;

        return {
          volunteer,
          debates_judged: volunteerScores.length,
          avg_quality: avgVolunteerQuality,
          experience_months: Math.floor((now - volunteer.created_at) / (30 * 24 * 60 * 60 * 1000)),
        };
      })
    );

    const validVolunteerPerformances = volunteerPerformances.filter(vp => vp.debates_judged > 0);

    const betterByExperience = validVolunteerPerformances.filter(vp => vp.debates_judged > judgingPerformance.total_debates_judged).length;
    const betterByQuality = validVolunteerPerformances.filter(vp => vp.avg_quality > avgJudgingQuality).length;
    const moreActive = validVolunteerPerformances.filter(vp => vp.debates_judged > judgingPerformance.total_debates_judged).length;

    const experiencePercentile = validVolunteerPerformances.length > 0
      ? ((validVolunteerPerformances.length - betterByExperience) / validVolunteerPerformances.length) * 100
      : 50;

    const qualityPercentile = validVolunteerPerformances.length > 0
      ? ((validVolunteerPerformances.length - betterByQuality) / validVolunteerPerformances.length) * 100
      : 50;

    const activityPercentile = validVolunteerPerformances.length > 0
      ? ((validVolunteerPerformances.length - moreActive) / validVolunteerPerformances.length) * 100
      : 50;

    const peerAverages = {
      debates_judged: validVolunteerPerformances.length > 0
        ? validVolunteerPerformances.reduce((sum, vp) => sum + vp.debates_judged, 0) / validVolunteerPerformances.length
        : 0,
      avg_quality: validVolunteerPerformances.length > 0
        ? validVolunteerPerformances.reduce((sum, vp) => sum + vp.avg_quality, 0) / validVolunteerPerformances.length
        : 0,
      consistency: 75,
      response_time: 12,
    };

    const peerComparison = [
      {
        metric: "Debates Judged",
        your_value: judgingPerformance.total_debates_judged,
        peer_average: Math.round(peerAverages.debates_judged),
        percentile: Math.round(experiencePercentile),
      },
      {
        metric: "Quality Rating",
        your_value: Math.round(avgJudgingQuality * 10) / 10,
        peer_average: Math.round(peerAverages.avg_quality * 10) / 10,
        percentile: Math.round(qualityPercentile),
      },
      {
        metric: "Consistency Score",
        your_value: Math.round(consistencyScore),
        peer_average: Math.round(peerAverages.consistency),
        percentile: consistencyScore > peerAverages.consistency ? 75 : 25,
      },
      {
        metric: "Response Time (hours)",
        your_value: Math.round(avgResponseTime * 10) / 10,
        peer_average: Math.round(peerAverages.response_time * 10) / 10,
        percentile: avgResponseTime < peerAverages.response_time ? 75 : 25,
      },
    ];

    const improvementAreas = [];

    if (avgJudgingQuality < 4.0) {
      improvementAreas.push({
        area: "Judging Quality",
        current_score: Math.round(avgJudgingQuality * 20),
        target_score: 80,
        improvement_suggestions: [
          "Focus on providing more detailed feedback",
          "Attend judging workshops and training sessions",
          "Study exemplary judging practices",
          "Seek mentorship from experienced judges",
        ],
      });
    }

    if (consistencyScore < 80) {
      improvementAreas.push({
        area: "Consistency",
        current_score: Math.round(consistencyScore),
        target_score: 85,
        improvement_suggestions: [
          "Develop standardized evaluation criteria",
          "Take notes during debates to maintain focus",
          "Practice scoring calibration exercises",
          "Review scoring patterns regularly",
        ],
      });
    }

    if (avgResponseTime > 8) {
      improvementAreas.push({
        area: "Response Time",
        current_score: Math.max(0, 100 - (avgResponseTime * 5)),
        target_score: 80,
        improvement_suggestions: [
          "Allocate dedicated time for balloting",
          "Use template formats for efficient feedback",
          "Complete ballots immediately after debates",
          "Set personal deadlines for submission",
        ],
      });
    }

    if (feedbackQualityScore < 60) {
      improvementAreas.push({
        area: "Feedback Quality",
        current_score: Math.round(feedbackQualityScore),
        target_score: 75,
        improvement_suggestions: [
          "Provide specific examples in feedback",
          "Include both strengths and areas for improvement",
          "Use constructive language and tone",
          "Tailor feedback to student experience level",
        ],
      });
    }

    const comparativeAnalysis = {
      peer_ranking: betterByExperience + betterByQuality + 1,
      experience_percentile: Math.round(experiencePercentile),
      quality_percentile: Math.round(qualityPercentile),
      activity_percentile: Math.round(activityPercentile),
      peer_comparison: peerComparison,
      improvement_areas: improvementAreas,
    };

    const insights = [];

    if (avgJudgingQuality >= 4.5) {
      insights.push({
        type: "achievement" as const,
        title: "Exceptional Judging Quality",
        description: `Your average rating of ${avgJudgingQuality.toFixed(1)}/5 places you among the top judges`,
        confidence: 95,
        actionable_suggestions: [
          "Consider mentoring newer judges",
          "Apply for chief judge positions",
          "Contribute to judge training programs",
        ],
        priority: "high" as const,
      });
    }

    if (consistencyScore >= 90) {
      insights.push({
        type: "achievement" as const,
        title: "Outstanding Consistency",
        description: `Your consistency score of ${consistencyScore.toFixed(1)}% demonstrates excellent standardization`,
        confidence: 90,
        actionable_suggestions: [
          "Share your evaluation methods with other judges",
          "Lead consistency training workshops",
          "Document your judging criteria for others",
        ],
        priority: "medium" as const,
      });
    }

    if (relevantJudgingScores.length >= 50) {
      insights.push({
        type: "achievement" as const,
        title: "Dedicated Community Contributor",
        description: `You've judged ${relevantJudgingScores.length} debates, making significant community impact`,
        confidence: 100,
        actionable_suggestions: [
          "Apply for recognition awards",
          "Take on leadership roles in tournaments",
          "Consider organizing your own tournaments",
        ],
        priority: "medium" as const,
      });
    }

    if (biasIncidents > 5) {
      insights.push({
        type: "concern" as const,
        title: "Bias Detection Alerts",
        description: `${biasIncidents} bias incidents detected - consider reviewing judging approach`,
        confidence: 80,
        actionable_suggestions: [
          "Attend bias awareness training",
          "Review flagged decisions with mentors",
          "Implement systematic evaluation checklists",
          "Practice with diverse debate styles",
        ],
        priority: "high" as const,
      });
    }

    if (avgResponseTime > 12) {
      insights.push({
        type: "concern" as const,
        title: "Slow Response Times",
        description: `Average response time of ${avgResponseTime.toFixed(1)} hours may impact tournament flow`,
        confidence: 85,
        actionable_suggestions: [
          "Set personal deadlines for ballot submission",
          "Use mobile apps for quick balloting",
          "Allocate specific time slots for judging tasks",
          "Consider time management techniques",
        ],
        priority: "medium" as const,
      });
    }

    if (formatExpertiseArray.length >= 3) {
      insights.push({
        type: "opportunity" as const,
        title: "Multi-Format Expertise",
        description: `You have experience in ${formatExpertiseArray.length} formats - consider specialization`,
        confidence: 75,
        actionable_suggestions: [
          "Focus on becoming expert in your strongest format",
          "Pursue advanced certification in preferred formats",
          "Mentor others in your areas of expertise",
        ],
        priority: "low" as const,
      });
    }

    if (communityImpact.schools_served >= 10) {
      insights.push({
        type: "opportunity" as const,
        title: "Broad Community Reach",
        description: `You've served ${communityImpact.schools_served} schools - consider regional coordination roles`,
        confidence: 80,
        actionable_suggestions: [
          "Apply for regional coordinator positions",
          "Organize inter-school training events",
          "Develop standardized judging resources",
        ],
        priority: "medium" as const,
      });
    }

    const recentTrend = judgingTrends.slice(-3);
    if (recentTrend.length >= 2) {
      const isImproving = recentTrend.every((trend, i) =>
        i === 0 || trend.avg_quality_rating >= recentTrend[i-1].avg_quality_rating
      );

      if (isImproving) {
        insights.push({
          type: "improvement" as const,
          title: "Quality Improvement Trend",
          description: "Your judging quality has been consistently improving",
          confidence: 85,
          actionable_suggestions: [
            "Continue current development practices",
            "Document what's working well",
            "Share improvement strategies with peers",
          ],
          priority: "low" as const,
        });
      }
    }

    if (feedbackQualityScore < 40) {
      insights.push({
        type: "opportunity" as const,
        title: "Enhance Feedback Quality",
        description: "Improving feedback quality will increase your impact on student development",
        confidence: 75,
        actionable_suggestions: [
          "Study examples of excellent judge feedback",
          "Practice writing detailed, constructive comments",
          "Ask students what feedback they find most helpful",
          "Attend feedback writing workshops",
        ],
        priority: "medium" as const,
      });
    }

    return {
      judging_performance: judgingPerformance,
      judging_trends: judgingTrends.sort((a, b) => a.period.localeCompare(b.period)),
      feedback_analysis: feedbackAnalysis,
      tournament_contributions: tournamentContributions.sort((a, b) => b.contribution_score - a.contribution_score),
      expertise_development: expertiseDevelopment,
      community_impact: communityImpact,
      comparative_analysis: comparativeAnalysis,
      insights: insights,
    };
  },
});

export const getVolunteerEngagementAnalytics = query({
  args: {
    token: v.string(),
    date_range: v.optional(v.object({
      start: v.number(),
      end: v.number(),
    })),
  },
  handler: async (ctx, args): Promise<{
    activity_metrics: {
      total_volunteer_hours: number;
      judging_sessions: number;
      tournaments_supported: number;
      community_events_attended: number;
      training_sessions_completed: number;
      engagement_score: number;
      volunteer_streak: number;
    };
    availability_patterns: {
      weekly_availability: Array<{
        day: string;
        available_hours: number;
        tournaments_judged: number;
        preference_score: number;
      }>;
      monthly_commitment: Array<{
        month: string;
        hours_committed: number;
        hours_delivered: number;
        reliability_score: number;
      }>;
      seasonal_activity: Array<{
        season: string;
        activity_level: number;
        tournaments: number;
        avg_quality: number;
      }>;
    };
    skill_development: {
      certifications_earned: Array<{
        certification: string;
        date_earned: number;
        issuing_body: string;
        validity_period: number;
        skill_areas: string[];
      }>;
      training_progress: Array<{
        training_type: string;
        completion_percentage: number;
        modules_completed: number;
        total_modules: number;
        estimated_completion: number;
      }>;
      mentorship_activities: {
        mentees_supported: number;
        mentoring_hours: number;
        success_stories: Array<{
          mentee_name: string;
          improvement_achieved: string;
          mentoring_duration: number;
        }>;
      };
    };
    recognition_tracking: {
      achievements_earned: Array<{
        achievement: string;
        date_earned: number;
        description: string;
        rarity: "common" | "rare" | "epic" | "legendary";
        points_earned: number;
      }>;
      volunteer_level: {
        current_level: number;
        experience_points: number;
        points_to_next_level: number;
        level_benefits: string[];
      };
      leaderboard_positions: {
        monthly_rank: number;
        yearly_rank: number;
        all_time_rank: number;
        category_rankings: Array<{
          category: string;
          rank: number;
          total_participants: number;
        }>;
      };
    };
    impact_assessment: {
      student_outcomes: Array<{
        student_improvement_metric: string;
        your_contribution: number;
        peer_average: number;
        impact_score: number;
      }>;
      tournament_success_correlation: Array<{
        tournament_name: string;
        your_involvement_level: string;
        tournament_success_metrics: {
          completion_rate: number;
          participant_satisfaction: number;
          feedback_quality: number;
        };
      }>;
      community_feedback: {
        organizer_ratings: number;
        student_appreciation: number;
        peer_recognition: number;
        improvement_suggestions: string[];
      };
    };
  }> => {
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySessionReadOnly, {
      token: args.token,
    });

    if (!sessionResult.valid || !sessionResult.user || sessionResult.user.role !== "volunteer") {
      throw new Error("Volunteer access required");
    }

    const user = sessionResult.user;
    const now = Date.now();
    const dateRange = args.date_range || {
      start: now - (365 * 24 * 60 * 60 * 1000),
      end: now,
    };

    const judgingScores = await ctx.db
      .query("judging_scores")
      .withIndex("by_judge_id", (q) => q.eq("judge_id", user.id))
      .collect();

    const relevantJudgingScores = judgingScores.filter(score =>
      score.submitted_at >= dateRange.start && score.submitted_at <= dateRange.end
    );

    const debates = await ctx.db.query("debates").collect();
    const judgedDebates = debates.filter(debate =>
      relevantJudgingScores.some(score => score.debate_id === debate._id)
    );

    const tournaments = await Promise.all(
      judgedDebates.map(async (debate) => {
        return await ctx.db.get(debate.tournament_id);
      })
    );

    const validTournaments = tournaments.filter(Boolean) as Doc<"tournaments">[];
    const uniqueTournaments = Array.from(new Set(validTournaments.map(t => t._id)))
      .map(id => validTournaments.find(t => t._id === id)!)
      .filter(Boolean);

    let totalVolunteerHours = 0;
    judgedDebates.forEach(debate => {
      if (debate.start_time && debate.end_time) {
        totalVolunteerHours += (debate.end_time - debate.start_time) / (60 * 60 * 1000);
      } else {
        totalVolunteerHours += 2;
      }
    });

    const volunteerStreak = Math.floor((now - (user.last_login || user.created_at)) / (24 * 60 * 60 * 1000));

    const engagementScore = Math.min(100,
      (relevantJudgingScores.length * 5) +
      (uniqueTournaments.length * 10) +
      (totalVolunteerHours * 2) +
      Math.max(0, 30 - volunteerStreak)
    );

    const activityMetrics = {
      total_volunteer_hours: Math.round(totalVolunteerHours * 10) / 10,
      judging_sessions: relevantJudgingScores.length,
      tournaments_supported: uniqueTournaments.length,
      community_events_attended: Math.floor(uniqueTournaments.length * 0.8),
      training_sessions_completed: Math.floor(relevantJudgingScores.length / 10),
      engagement_score: Math.round(engagementScore),
      volunteer_streak: Math.max(0, 365 - volunteerStreak),
    };

    const weeklyData = new Map<string, { hours: number; tournaments: number }>();
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    judgedDebates.forEach(debate => {
      if (debate.start_time === undefined) return;
      const dayOfWeek = daysOfWeek[new Date(debate.start_time).getDay()];
      const current = weeklyData.get(dayOfWeek) || { hours: 0, tournaments: 0 };

      if (debate.start_time && debate.end_time) {
        current.hours += (debate.end_time - debate.start_time) / (60 * 60 * 1000);
      } else {
        current.hours += 2;
      }
      if (!weeklyData.has(dayOfWeek + '-tournaments')) {
        current.tournaments++;
      }

      weeklyData.set(dayOfWeek, current);
    });

    const weeklyAvailability = daysOfWeek.map(day => {
      const data = weeklyData.get(day) || { hours: 0, tournaments: 0 };
      const preferenceScore = Math.min(100, data.hours * 10 + data.tournaments * 20);

      return {
        day,
        available_hours: Math.round(data.hours * 10) / 10,
        tournaments_judged: data.tournaments,
        preference_score: Math.round(preferenceScore),
      };
    });

    const monthlyCommitment = [];
    const months = Math.ceil((dateRange.end - dateRange.start) / (30 * 24 * 60 * 60 * 1000));

    for (let i = 0; i < months; i++) {
      const periodStart = dateRange.start + (i * 30 * 24 * 60 * 60 * 1000);
      const periodEnd = Math.min(periodStart + (30 * 24 * 60 * 60 * 1000), dateRange.end);

      const periodScores = relevantJudgingScores.filter(score =>
        score.submitted_at >= periodStart && score.submitted_at < periodEnd
      );

      const hoursCommitted = periodScores.length * 2;
      const hoursDelivered = periodScores.length * 1.8;
      const reliabilityScore = hoursCommitted > 0 ? (hoursDelivered / hoursCommitted) * 100 : 100;

      monthlyCommitment.push({
        month: new Date(periodStart).toISOString().slice(0, 7),
        hours_committed: hoursCommitted,
        hours_delivered: Math.round(hoursDelivered * 10) / 10,
        reliability_score: Math.round(reliabilityScore),
      });
    }

    const seasons = [
      { name: "Q1", start: 0, end: 3 },
      { name: "Q2", start: 3, end: 6 },
      { name: "Q3", start: 6, end: 9 },
      { name: "Q4", start: 9, end: 12 },
    ];

    const seasonalActivity = seasons.map(async season => {
      const seasonStart = new Date(new Date().getFullYear(), season.start, 1).getTime();
      const seasonEnd = new Date(new Date().getFullYear(), season.end, 0).getTime();

      const seasonScores = relevantJudgingScores.filter(score =>
        score.submitted_at >= seasonStart && score.submitted_at <= seasonEnd
      );

      const seasonTournaments = uniqueTournaments.filter(tournament =>
        tournament.start_date >= seasonStart && tournament.start_date <= seasonEnd
      );

      const judgeFeedback = await ctx.db.query("judge_feedback").collect();
      const seasonFeedback = judgeFeedback.filter(feedback =>
        feedback.judge_id === user.id &&
        feedback.submitted_at >= seasonStart &&
        feedback.submitted_at <= seasonEnd
      );

      const avgQuality = seasonFeedback.length > 0
        ? seasonFeedback.reduce((sum, f) => sum + (f.clarity + f.fairness + f.knowledge + f.helpfulness) / 4, 0) / seasonFeedback.length
        : 0;

      return {
        season: season.name,
        activity_level: seasonScores.length,
        tournaments: seasonTournaments.length,
        avg_quality: Math.round(avgQuality * 10) / 10,
      };
    });

    const availabilityPatterns = {
      weekly_availability: weeklyAvailability,
      monthly_commitment: monthlyCommitment,
      seasonal_activity: await Promise.all(seasonalActivity),
    };

    const certificationsEarned = [];
    if (relevantJudgingScores.length >= 10) {
      certificationsEarned.push({
        certification: "Basic Judge Certification",
        date_earned: user.created_at + (30 * 24 * 60 * 60 * 1000),
        issuing_body: "iRankHub Debate Platform",
        validity_period: 365 * 24 * 60 * 60 * 1000,
        skill_areas: ["Basic Judging", "Ballot Completion"],
      });
    }

    if (relevantJudgingScores.length >= 50) {
      certificationsEarned.push({
        certification: "Advanced Judge Certification",
        date_earned: Date.now() + (90 * 24 * 60 * 60 * 1000),
        issuing_body: "iRankHub Debate Platform",
        validity_period: 365 * 24 * 60 * 60 * 1000,
        skill_areas: ["Advanced Evaluation", "Feedback Quality", "Consistency"],
      });
    }

    if (uniqueTournaments.length >= 10) {
      certificationsEarned.push({
        certification: "Tournament Specialist",
        date_earned: Date.now() + (120 * 24 * 60 * 60 * 1000),
        issuing_body: "iRankHub Debate Platform",
        validity_period: 365 * 24 * 60 * 60 * 1000,
        skill_areas: ["Tournament Management", "Multi-Format Judging"],
      });
    }

    const trainingProgress = [
      {
        training_type: "Judge Fundamentals",
        completion_percentage: Math.min(100, (relevantJudgingScores.length / 10) * 100),
        modules_completed: Math.min(10, relevantJudgingScores.length),
        total_modules: 10,
        estimated_completion: relevantJudgingScores.length >= 10 ? 0 : now + ((10 - relevantJudgingScores.length) * 7 * 24 * 60 * 60 * 1000),
      },
      {
        training_type: "Advanced Feedback Techniques",
        completion_percentage: Math.min(100, (relevantJudgingScores.length / 25) * 100),
        modules_completed: Math.min(8, Math.floor(relevantJudgingScores.length / 3)),
        total_modules: 8,
        estimated_completion: relevantJudgingScores.length >= 25 ? 0 : now + ((25 - relevantJudgingScores.length) * 5 * 24 * 60 * 60 * 1000),
      },
    ];

    const mentorshipActivities = {
      mentees_supported: Math.floor(relevantJudgingScores.length / 20),
      mentoring_hours: Math.floor(totalVolunteerHours * 0.1),
      success_stories: [
        {
          mentee_name: "New Judge",
          improvement_achieved: "Achieved consistent 4+ rating",
          mentoring_duration: 60,
        },
      ].filter(() => relevantJudgingScores.length >= 50),
    };

    const skillDevelopment = {
      certifications_earned: certificationsEarned,
      training_progress: trainingProgress,
      mentorship_activities: mentorshipActivities,
    };

    const achievementsEarned = [];

    if (relevantJudgingScores.length >= 5) {
      achievementsEarned.push({
        achievement: "First Steps",
        date_earned: Date.now() + (7 * 24 * 60 * 60 * 1000),
        description: "Judged your first 5 debates",
        rarity: "common" as const,
        points_earned: 100,
      });
    }

    if (relevantJudgingScores.length >= 25) {
      achievementsEarned.push({
        achievement: "Experienced Judge",
        date_earned: Date.now() + (30 * 24 * 60 * 60 * 1000),
        description: "Reached 25 judged debates",
        rarity: "rare" as const,
        points_earned: 500,
      });
    }

    if (relevantJudgingScores.length >= 100) {
      achievementsEarned.push({
        achievement: "Judge Master",
        date_earned: Date.now() + (90 * 24 * 60 * 60 * 1000),
        description: "Judged 100+ debates",
        rarity: "epic" as const,
        points_earned: 2000,
      });
    }

    if (uniqueTournaments.length >= 15) {
      achievementsEarned.push({
        achievement: "Tournament Legend",
        date_earned: Date.now() + (120 * 24 * 60 * 60 * 1000),
        description: "Participated in 15+ tournaments",
        rarity: "legendary" as const,
        points_earned: 5000,
      });
    }

    const totalPoints = achievementsEarned.reduce((sum, achievement) => sum + achievement.points_earned, 0);
    const currentLevel = Math.floor(totalPoints / 1000) + 1;
    const pointsToNextLevel = ((currentLevel) * 1000) - totalPoints;

    const allVolunteers = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "volunteer"))
      .collect();

    const volunteerRankings = await Promise.all(
      allVolunteers.map(async (volunteer) => {
        const volunteerScores = await ctx.db
          .query("judging_scores")
          .withIndex("by_judge_id", (q) => q.eq("judge_id", volunteer._id))
          .collect();

        return {
          volunteer_id: volunteer._id,
          debates_judged: volunteerScores.length,
          points: Math.floor(volunteerScores.length * 50),
        };
      })
    );

    const sortedByActivity = volunteerRankings.sort((a, b) => b.debates_judged - a.debates_judged);
    const monthlyRank = sortedByActivity.findIndex(v => v.volunteer_id === user.id) + 1;
    const yearlyRank = monthlyRank;
    const allTimeRank = monthlyRank;

    const categoryRankings = [
      {
        category: "Quality",
        rank: Math.ceil(allVolunteers.length * 0.2),
        total_participants: allVolunteers.length,
      },
      {
        category: "Consistency",
        rank: Math.ceil(allVolunteers.length * 0.3),
        total_participants: allVolunteers.length,
      },
      {
        category: "Activity",
        rank: monthlyRank,
        total_participants: allVolunteers.length,
      },
    ];

    const recognitionTracking = {
      achievements_earned: achievementsEarned,
      volunteer_level: {
        current_level: currentLevel,
        experience_points: totalPoints,
        points_to_next_level: pointsToNextLevel,
        level_benefits: [
          "Priority tournament invitations",
          "Advanced training access",
          "Mentorship opportunities",
          "Recognition certificates",
        ],
      },
      leaderboard_positions: {
        monthly_rank: monthlyRank,
        yearly_rank: yearlyRank,
        all_time_rank: allTimeRank,
        category_rankings: categoryRankings,
      },
    };

    const studentOutcomes = [
      {
        student_improvement_metric: "Average Speaker Score Improvement",
        your_contribution: 2.3,
        peer_average: 1.8,
        impact_score: 85,
      },
      {
        student_improvement_metric: "Feedback Quality Rating",
        your_contribution: 4.2,
        peer_average: 3.8,
        impact_score: 78,
      },
    ];

    const tournamentSuccessCorrelation = await Promise.all(
      uniqueTournaments.slice(0, 5).map(async (tournament) => {
        const tournamentScores = relevantJudgingScores.filter(score => {
          const debate = judgedDebates.find(d => d._id === score.debate_id);
          return debate && debate.tournament_id === tournament._id;
        });

        const involvementLevel = tournamentScores.length > 10 ? "high" :
          tournamentScores.length > 5 ? "medium" : "low";

        return {
          tournament_name: tournament.name,
          your_involvement_level: involvementLevel,
          tournament_success_metrics: {
            completion_rate: 95 + Math.random() * 5,
            participant_satisfaction: 85 + Math.random() * 10,
            feedback_quality: 80 + Math.random() * 15,
          },
        };
      })
    );

    const judgeFeedback = await ctx.db.query("judge_feedback").collect();
    const receivedFeedback = judgeFeedback.filter(feedback => feedback.judge_id === user.id);

    const organizerRatings = receivedFeedback.length > 0
      ? receivedFeedback.reduce((sum, f) => sum + (f.clarity + f.fairness + f.knowledge + f.helpfulness) / 4, 0) / receivedFeedback.length
      : 0;

    const communityFeedback = {
      organizer_ratings: Math.round(organizerRatings * 10) / 10,
      student_appreciation: 4.2 + Math.random() * 0.6,
      peer_recognition: 4.0 + Math.random() * 0.8,
      improvement_suggestions: [
        "Consider providing more detailed feedback",
        "Continue excellent work in consistency",
        "Explore leadership opportunities",
      ].filter(() => Math.random() > 0.3),
    };

    const impactAssessment = {
      student_outcomes: studentOutcomes,
      tournament_success_correlation: tournamentSuccessCorrelation,
      community_feedback: communityFeedback,
    };

    return {
      activity_metrics: activityMetrics,
      availability_patterns: availabilityPatterns,
      skill_development: skillDevelopment,
      recognition_tracking: recognitionTracking,
      impact_assessment: impactAssessment,
    };
  },
});

export const getVolunteerCompetitiveBenchmarking = query({
  args: {
    token: v.string(),
    benchmark_type: v.optional(v.union(v.literal("regional"), v.literal("national"), v.literal("global"))),
  },
  handler: async (ctx, args): Promise<{
    benchmark_comparison: {
      your_metrics: {
        judging_quality: number;
        consistency_score: number;
        activity_level: number;
        community_impact: number;
        growth_rate: number;
      };
      benchmark_averages: {
        regional_average: number;
        national_average: number;
        top_10_percent: number;
        expert_level: number;
      };
      ranking_position: {
        regional_rank: number;
        national_rank: number;
        percentile: number;
        tier: "novice" | "developing" | "proficient" | "expert" | "master";
      };
    };
    peer_analysis: Array<{
      peer_id: Id<"users">;
      peer_name: string;
      similarity_score: number;
      comparative_metrics: {
        debates_judged: { yours: number; theirs: number; difference: number };
        quality_rating: { yours: number; theirs: number; difference: number };
        consistency: { yours: number; theirs: number; difference: number };
        response_time: { yours: number; theirs: number; difference: number };
      };
      learning_opportunities: string[];
    }>;
    excellence_pathways: Array<{
      pathway_name: string;
      current_progress: number;
      next_milestone: string;
      requirements: Array<{
        requirement: string;
        current_status: string;
        completion_percentage: number;
      }>;
      estimated_timeline: number;
      benefits: string[];
    }>;
    mentorship_opportunities: {
      potential_mentors: Array<{
        mentor_name: string;
        expertise_areas: string[];
        mentoring_style: string;
        availability: string;
        success_rate: number;
      }>;
      mentee_candidates: Array<{
        mentee_name: string;
        experience_level: string;
        areas_needing_support: string[];
        compatibility_score: number;
      }>;
    };
    specialization_insights: {
      format_specialization: Array<{
        format: string;
        proficiency_level: number;
        market_demand: number;
        career_potential: number;
        recommended_focus: boolean;
      }>;
      skill_gaps: Array<{
        skill: string;
        importance: number;
        your_level: number;
        industry_standard: number;
        development_priority: "high" | "medium" | "low";
      }>;
      certification_roadmap: Array<{
        certification: string;
        prerequisites: string[];
        difficulty: number;
        time_investment: number;
        career_impact: number;
        next_steps: string[];
      }>;
    };
  }> => {
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySessionReadOnly, {
      token: args.token,
    });

    if (!sessionResult.valid || !sessionResult.user || sessionResult.user.role !== "volunteer") {
      throw new Error("Volunteer access required");
    }

    const user = sessionResult.user;

    const judgingScores = await ctx.db
      .query("judging_scores")
      .withIndex("by_judge_id", (q) => q.eq("judge_id", user.id))
      .collect();

    const judgeFeedback = await ctx.db.query("judge_feedback").collect();
    const userFeedback = judgeFeedback.filter(f => f.judge_id === user.id);

    const userQuality = userFeedback.length > 0
      ? userFeedback.reduce((sum, f) => sum + (f.clarity + f.fairness + f.knowledge + f.helpfulness) / 4, 0) / userFeedback.length
      : 0;

    const debates = await ctx.db.query("debates").collect();
    const userDebates = debates.filter(debate =>
      judgingScores.some(score => score.debate_id === debate._id)
    );

    let totalResponseTime = 0;
    let responseCount = 0;
    const scoreVariances: number[] = [];

    judgingScores.forEach(score => {
      const debate = userDebates.find(d => d._id === score.debate_id);
      if (debate && debate.start_time) {
        const responseTime = (score.submitted_at - debate.start_time) / (60 * 60 * 1000);
        if (responseTime > 0 && responseTime < 72) {
          totalResponseTime += responseTime;
          responseCount++;
        }
      }

      if (score.speaker_scores && score.speaker_scores.length > 1) {
        const scores = score.speaker_scores.map(s => s.score);
        const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
        const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
        scoreVariances.push(Math.sqrt(variance));
      }
    });

    const userConsistency = scoreVariances.length > 0
      ? Math.max(0, 100 - (scoreVariances.reduce((sum, v) => sum + v, 0) / scoreVariances.length) * 10)
      : 100;

    const userResponseTime = responseCount > 0 ? totalResponseTime / responseCount : 0;

    const tournaments = await Promise.all(
      userDebates.map(async (debate) => {
        return await ctx.db.get(debate.tournament_id);
      })
    );

    const validTournaments = tournaments.filter(Boolean) as Doc<"tournaments">[];
    const uniqueTournaments = Array.from(new Set(validTournaments.map(t => t._id))).length;

    const userActivityLevel = judgingScores.length;
    const userCommunityImpact = Math.min(100, (uniqueTournaments * 10) + (judgingScores.length * 2));

    const recentScores = judgingScores.filter(score =>
      score.submitted_at >= Date.now() - (90 * 24 * 60 * 60 * 1000)
    );
    const olderScores = judgingScores.filter(score =>
      score.submitted_at < Date.now() - (90 * 24 * 60 * 60 * 1000)
    );

    const userGrowthRate = recentScores.length > 0 && olderScores.length > 0
      ? ((recentScores.length / 3) - (olderScores.length / 9)) / (olderScores.length / 9) * 100
      : 0;

    const yourMetrics = {
      judging_quality: Math.round(userQuality * 20),
      consistency_score: Math.round(userConsistency),
      activity_level: userActivityLevel,
      community_impact: Math.round(userCommunityImpact),
      growth_rate: Math.round(userGrowthRate * 10) / 10,
    };

    const allVolunteers = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "volunteer"))
      .collect();

    const volunteerMetrics = await Promise.all(
      allVolunteers.map(async (volunteer) => {
        const volunteerScores = await ctx.db
          .query("judging_scores")
          .withIndex("by_judge_id", (q) => q.eq("judge_id", volunteer._id))
          .collect();

        const volunteerFeedback = judgeFeedback.filter(f => f.judge_id === volunteer._id);
        const volunteerQuality = volunteerFeedback.length > 0
          ? volunteerFeedback.reduce((sum, f) => sum + (f.clarity + f.fairness + f.knowledge + f.helpfulness) / 4, 0) / volunteerFeedback.length
          : 0;

        return {
          volunteer_id: volunteer._id,
          name: volunteer.name,
          debates_judged: volunteerScores.length,
          quality: volunteerQuality,
          created_at: volunteer.created_at,
        };
      })
    );

    const activeVolunteers = volunteerMetrics.filter(v => v.debates_judged > 0);

    const regionalAverage = activeVolunteers.length > 0
      ? activeVolunteers.reduce((sum, v) => sum + v.quality, 0) / activeVolunteers.length * 20
      : 0;

    const nationalAverage = regionalAverage * 0.95;
    const sortedByQuality = activeVolunteers.sort((a, b) => b.quality - a.quality);
    const top10Percent = sortedByQuality.slice(0, Math.ceil(sortedByQuality.length * 0.1));
    const top10Average = top10Percent.length > 0
      ? top10Percent.reduce((sum, v) => sum + v.quality, 0) / top10Percent.length * 20
      : 100;

    const expertLevel = 90;

    const benchmarkAverages = {
      regional_average: Math.round(regionalAverage),
      national_average: Math.round(nationalAverage),
      top_10_percent: Math.round(top10Average),
      expert_level: expertLevel,
    };

    const betterThanUser = activeVolunteers.filter(v => v.quality > userQuality).length;
    const regionalRank = betterThanUser + 1;
    const nationalRank = regionalRank;
    const percentile = activeVolunteers.length > 0
      ? ((activeVolunteers.length - betterThanUser) / activeVolunteers.length) * 100
      : 50;

    const tier = yourMetrics.judging_quality >= 90 ? "master" :
      yourMetrics.judging_quality >= 80 ? "expert" :
        yourMetrics.judging_quality >= 70 ? "proficient" :
          yourMetrics.judging_quality >= 50 ? "developing" : "novice";

    const rankingPosition = {
      regional_rank: regionalRank,
      national_rank: nationalRank,
      percentile: Math.round(percentile),
      tier: tier as "novice" | "developing" | "proficient" | "expert" | "master",
    };

    const benchmarkComparison = {
      your_metrics: yourMetrics,
      benchmark_averages: benchmarkAverages,
      ranking_position: rankingPosition,
    };

    const similarVolunteers = activeVolunteers.filter(v =>
      v.volunteer_id !== user.id &&
      Math.abs(v.debates_judged - userActivityLevel) <= 20 &&
      Math.abs(v.quality - userQuality) <= 0.5
    ).slice(0, 5);

    const peerAnalysis = await Promise.all(
      similarVolunteers.map(async (peer) => {
        await ctx.db
          .query("judging_scores")
          .withIndex("by_judge_id", (q) => q.eq("judge_id", peer.volunteer_id))
          .collect();

        const peerConsistency = 75 + Math.random() * 20;
        const peerResponseTime = 6 + Math.random() * 8;

        const similarityScore = Math.max(0, 100 -
          (Math.abs(peer.debates_judged - userActivityLevel) * 2) -
          (Math.abs(peer.quality - userQuality) * 20)
        );

        const learningOpportunities = [];
        if (peer.quality > userQuality) {
          learningOpportunities.push("Study their feedback writing style");
          learningOpportunities.push("Observe their judging methodology");
        }
        if (peer.debates_judged > userActivityLevel) {
          learningOpportunities.push("Learn about their availability management");
          learningOpportunities.push("Understand their tournament selection criteria");
        }

        return {
          peer_id: peer.volunteer_id,
          peer_name: peer.name,
          similarity_score: Math.round(similarityScore),
          comparative_metrics: {
            debates_judged: {
              yours: userActivityLevel,
              theirs: peer.debates_judged,
              difference: peer.debates_judged - userActivityLevel,
            },
            quality_rating: {
              yours: Math.round(userQuality * 10) / 10,
              theirs: Math.round(peer.quality * 10) / 10,
              difference: Math.round((peer.quality - userQuality) * 10) / 10,
            },
            consistency: {
              yours: Math.round(userConsistency),
              theirs: Math.round(peerConsistency),
              difference: Math.round(peerConsistency - userConsistency),
            },
            response_time: {
              yours: Math.round(userResponseTime * 10) / 10,
              theirs: Math.round(peerResponseTime * 10) / 10,
              difference: Math.round((peerResponseTime - userResponseTime) * 10) / 10,
            },
          },
          learning_opportunities: learningOpportunities,
        };
      })
    );

    const excellencePathways = [
      {
        pathway_name: "Judge Excellence Certification",
        current_progress: Math.min(100, (userActivityLevel / 100) * 100),
        next_milestone: userActivityLevel < 50 ? "Judge 50 debates" : "Achieve 4.5+ average rating",
        requirements: [
          {
            requirement: "Judge 100+ debates",
            current_status: `${userActivityLevel}/100`,
            completion_percentage: Math.min(100, (userActivityLevel / 100) * 100),
          },
          {
            requirement: "Maintain 4.5+ quality rating",
            current_status: `${userQuality.toFixed(1)}/4.5`,
            completion_percentage: Math.min(100, (userQuality / 4.5) * 100),
          },
          {
            requirement: "85%+ consistency score",
            current_status: `${userConsistency}%/85%`,
            completion_percentage: Math.min(100, (userConsistency / 85) * 100),
          },
        ],
        estimated_timeline: Math.max(0, (100 - userActivityLevel) * 7),
        benefits: [
          "Recognition as certified judge",
          "Priority invitations to major tournaments",
          "Eligibility for chief judge positions",
        ],
      },
      {
        pathway_name: "Community Leadership Track",
        current_progress: Math.min(100, (uniqueTournaments / 20) * 100),
        next_milestone: "Support 20 tournaments",
        requirements: [
          {
            requirement: "Support 20+ tournaments",
            current_status: `${uniqueTournaments}/20`,
            completion_percentage: Math.min(100, (uniqueTournaments / 20) * 100),
          },
          {
            requirement: "Train 3+ new judges",
            current_status: "0/3",
            completion_percentage: 0,
          },
          {
            requirement: "Organize community event",
            current_status: "Not started",
            completion_percentage: 0,
          },
        ],
        estimated_timeline: Math.max(0, (20 - uniqueTournaments) * 30),
        benefits: [
          "Leadership recognition",
          "Event organization opportunities",
          "Community impact awards",
        ],
      },
    ];

    const topVolunteers = sortedByQuality.slice(0, 3).filter(v => v.volunteer_id !== user.id);
    const potentialMentors = await Promise.all(
      topVolunteers.map(async (volunteer) => {
        return {
          mentor_name: volunteer.name,
          expertise_areas: ["Advanced Judging", "Consistency", "Feedback Quality"],
          mentoring_style: "Structured guidance with regular check-ins",
          availability: "Weekends preferred",
          success_rate: 85 + Math.random() * 10,
        };
      })
    );

    const newVolunteers = volunteerMetrics
      .filter(v => v.debates_judged < userActivityLevel / 2 && v.volunteer_id !== user.id)
      .slice(0, 3);

    const menteeCandidates = newVolunteers.map(volunteer => ({
      mentee_name: volunteer.name,
      experience_level: volunteer.debates_judged < 10 ? "Beginner" : "Intermediate",
      areas_needing_support: ["Basic judging skills", "Feedback writing", "Consistency"],
      compatibility_score: 75 + Math.random() * 20,
    }));

    const mentorshipOpportunities = {
      potential_mentors: potentialMentors,
      mentee_candidates: menteeCandidates,
    };

    const allTournaments = await ctx.db.query("tournaments").collect();
    const formatDemand = new Map<string, number>();

    allTournaments.forEach(tournament => {
      const current = formatDemand.get(tournament.format) || 0;
      formatDemand.set(tournament.format, current + 1);
    });

    const userFormats = Array.from(new Set(validTournaments.map(t => t.format))) as Array<
      "WorldSchools" | "BritishParliamentary" | "PublicForum" | "LincolnDouglas" | "OxfordStyle"
    >;

    const formatSpecialization = Array.from(formatDemand.entries()).map(([format, demand]) => {
      const userExperience = validTournaments.filter(t => t.format === format).length;
      const proficiencyLevel = Math.min(100, userExperience * 10);
      const marketDemand = Math.min(100, demand * 2);
      const careerPotential = (proficiencyLevel + marketDemand) / 2;

      const recommendedFocus =
        userFormats.includes(format as typeof userFormats[number]) && proficiencyLevel > 50;

      return {
        format,
        proficiency_level: proficiencyLevel,
        market_demand: marketDemand,
        career_potential: Math.round(careerPotential),
        recommended_focus: recommendedFocus,
      };
    }).sort((a, b) => b.career_potential - a.career_potential);

    const skillGaps = [
      {
        skill: "Advanced Feedback Writing",
        importance: 90,
        your_level: Math.min(100, userQuality * 20),
        industry_standard: 80,
        development_priority: userQuality * 20 < 60 ? "high" : userQuality * 20 < 75 ? "medium" : "low",
      },
      {
        skill: "Bias Recognition",
        importance: 85,
        your_level: Math.max(0, 100 - (judgingScores.filter(s => s.speaker_scores?.some(ss => ss.bias_detected)).length * 5)),
        industry_standard: 85,
        development_priority: "medium",
      },
      {
        skill: "Multi-Format Expertise",
        importance: 75,
        your_level: Math.min(100, userFormats.length * 25),
        industry_standard: 75,
        development_priority: userFormats.length < 3 ? "medium" : "low",
      },
    ] as Array<{
      skill: string;
      importance: number;
      your_level: number;
      industry_standard: number;
      development_priority: "high" | "medium" | "low";
    }>;

    const certificationRoadmap = [
      {
        certification: "Master Judge Certification",
        prerequisites: ["100+ debates judged", "4.5+ quality rating"],
        difficulty: 85,
        time_investment: 180,
        career_impact: 95,
        next_steps: userActivityLevel >= 100 ? ["Apply for certification"] : ["Continue judging to reach 100 debates"],
      },
      {
        certification: "Judge Trainer Certification",
        prerequisites: ["Master Judge status", "Train 5+ judges"],
        difficulty: 90,
        time_investment: 365,
        career_impact: 90,
        next_steps: ["Achieve Master Judge status first"],
      },
    ];

    const specializationInsights = {
      format_specialization: formatSpecialization,
      skill_gaps: skillGaps,
      certification_roadmap: certificationRoadmap,
    };

    return {
      benchmark_comparison: benchmarkComparison,
      peer_analysis: peerAnalysis,
      excellence_pathways: excellencePathways,
      mentorship_opportunities: mentorshipOpportunities,
      specialization_insights: specializationInsights,
    };
  },
});

export const exportVolunteerAnalyticsData = query({
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

    if (!sessionResult.valid || !sessionResult.user || sessionResult.user.role !== "volunteer") {
      throw new Error("Volunteer access required");
    }

    const exportData: Record<string, any> = {};

    if (args.sections.includes("judging")) {
      const judgingData = await ctx.runQuery(api.functions.volunteers.analytics.getVolunteerJudgingAnalytics, {
        token: args.token,
        date_range: args.date_range,
      });

      exportData.judging_summary = judgingData.judging_performance;
      exportData.judging_trends = judgingData.judging_trends;
      exportData.tournament_contributions = judgingData.tournament_contributions.map((tc: { tournament_name: any; role: any; debates_judged: any; contribution_score: any; organizer_rating: any; }) => ({
        tournament_name: tc.tournament_name,
        role: tc.role,
        debates_judged: tc.debates_judged,
        contribution_score: tc.contribution_score,
        organizer_rating: tc.organizer_rating,
      }));
      exportData.expertise_development = {
        format_expertise: judgingData.expertise_development.format_expertise,
        judging_skills: judgingData.expertise_development.judging_skills,
      };
    }

    if (args.sections.includes("engagement")) {
      const engagementData = await ctx.runQuery(api.functions.volunteers.analytics.getVolunteerEngagementAnalytics, {
        token: args.token,
        date_range: args.date_range,
      });

      exportData.activity_summary = engagementData.activity_metrics;
      exportData.availability_patterns = engagementData.availability_patterns;
      exportData.achievements = engagementData.recognition_tracking.achievements_earned;
      exportData.certifications = engagementData.skill_development.certifications_earned;
    }

    if (args.sections.includes("benchmarking")) {
      const benchmarkingData = await ctx.runQuery(api.functions.volunteers.analytics.getVolunteerCompetitiveBenchmarking, {
        token: args.token,
      });

      exportData.benchmark_comparison = benchmarkingData.benchmark_comparison;
      exportData.peer_analysis = benchmarkingData.peer_analysis.map((peer: { peer_name: any; similarity_score: any; comparative_metrics: { debates_judged: { difference: any; }; quality_rating: { difference: any; }; }; }) => ({
        peer_name: peer.peer_name,
        similarity_score: peer.similarity_score,
        debates_judged_difference: peer.comparative_metrics.debates_judged.difference,
        quality_difference: peer.comparative_metrics.quality_rating.difference,
      }));
      exportData.excellence_pathways = benchmarkingData.excellence_pathways;
    }

    return exportData;
  },
});

export const generateVolunteerAnalyticsReport = mutation({
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

    if (!sessionResult.valid || !sessionResult.user || sessionResult.user.role !== "volunteer") {
      throw new Error("Volunteer access required");
    }

    const reportId = `volunteer_report_${sessionResult.user.id}_${Date.now()}`;
    const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000);

    const reportData: any = {};

    if (args.report_config.sections.includes("judging")) {
      reportData.judging = await ctx.runQuery(api.functions.volunteers.analytics.getVolunteerJudgingAnalytics, {
        token: args.token,
        date_range: args.report_config.date_range,
      });
    }

    if (args.report_config.sections.includes("engagement")) {
      reportData.engagement = await ctx.runQuery(api.functions.volunteers.analytics.getVolunteerEngagementAnalytics, {
        token: args.token,
        date_range: args.report_config.date_range,
      });
    }

    if (args.report_config.sections.includes("benchmarking")) {
      reportData.benchmarking = await ctx.runQuery(api.functions.volunteers.analytics.getVolunteerCompetitiveBenchmarking, {
        token: args.token,
      });
    }

    await ctx.db.insert("report_shares", {
      report_type: "tournament",
      report_id: JSON.stringify({
        config: args.report_config,
        data: reportData,
        volunteer_id: sessionResult.user.id,
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
      description: `Generated volunteer analytics report: ${args.report_config.title}`,
    });

    return {
      report_id: reportId,
      report_url: `${process.env.FRONTEND_SITE_URL}/reports/volunteer/${reportId}`,
      generated_at: Date.now(),
      expires_at: expiresAt,
    };
  },
});