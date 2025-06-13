import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import { Id, Doc } from "../_generated/dataModel";

interface RankingResponse<T> {
  success: boolean;
  error: string | null;
  data: T;
  type: 'success' | 'permission_error' | 'validation_error' | 'data_insufficient' | 'not_released';
}

interface SchoolRanking {
  rank: number;
  school_id: Id<"schools">;
  school_name: string;
  school_type: string;
  total_teams: number;
  total_wins: number;
  total_points: number;
  best_team_rank: number;
  avg_team_rank: number;
  teams: Array<{
    team_id: Id<"teams">;
    team_name: string;
    wins: number;
    total_points: number;
    rank: number;
    eliminated_in_round?: number;
  }>;
}

interface StudentRanking {
  rank: number;
  speaker_id: Id<"users">;
  speaker_name: string;
  speaker_email: string;
  team_id?: Id<"teams">;
  team_name?: string;
  school_id?: Id<"schools">;
  school_name?: string;
  total_speaker_points: number;
  average_speaker_score: number;
  team_wins: number;
  team_rank: number;
  debates_count: number;
  avg_position_rank_in_team: number;
  speaking_time_efficiency: number;
  cross_tournament_performance: {
    tournaments_participated: number;
    avg_points_per_tournament: number;
    best_tournament_rank: number;
  };
}

interface VolunteerRanking {
  rank: number;
  volunteer_id: Id<"users">;
  volunteer_name: string;
  volunteer_email: string;
  school_id?: Id<"schools">;
  school_name?: string;
  total_debates_judged: number;
  elimination_debates_judged: number;
  prelim_debates_judged: number;
  head_judge_assignments: number;
  avg_feedback_score: number;
  total_feedback_count: number;
  consistency_score: number;
  cross_tournament_stats: {
    tournaments_judged: number;
    total_debates_across_tournaments: number;
    avg_feedback_across_tournaments: number;
  };
}

type ExportedSchoolRanking = {
  rank: number;
  school_name: string;
  school_type: string;
  total_teams: number;
  total_wins: number;
  total_points: number;
  best_team_rank: number;
  avg_team_rank: string;
  teams_list: string;
};

type ExportedStudentRanking = {
  rank: number;
  speaker_name: string;
  speaker_email: string;
  team_name?: string;
  school_name?: string;
  total_speaker_points: number;
  average_speaker_score: string;
  team_wins: number;
  team_rank: number;
  debates_count: number;
  avg_position_rank: string;
  speaking_efficiency: string;
  cross_tournament_participation: number;
};

type ExportedVolunteerRanking = {
  rank: number;
  volunteer_name: string;
  volunteer_email: string;
  school_name?: string;
  total_debates_judged: number;
  elimination_debates: number;
  prelim_debates: number;
  head_judge_assignments: number;
  avg_feedback_score: string;
  feedback_count: number;
  consistency_score: string;
  cross_tournament_debates: number;
};

type ExportedRankingResult =
  | ExportedSchoolRanking[]
  | ExportedStudentRanking[]
  | ExportedVolunteerRanking[];

const validateTournamentData = async (
  ctx: any,
  tournament: Doc<"tournaments">,
  includeElimination: boolean = false
) => {
  const rounds = await ctx.db
    .query("rounds")
    .withIndex("by_tournament_id", (q: any) => q.eq("tournament_id", tournament._id))
    .collect();

  const debates = await ctx.db
    .query("debates")
    .withIndex("by_tournament_id", (q: any) => q.eq("tournament_id", tournament._id))
    .collect();

  const judgingScores = await ctx.db
    .query("judging_scores")
    .collect();

  const prelimRounds = rounds.filter((r: any) => r.type === "preliminary");
  const elimRounds = rounds.filter((r: any) => r.type === "elimination");

  const completedPrelimRounds = prelimRounds.filter((r: any) => r.status === "completed");
  const completedElimRounds = elimRounds.filter((r: any) => r.status === "completed");

  const prelimDebates = debates.filter((d: any) => {
    const round = rounds.find((r: any) => r._id === d.round_id);
    return round && round.type === "preliminary" && !d.is_public_speaking;
  });

  const elimDebates = debates.filter((d: any) => {
    const round = rounds.find((r: any) => r._id === d.round_id);
    return round && round.type === "elimination" && !d.is_public_speaking;
  });

  const completedPrelimDebates = prelimDebates.filter((d: any) => d.status === "completed");
  const completedElimDebates = elimDebates.filter((d: any) => d.status === "completed");

  const scoredPrelimDebates = completedPrelimDebates.filter((d: any) =>
    judgingScores.some((s: any) => s.debate_id === d._id)
  );

  const scoredElimDebates = completedElimDebates.filter((d: any) =>
    judgingScores.some((s: any) => s.debate_id === d._id)
  );

  if (includeElimination) {
    if (completedPrelimRounds.length < tournament.prelim_rounds) {
      throw new Error(
        `Rankings with elimination data require all preliminary rounds to be completed. ` +
        `Currently ${completedPrelimRounds.length}/${tournament.prelim_rounds} prelim rounds completed.`
      );
    }

    if (completedElimRounds.length === 0) {
      throw new Error(
        "Rankings with elimination data require at least one elimination round to be completed."
      );
    }

    if (scoredElimDebates.length === 0) {
      throw new Error(
        "Rankings with elimination data require at least one elimination debate to have judging scores."
      );
    }
  } else {
    if (completedPrelimRounds.length === 0) {
      throw new Error(
        "Rankings require at least one preliminary round to be completed."
      );
    }

    if (scoredPrelimDebates.length === 0) {
      throw new Error(
        "Rankings require at least one preliminary debate to have judging scores."
      );
    }
  }

  return {
    prelimRounds: completedPrelimRounds.length,
    elimRounds: completedElimRounds.length,
    prelimDebates: scoredPrelimDebates.length,
    elimDebates: scoredElimDebates.length,
    totalScoredDebates: scoredPrelimDebates.length + scoredElimDebates.length,
  };
};

export const recalculateRankings = mutation({
  args: {
    token: v.string(),
    tournament_id: v.id("tournaments"),
  },
  handler: async (ctx, args) => {
    const sessionResult = await ctx.runMutation(internal.functions.auth.verifySession, {
      token: args.token,
    });

    if (!sessionResult.valid || sessionResult.user?.role !== "admin") {
      throw new Error("Admin access required");
    }

    const tournament = await ctx.db.get(args.tournament_id);
    if (!tournament) {
      throw new Error("Tournament not found");
    }

    try {
      await validateTournamentData(ctx, tournament, false);
    } catch (error: any) {
      throw new Error(`Cannot recalculate rankings: ${error.message}`);
    }

    const teams = await ctx.db
      .query("teams")
      .withIndex("by_tournament_id", (q) => q.eq("tournament_id", args.tournament_id))
      .collect();

    const judgingScores = await ctx.db
      .query("judging_scores")
      .collect();

    const debates = await ctx.db
      .query("debates")
      .withIndex("by_tournament_id", (q) => q.eq("tournament_id", args.tournament_id))
      .collect();

    const existingResults = await ctx.db
      .query("tournament_results")
      .withIndex("by_tournament_id", (q) => q.eq("tournament_id", args.tournament_id))
      .collect();

    for (const result of existingResults) {
      await ctx.db.delete(result._id);
    }

    const teamResults = new Map<Id<"teams">, {
      wins: number;
      losses: number;
      total_points: number;
      eliminated_in_round?: number;
    }>();

    for (const team of teams) {
      teamResults.set(team._id, {
        wins: 0,
        losses: 0,
        total_points: 0,
      });
    }

    for (const debate of debates) {
      if (debate.status !== "completed" || debate.is_public_speaking) continue;

      const scores = judgingScores.filter(s => s.debate_id === debate._id);
      if (scores.length === 0) continue;

      const propVotes = scores.filter(s => s.winning_position === "proposition").length;
      const oppVotes = scores.filter(s => s.winning_position === "opposition").length;

      let winningTeamId: Id<"teams"> | undefined;
      let losingTeamId: Id<"teams"> | undefined;

      if (propVotes > oppVotes) {
        winningTeamId = debate.proposition_team_id;
        losingTeamId = debate.opposition_team_id;
      } else if (oppVotes > propVotes) {
        winningTeamId = debate.opposition_team_id;
        losingTeamId = debate.proposition_team_id;
      }

      if (winningTeamId && teamResults.has(winningTeamId)) {
        teamResults.get(winningTeamId)!.wins++;
      }
      if (losingTeamId && teamResults.has(losingTeamId)) {
        teamResults.get(losingTeamId)!.losses++;
      }

      const teamPoints = new Map<Id<"teams">, number>();

      scores.forEach(score => {
        score.speaker_scores.forEach(speakerScore => {
          const currentPoints = teamPoints.get(speakerScore.team_id) || 0;
          teamPoints.set(speakerScore.team_id, currentPoints + speakerScore.score);
        });
      });

      teamPoints.forEach((points, teamId) => {
        if (teamResults.has(teamId)) {
          teamResults.get(teamId)!.total_points += points;
        }
      });
    }

    const sortedTeams = Array.from(teamResults.entries()).map(([teamId, results]) => ({
      teamId,
      ...results,
    })).sort((a, b) => {
      if (a.wins !== b.wins) return b.wins - a.wins;
      if (a.total_points !== b.total_points) return b.total_points - a.total_points;
      return a.losses - b.losses;
    });

    for (let i = 0; i < sortedTeams.length; i++) {
      const teamData = sortedTeams[i];
      await ctx.db.insert("tournament_results", {
        tournament_id: args.tournament_id,
        result_type: "team",
        team_id: teamData.teamId,
        wins: teamData.wins,
        losses: teamData.losses,
        team_points: teamData.total_points,
        team_rank: i + 1,
        is_eliminated: teamData.eliminated_in_round !== undefined,
        eliminated_in_round: teamData.eliminated_in_round,
      });
    }

    const speakerResults = new Map<Id<"users">, {
      total_points: number;
      scores: number[];
      team_id: Id<"teams">;
      team_wins: number;
      position_ranks: number[];
    }>();

    for (const score of judgingScores) {
      const debate = debates.find(d => d._id === score.debate_id);
      if (!debate || debate.is_public_speaking) continue;

      score.speaker_scores.forEach(speakerScore => {
        if (!speakerResults.has(speakerScore.speaker_id)) {
          const teamResult = teamResults.get(speakerScore.team_id);
          speakerResults.set(speakerScore.speaker_id, {
            total_points: 0,
            scores: [],
            team_id: speakerScore.team_id,
            team_wins: teamResult?.wins || 0,
            position_ranks: [],
          });
        }

        const speakerData = speakerResults.get(speakerScore.speaker_id)!;
        speakerData.total_points += speakerScore.score;
        speakerData.scores.push(speakerScore.score);

        const teamScores = score.speaker_scores
          .filter(s => s.team_id === speakerScore.team_id)
          .sort((a, b) => b.score - a.score);

        const positionRank = teamScores.findIndex(s => s.speaker_id === speakerScore.speaker_id) + 1;
        speakerData.position_ranks.push(positionRank);
      });
    }

    const sortedSpeakers = Array.from(speakerResults.entries()).map(([speakerId, results]) => {
      const avgScore = results.scores.length > 0 ? results.total_points / results.scores.length : 0;
      const avgPositionRank = results.position_ranks.length > 0
        ? results.position_ranks.reduce((sum, rank) => sum + rank, 0) / results.position_ranks.length
        : 999;

      const teamRank = sortedTeams.findIndex(t => t.teamId === results.team_id) + 1;

      return {
        speakerId,
        total_points: results.total_points,
        avg_score: avgScore,
        team_wins: results.team_wins,
        avg_position_rank: avgPositionRank,
        team_rank: teamRank,
        debates_count: results.scores.length,
        team_id: results.team_id,
      };
    }).sort((a, b) => {
      if (a.total_points !== b.total_points) return b.total_points - a.total_points;
      if (a.avg_position_rank !== b.avg_position_rank) return a.avg_position_rank - b.avg_position_rank;
      if (a.team_wins !== b.team_wins) return b.team_wins - a.team_wins;
      return a.team_rank - b.team_rank;
    });

    for (let i = 0; i < sortedSpeakers.length; i++) {
      const speakerData = sortedSpeakers[i];
      await ctx.db.insert("tournament_results", {
        tournament_id: args.tournament_id,
        result_type: "speaker",
        speaker_id: speakerData.speakerId,
        speaker_team_id: speakerData.team_id,
        total_speaker_points: speakerData.total_points,
        average_speaker_score: speakerData.avg_score,
        speaker_rank: i + 1,
      });
    }

    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: sessionResult.user.id,
      action: "tournament_updated",
      resource_type: "tournaments",
      resource_id: args.tournament_id,
      description: `Recalculated rankings for ${teams.length} teams and ${sortedSpeakers.length} speakers`,
    });

    return {
      success: true,
      teams_processed: teams.length,
      speakers_processed: sortedSpeakers.length,
    };
  },
});

export const getSchoolRankings = query({
  args: {
    token: v.string(),
    tournament_id: v.id("tournaments"),
    include_elimination: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<RankingResponse<SchoolRanking[]>> => {
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySessionReadOnly, {
      token: args.token,
    });

    if (!sessionResult.user || !sessionResult.valid) {
      throw new Error("Authentication required");
    }

    const tournament = await ctx.db.get(args.tournament_id);
    if (!tournament) {
      throw new Error("Tournament not found");
    }

    const user = sessionResult.user;
    const canSeeRankings = user.role === "admin" ||
      (tournament.ranking_released &&
        tournament.ranking_released.visible_to_roles.includes(user.role));

    if (!canSeeRankings) {
      return {
        success: false,
        error: "Rankings not yet released",
        data: [],
        type: 'not_released'
      };
    }

    const includeElims = args.include_elimination && user.role === "admin";

    try {
      await validateTournamentData(ctx, tournament, includeElims);
    } catch (error: any) {
      return {
        success: false,
        error: `School rankings not available: ${error.message}`,
        data: [],
        type: 'data_insufficient'
      };
    }

    const rankingType = includeElims ? "full_tournament" : "prelims";

    if (!includeElims && tournament.ranking_released &&
      !tournament.ranking_released[rankingType].schools) {
      return {
        success: false,
        error: "School rankings not yet released for this phase",
        data: [],
        type: 'not_released'
      };
    }

    const teams = await ctx.db
      .query("teams")
      .withIndex("by_tournament_id", (q) => q.eq("tournament_id", args.tournament_id))
      .collect();

    const teamResults = await ctx.db
      .query("tournament_results")
      .withIndex("by_tournament_id_result_type", (q) =>
        q.eq("tournament_id", args.tournament_id).eq("result_type", "team")
      )
      .collect();

    const schoolStats = new Map<Id<"schools">, {
      school: Doc<"schools">;
      teams: Array<{
        team_id: Id<"teams">;
        team_name: string;
        wins: number;
        total_points: number;
        rank: number;
        eliminated_in_round?: number;
      }>;
      total_teams: number;
      total_wins: number;
      total_points: number;
      best_team_rank: number;
      avg_team_rank: number;
    }>();

    for (const team of teams) {
      if (!team.school_id) continue;

      const school = await ctx.db.get(team.school_id);
      if (!school) continue;

      const teamResult = teamResults.find(r => r.team_id === team._id);
      const wins = teamResult?.wins || 0;
      const totalPoints = teamResult?.team_points || 0;
      const rank = teamResult?.team_rank || 999;
      const eliminatedInRound = teamResult?.eliminated_in_round;

      if (!schoolStats.has(team.school_id)) {
        schoolStats.set(team.school_id, {
          school,
          teams: [],
          total_teams: 0,
          total_wins: 0,
          total_points: 0,
          best_team_rank: 999,
          avg_team_rank: 0,
        });
      }

      const schoolStat = schoolStats.get(team.school_id)!;
      schoolStat.teams.push({
        team_id: team._id,
        team_name: team.name,
        wins,
        total_points: totalPoints,
        rank,
        eliminated_in_round: eliminatedInRound,
      });

      schoolStat.total_teams++;
      schoolStat.total_wins += wins;
      schoolStat.total_points += totalPoints;
      schoolStat.best_team_rank = Math.min(schoolStat.best_team_rank, rank);
    }

    const schoolRankings: SchoolRanking[] = Array.from(schoolStats.entries()).map(([schoolId, stats]) => {
      stats.avg_team_rank = stats.teams.reduce((sum, team) => sum + team.rank, 0) / stats.teams.length;

      return {
        rank: 0,
        school_id: schoolId,
        school_name: stats.school.name,
        school_type: stats.school.type,
        total_teams: stats.total_teams,
        total_wins: stats.total_wins,
        total_points: stats.total_points,
        best_team_rank: stats.best_team_rank,
        avg_team_rank: stats.avg_team_rank,
        teams: stats.teams.sort((a, b) => a.rank - b.rank),
      };
    });

    schoolRankings.sort((a, b) => {
      if (a.best_team_rank !== b.best_team_rank) {
        return a.best_team_rank - b.best_team_rank;
      }
      if (a.total_wins !== b.total_wins) {
        return b.total_wins - a.total_wins;
      }
      if (a.total_points !== b.total_points) {
        return b.total_points - a.total_points;
      }
      return a.avg_team_rank - b.avg_team_rank;
    });

    schoolRankings.forEach((school, index) => {
      school.rank = index + 1;
    });

    return {
      success: true,
      error: null,
      data: schoolRankings,
      type: 'success'
    };
  },
});

export const getStudentRankings = query({
  args: {
    token: v.string(),
    tournament_id: v.id("tournaments"),
    include_elimination: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<RankingResponse<StudentRanking[]>> => {
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySessionReadOnly, {
      token: args.token,
    });

    if (!sessionResult.user || !sessionResult.valid) {
      throw new Error("Authentication required");
    }

    const tournament = await ctx.db.get(args.tournament_id);
    if (!tournament) {
      throw new Error("Tournament not found");
    }

    const user = sessionResult.user;
    const canSeeRankings = user.role === "admin" ||
      (tournament.ranking_released &&
        tournament.ranking_released.visible_to_roles.includes(user.role));

    if (!canSeeRankings) {
      return {
        success: false,
        error: "Rankings not yet released",
        data: [],
        type: 'not_released'
      };
    }

    const includeElims = args.include_elimination && user.role === "admin";

    try {
      await validateTournamentData(ctx, tournament, includeElims);
    } catch (error: any) {
      return {
        success: false,
        error: `Student rankings not available: ${error.message}`,
        data: [],
        type: 'data_insufficient'
      };
    }

    const rankingType = includeElims ? "full_tournament" : "prelims";

    if (!includeElims && tournament.ranking_released &&
      !tournament.ranking_released[rankingType].students) {
      return {
        success: false,
        error: "Student rankings not yet released for this phase",
        data: [],
        type: 'not_released'
      };
    }

    const league = tournament.league_id ? await ctx.db.get(tournament.league_id) : null;

    const speakerResults = await ctx.db
      .query("tournament_results")
      .withIndex("by_tournament_id_result_type", (q) =>
        q.eq("tournament_id", args.tournament_id).eq("result_type", "speaker")
      )
      .collect();

    const teams = await ctx.db
      .query("teams")
      .withIndex("by_tournament_id", (q) => q.eq("tournament_id", args.tournament_id))
      .collect();

    const teamResults = await ctx.db
      .query("tournament_results")
      .withIndex("by_tournament_id_result_type", (q) =>
        q.eq("tournament_id", args.tournament_id).eq("result_type", "team")
      )
      .collect();

    const judgingScores = await ctx.db
      .query("judging_scores")
      .collect();

    const tournamentScores = judgingScores.filter(score => {
      return score.speaker_scores.some(ss => {
        const team = teams.find(t => t._id === ss.team_id);
        return team?.tournament_id === args.tournament_id;
      });
    });

    let crossTournamentData = new Map<Id<"users">, {
      tournaments_participated: number;
      total_points: number;
      best_rank: number;
    }>();

    if (league) {
      const leagueTournaments = await ctx.db
        .query("tournaments")
        .withIndex("by_league_id_status", (q) =>
          q.eq("league_id", league._id).eq("status", "completed")
        )
        .collect();

      for (const leagueTournament of leagueTournaments) {
        if (leagueTournament._id === args.tournament_id) continue;

        const crossResults = await ctx.db
          .query("tournament_results")
          .withIndex("by_tournament_id_result_type", (q) =>
            q.eq("tournament_id", leagueTournament._id).eq("result_type", "speaker")
          )
          .collect();

        crossResults.forEach(result => {
          if (!result.speaker_id) return;

          if (!crossTournamentData.has(result.speaker_id)) {
            crossTournamentData.set(result.speaker_id, {
              tournaments_participated: 0,
              total_points: 0,
              best_rank: 999,
            });
          }

          const data = crossTournamentData.get(result.speaker_id)!;
          data.tournaments_participated++;
          data.total_points += result.total_speaker_points || 0;
          data.best_rank = Math.min(data.best_rank, result.speaker_rank || 999);
        });
      }
    }

    const enrichedSpeakers = await Promise.all(
      speakerResults.map(async (speakerResult) => {
        const speaker = await ctx.db.get(speakerResult.speaker_id!);
        if (!speaker) return null;

        const team = teams.find(t => t._id === speakerResult.speaker_team_id);
        const teamResult = teamResults.find(r => r.team_id === speakerResult.speaker_team_id);
        const school = team?.school_id ? await ctx.db.get(team.school_id) : null;

        const speakerScores = tournamentScores.flatMap(score =>
          score.speaker_scores.filter(ss => ss.speaker_id === speaker._id)
        );

        let avgPositionRank = 0;
        let speakingTimeEfficiency = 1.0;

        if (speakerScores.length > 0) {
          const positionRanks: number[] = [];

          const scoresByDebate = new Map<Id<"debates">, typeof speakerScores>();
          speakerScores.forEach(score => {
            const debateScores = tournamentScores.find(ts =>
              ts.speaker_scores.includes(score)
            );
            if (debateScores) {
              if (!scoresByDebate.has(debateScores.debate_id)) {
                scoresByDebate.set(debateScores.debate_id, []);
              }
              scoresByDebate.get(debateScores.debate_id)!.push(score);
            }
          });

          scoresByDebate.forEach(debateScores => {
            if (team) {
              const teamScores = debateScores.filter(s =>
                team.members.includes(s.speaker_id)
              ).sort((a, b) => b.score - a.score);

              const speakerIndex = teamScores.findIndex(s => s.speaker_id === speaker._id);
              if (speakerIndex !== -1) {
                positionRanks.push(speakerIndex + 1);
              }
            }
          });

          avgPositionRank = positionRanks.length > 0
            ? positionRanks.reduce((sum, rank) => sum + rank, 0) / positionRanks.length
            : 999;

          speakingTimeEfficiency = Math.max(0.5, 1.0 - (avgPositionRank - 1) * 0.1);
        }

        const crossPerformance = crossTournamentData.get(speaker._id) || {
          tournaments_participated: 0,
          total_points: 0,
          best_rank: 999,
        };

        const crossTournamentPerformance = {
          tournaments_participated: crossPerformance.tournaments_participated,
          avg_points_per_tournament: crossPerformance.tournaments_participated > 0
            ? crossPerformance.total_points / crossPerformance.tournaments_participated
            : 0,
          best_tournament_rank: crossPerformance.best_rank,
        };

        return {
          rank: speakerResult.speaker_rank || 999,
          speaker_id: speaker._id,
          speaker_name: speaker.name,
          speaker_email: speaker.email,
          team_id: team?._id,
          team_name: team?.name,
          school_id: school?._id,
          school_name: school?.name,
          total_speaker_points: speakerResult.total_speaker_points || 0,
          average_speaker_score: speakerResult.average_speaker_score || 0,
          team_wins: teamResult?.wins || 0,
          team_rank: teamResult?.team_rank || 999,
          debates_count: speakerScores.length,
          avg_position_rank_in_team: avgPositionRank,
          speaking_time_efficiency: speakingTimeEfficiency,
          cross_tournament_performance: crossTournamentPerformance,
        } satisfies StudentRanking;
      })
    );

    const filteredSpeakers = enrichedSpeakers.filter(Boolean).sort((a, b) => a!.rank - b!.rank) as StudentRanking[];

    return {
      success: true,
      error: null,
      data: filteredSpeakers,
      type: 'success'
    };
  },
});

export const getVolunteerRankings = query({
  args: {
    token: v.string(),
    tournament_id: v.id("tournaments"),
  },
  handler: async (ctx, args): Promise<RankingResponse<VolunteerRanking[]>> => {
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySessionReadOnly, {
      token: args.token,
    });

    if (!sessionResult.user || !sessionResult.valid) {
      throw new Error("Authentication required");
    }

    const tournament = await ctx.db.get(args.tournament_id);
    if (!tournament) {
      throw new Error("Tournament not found");
    }

    const user = sessionResult.user;
    const canSeeRankings = user.role === "admin" ||
      (tournament.ranking_released &&
        tournament.ranking_released.visible_to_roles.includes(user.role));

    if (!canSeeRankings) {
      return {
        success: false,
        error: "Rankings not yet released",
        data: [],
        type: 'not_released'
      };
    }

    try {
      await validateTournamentData(ctx, tournament, false);
    } catch (error: any) {
      return {
        success: false,
        error: `Volunteer rankings not available: ${error.message}`,
        data: [],
        type: 'data_insufficient'
      };
    }

    if (tournament.ranking_released && !tournament.ranking_released.full_tournament.volunteers) {
      return {
        success: false,
        error: "Volunteer rankings not yet released",
        data: [],
        type: 'not_released'
      };
    }

    const league = tournament.league_id ? await ctx.db.get(tournament.league_id) : null;

    const invitations = await ctx.db
      .query("tournament_invitations")
      .withIndex("by_tournament_id_target_type_status", (q) =>
        q.eq("tournament_id", args.tournament_id)
          .eq("target_type", "volunteer")
          .eq("status", "accepted")
      )
      .collect();

    const volunteerIds = invitations.map(inv => inv.target_id);
    const volunteers = await Promise.all(
      volunteerIds.map(id => ctx.db.get(id))
    );

    const debates = await ctx.db
      .query("debates")
      .withIndex("by_tournament_id", (q) => q.eq("tournament_id", args.tournament_id))
      .collect();

    const judgeFeedback = await ctx.db
      .query("judge_feedback")
      .withIndex("by_tournament_id", (q) => q.eq("tournament_id", args.tournament_id))
      .collect();

    const rounds = await ctx.db
      .query("rounds")
      .withIndex("by_tournament_id", (q) => q.eq("tournament_id", args.tournament_id))
      .collect();

    let crossTournamentDebates: Doc<"debates">[] = [];
    let crossTournamentFeedback: Doc<"judge_feedback">[] = [];

    if (league) {
      const leagueTournaments = await ctx.db
        .query("tournaments")
        .withIndex("by_league_id_status", (q) =>
          q.eq("league_id", league._id).eq("status", "completed")
        )
        .collect();

      for (const leagueTournament of leagueTournaments) {
        if (leagueTournament._id === args.tournament_id) continue;

        const tournamentDebates = await ctx.db
          .query("debates")
          .withIndex("by_tournament_id", (q) => q.eq("tournament_id", leagueTournament._id))
          .collect();

        crossTournamentDebates.push(...tournamentDebates);

        const tournamentFeedback = await ctx.db
          .query("judge_feedback")
          .withIndex("by_tournament_id", (q) => q.eq("tournament_id", leagueTournament._id))
          .collect();

        crossTournamentFeedback.push(...tournamentFeedback);
      }
    }

    const volunteerStats: VolunteerRanking[] = await Promise.all(
      volunteers.filter(Boolean).map(async (volunteer) => {
        const school = volunteer!.school_id ? await ctx.db.get(volunteer!.school_id) : null;

        const judgedDebates = debates.filter(d => d.judges.includes(volunteer!._id));
        const totalDebates = judgedDebates.length;

        const eliminationDebates = judgedDebates.filter(d => {
          const round = rounds.find(r => r._id === d.round_id);
          return round && round.round_number > tournament.prelim_rounds;
        }).length;

        const prelimDebates = totalDebates - eliminationDebates;

        const headJudgeCount = judgedDebates.filter(d => d.head_judge_id === volunteer!._id).length;

        const feedback = judgeFeedback.filter(f => f.judge_id === volunteer!._id);
        let avgFeedbackScore = 3.0;
        let consistencyScore = 1.0;

        if (feedback.length > 0) {
          const totalScore = feedback.reduce((sum, f) => {
            return sum + ((f.clarity + f.fairness + f.knowledge + f.helpfulness) / 4);
          }, 0);
          avgFeedbackScore = totalScore / feedback.length;

          const biasComplaints = feedback.filter(f => f.bias_detected).length;
          consistencyScore = Math.max(0, 1 - (biasComplaints / feedback.length));
        }

        const crossDebates = crossTournamentDebates.filter(d => d.judges.includes(volunteer!._id));
        const crossFeedback = crossTournamentFeedback.filter(f => f.judge_id === volunteer!._id);

        const crossTournamentStats = {
          tournaments_judged: new Set(crossDebates.map(d => d.tournament_id)).size,
          total_debates_across_tournaments: crossDebates.length,
          avg_feedback_across_tournaments: crossFeedback.length > 0
            ? crossFeedback.reduce((sum, f) => sum + ((f.clarity + f.fairness + f.knowledge + f.helpfulness) / 4), 0) / crossFeedback.length
            : 3.0,
        };

        return {
          rank: 0,
          volunteer_id: volunteer!._id,
          volunteer_name: volunteer!.name,
          volunteer_email: volunteer!.email,
          school_id: school?._id,
          school_name: school?.name,
          total_debates_judged: totalDebates,
          elimination_debates_judged: eliminationDebates,
          prelim_debates_judged: prelimDebates,
          head_judge_assignments: headJudgeCount,
          avg_feedback_score: avgFeedbackScore,
          total_feedback_count: feedback.length,
          consistency_score: consistencyScore,
          cross_tournament_stats: crossTournamentStats,
        };
      })
    );

    volunteerStats.sort((a, b) => {
      if (a.total_debates_judged !== b.total_debates_judged) {
        return b.total_debates_judged - a.total_debates_judged;
      }

      if (a.elimination_debates_judged !== b.elimination_debates_judged) {
        return b.elimination_debates_judged - a.elimination_debates_judged;
      }

      if (a.avg_feedback_score !== b.avg_feedback_score) {
        return b.avg_feedback_score - a.avg_feedback_score;
      }

      if (a.consistency_score !== b.consistency_score) {
        return b.consistency_score - a.consistency_score;
      }

      return b.head_judge_assignments - a.head_judge_assignments;
    });

    volunteerStats.forEach((volunteer, index) => {
      volunteer.rank = index + 1;
    });

    return {
      success: true,
      error: null,
      data: volunteerStats,
      type: 'success'
    };
  },
});

export const updateRankingRelease = mutation({
  args: {
    token: v.string(),
    tournament_id: v.id("tournaments"),
    ranking_settings: v.object({
      prelims: v.object({
        schools: v.boolean(),
        students: v.boolean(),
        volunteers: v.boolean(),
      }),
      full_tournament: v.object({
        schools: v.boolean(),
        students: v.boolean(),
        volunteers: v.boolean(),
      }),
      visible_to_roles: v.array(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const sessionResult = await ctx.runMutation(internal.functions.auth.verifySession, {
      token: args.token,
    });

    if (!sessionResult.valid || sessionResult.user?.role !== "admin") {
      throw new Error("Admin access required");
    }

    const tournament = await ctx.db.get(args.tournament_id);
    if (!tournament) {
      throw new Error("Tournament not found");
    }

    const validRoles = ["student", "school_admin", "volunteer"];
    const invalidRoles = args.ranking_settings.visible_to_roles.filter(
      role => !validRoles.includes(role)
    );

    if (invalidRoles.length > 0) {
      throw new Error(`Invalid roles: ${invalidRoles.join(', ')}`);
    }

    await ctx.db.patch(args.tournament_id, {
      ranking_released: args.ranking_settings,
    });

    const releasedTypes: string[] = [];
    if (args.ranking_settings.prelims.schools || args.ranking_settings.full_tournament.schools) {
      releasedTypes.push("school");
    }
    if (args.ranking_settings.prelims.students || args.ranking_settings.full_tournament.students) {
      releasedTypes.push("student");
    }
    if (args.ranking_settings.prelims.volunteers || args.ranking_settings.full_tournament.volunteers) {
      releasedTypes.push("volunteer");
    }

    if (releasedTypes.length > 0) {
      try {
        await ctx.runMutation(internal.functions.notifications.sendTournamentNotification, {
          token: args.token,
          tournament_id: args.tournament_id,
          title: "Rankings Released",
          message: `${releasedTypes.join(", ")} rankings are now available!`,
          type: "tournament",
          send_push: true,
          target_roles: args.ranking_settings.visible_to_roles,
        });
      } catch (error) {
        console.warn("Failed to send ranking release notification:", error);
      }
    }

    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: sessionResult.user.id,
      action: "tournament_updated",
      resource_type: "tournaments",
      resource_id: args.tournament_id,
      description: `Updated ranking release settings: ${releasedTypes.join(", ")} rankings released`,
    });

    return { success: true };
  },
});

export const generateEliminationBrackets = query({
  args: {
    token: v.string(),
    tournament_id: v.id("tournaments"),
  },
  handler: async (ctx, args) => {
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySessionReadOnly, {
      token: args.token,
    });

    if (!sessionResult.valid || sessionResult.user?.role !== "admin") {
      throw new Error("Admin access required");
    }

    const tournament = await ctx.db.get(args.tournament_id);
    if (!tournament) {
      throw new Error("Tournament not found");
    }

    try {
      await validateTournamentData(ctx, tournament, true);
    } catch (error: any) {
      return {
        success: false,
        error: `Elimination brackets not available: ${error.message}`,
        data: null,
        type: 'data_insufficient'
      };
    }

    const teamResults = await ctx.db
      .query("tournament_results")
      .withIndex("by_tournament_id_result_type", (q) =>
        q.eq("tournament_id", args.tournament_id).eq("result_type", "team")
      )
      .collect();

    const speakerResults = await ctx.db
      .query("tournament_results")
      .withIndex("by_tournament_id_result_type", (q) =>
        q.eq("tournament_id", args.tournament_id).eq("result_type", "speaker")
      )
      .collect();

    const enrichedTeams = await Promise.all(
      teamResults.map(async (result) => {
        const team = result.team_id ? await ctx.db.get(result.team_id) : null;

        const teamSpeakers = speakerResults.filter(s => s.speaker_team_id === result.team_id);
        const avgSpeakerRank = teamSpeakers.length > 0
          ? teamSpeakers.reduce((sum, s) => sum + (s.speaker_rank || 999), 0) / teamSpeakers.length
          : 999;

        const school = team?.school_id ? await ctx.db.get(team.school_id) : null;

        return {
          ...result,
          team,
          school,
          avg_speaker_rank: avgSpeakerRank,
          team_speakers: teamSpeakers,
        };
      })
    );

    const sortedTeams = enrichedTeams.sort((a, b) => {
      if ((a.wins || 0) !== (b.wins || 0)) {
        return (b.wins || 0) - (a.wins || 0);
      }

      if ((a.team_points || 0) !== (b.team_points || 0)) {
        return (b.team_points || 0) - (a.team_points || 0);
      }

      return a.avg_speaker_rank - b.avg_speaker_rank;
    });

    const elimRounds = tournament.elimination_rounds;
    const bracketSize = Math.pow(2, elimRounds);
    const qualifiedTeams = sortedTeams.slice(0, bracketSize);

    const brackets = [];
    for (let i = 0; i < bracketSize / 2; i++) {
      const topSeed = qualifiedTeams[i];
      const bottomSeed = qualifiedTeams[bracketSize - 1 - i];

      brackets.push({
        bracket_position: i + 1,
        top_seed: {
          rank: i + 1,
          team_id: topSeed.team_id,
          team_name: topSeed.team?.name,
          school_name: topSeed.school?.name,
          wins: topSeed.wins,
          total_points: topSeed.team_points,
          avg_speaker_rank: topSeed.avg_speaker_rank,
        },
        bottom_seed: {
          rank: bracketSize - i,
          team_id: bottomSeed.team_id,
          team_name: bottomSeed.team?.name,
          school_name: bottomSeed.school?.name,
          wins: bottomSeed.wins,
          total_points: bottomSeed.team_points,
          avg_speaker_rank: bottomSeed.avg_speaker_rank,
        },
        round: 1,
        expected_winner: topSeed,
      });
    }

    const qualificationStats = {
      total_teams: sortedTeams.length,
      qualified_teams: qualifiedTeams.length,
      qualification_threshold: {
        min_wins: qualifiedTeams[qualifiedTeams.length - 1]?.wins || 0,
        min_points: qualifiedTeams[qualifiedTeams.length - 1]?.team_points || 0,
      },
      missed_qualification: sortedTeams.slice(bracketSize, bracketSize + 5).map(team => ({
        rank: sortedTeams.indexOf(team) + 1,
        team_name: team.team?.name,
        school_name: team.school?.name,
        wins: team.wins,
        total_points: team.team_points,
        points_behind: (qualifiedTeams[qualifiedTeams.length - 1]?.team_points || 0) - (team.team_points || 0),
      })),
    };

    const bracketData = {
      tournament_id: args.tournament_id,
      elimination_rounds: elimRounds,
      bracket_size: bracketSize,
      brackets,
      qualification_stats: qualificationStats,
      full_rankings: sortedTeams.map((team, index) => ({
        rank: index + 1,
        team_id: team.team_id,
        team_name: team.team?.name,
        school_name: team.school?.name,
        wins: team.wins,
        total_points: team.team_points,
        avg_speaker_rank: team.avg_speaker_rank,
        qualified: index < bracketSize,
      })),
    };

    return {
      success: true,
      error: null,
      data: bracketData,
      type: 'success'
    };
  },
});

export const getRankingStatistics = query({
  args: {
    token: v.string(),
    tournament_id: v.id("tournaments"),
  },
  handler: async (ctx, args) => {
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySessionReadOnly, {
      token: args.token,
    });

    if (!sessionResult.valid || sessionResult.user?.role !== "admin") {
      return {
        success: false,
        error: "Admin access required",
        data: null,
        type: 'permission_error'
      };
    }

    const tournament = await ctx.db.get(args.tournament_id);
    if (!tournament) {
      return {
        success: false,
        error: "Tournament not found",
        data: null,
        type: 'validation_error'
      };
    }

    try {
      await validateTournamentData(ctx, tournament, false);
    } catch (error: any) {
      return {
        success: false,
        error: `Ranking statistics not available: ${error.message}`,
        data: null,
        type: 'data_insufficient'
      };
    }

    const teamResults = await ctx.db
      .query("tournament_results")
      .withIndex("by_tournament_id_result_type", (q) =>
        q.eq("tournament_id", args.tournament_id).eq("result_type", "team")
      )
      .collect();

    const speakerResults = await ctx.db
      .query("tournament_results")
      .withIndex("by_tournament_id_result_type", (q) =>
        q.eq("tournament_id", args.tournament_id).eq("result_type", "speaker")
      )
      .collect();

    const teams = await ctx.db
      .query("teams")
      .withIndex("by_tournament_id", (q) => q.eq("tournament_id", args.tournament_id))
      .collect();

    const debates = await ctx.db
      .query("debates")
      .withIndex("by_tournament_id", (q) => q.eq("tournament_id", args.tournament_id))
      .collect();

    const judgingScores = await ctx.db
      .query("judging_scores")
      .collect();

    const tournamentScores = judgingScores.filter(score => {
      return score.speaker_scores.some(ss => {
        const team = teams.find(t => t._id === ss.team_id);
        return team?.tournament_id === args.tournament_id;
      });
    });

    const teamStats = {
      total_teams: teamResults.length,
      perfect_teams: teamResults.filter(t => t.wins === tournament.prelim_rounds).length,
      winless_teams: teamResults.filter(t => t.wins === 0).length,
      avg_wins: teamResults.reduce((sum, t) => sum + (t.wins || 0), 0) / teamResults.length,
      avg_points: teamResults.reduce((sum, t) => sum + (t.team_points || 0), 0) / teamResults.length,
      win_distribution: {} as Record<number, number>,
      points_range: {
        min: Math.min(...teamResults.map(t => t.team_points || 0)),
        max: Math.max(...teamResults.map(t => t.team_points || 0)),
      },
    };

    for (let wins = 0; wins <= tournament.prelim_rounds; wins++) {
      teamStats.win_distribution[wins] = teamResults.filter(t => t.wins === wins).length;
    }

    const speakerStats = {
      total_speakers: speakerResults.length,
      avg_speaker_points: speakerResults.reduce((sum, s) => sum + (s.total_speaker_points || 0), 0) / speakerResults.length,
      avg_speaker_score: speakerResults.reduce((sum, s) => sum + (s.average_speaker_score || 0), 0) / speakerResults.length,
      points_range: {
        min: Math.min(...speakerResults.map(s => s.total_speaker_points || 0)),
        max: Math.max(...speakerResults.map(s => s.total_speaker_points || 0)),
      },
      score_distribution: {} as Record<number, number>,
    };

    speakerResults.forEach(speaker => {
      const avgScore = Math.round((speaker.average_speaker_score || 0) * 2) / 2;
      speakerStats.score_distribution[avgScore] = (speakerStats.score_distribution[avgScore] || 0) + 1;
    });

    const schoolStats = new Map<string, {
      school_name: string;
      teams_count: number;
      total_wins: number;
      total_points: number;
      best_team_rank: number;
      speakers_in_top_10: number;
    }>();

    for (const team of teams) {
      if (!team.school_id) continue;

      const school = await ctx.db.get(team.school_id);
      if (!school) continue;

      const teamResult = teamResults.find(r => r.team_id === team._id);

      if (!schoolStats.has(school.name)) {
        schoolStats.set(school.name, {
          school_name: school.name,
          teams_count: 0,
          total_wins: 0,
          total_points: 0,
          best_team_rank: 999,
          speakers_in_top_10: 0,
        });
      }

      const stats = schoolStats.get(school.name)!;
      stats.teams_count++;
      stats.total_wins += teamResult?.wins || 0;
      stats.total_points += teamResult?.team_points || 0;
      stats.best_team_rank = Math.min(stats.best_team_rank, teamResult?.team_rank || 999);

      const teamSpeakers = speakerResults.filter(s => s.speaker_team_id === team._id);
      stats.speakers_in_top_10 += teamSpeakers.filter(s => (s.speaker_rank || 999) <= 10).length;
    }

    const schoolPerformance = Array.from(schoolStats.values())
      .sort((a, b) => b.total_wins - a.total_wins)
      .slice(0, 10);

    const debateStats = {
      total_debates: debates.filter(d => !d.is_public_speaking).length,
      public_speaking_rounds: debates.filter(d => d.is_public_speaking).length,
      completed_debates: debates.filter(d => d.status === "completed").length,
      avg_scores_per_debate: tournamentScores.length > 0
        ? tournamentScores.reduce((sum, score) => sum + score.speaker_scores.length, 0) / tournamentScores.length
        : 0,
      close_debates: 0,
      unanimous_decisions: 0,
    };

    tournamentScores.forEach(score => {
      if (score.speaker_scores.length === 0) return;

      const propVotes = score.speaker_scores.filter(s =>
        score.winning_position === "proposition"
      ).length;
      const oppVotes = score.speaker_scores.filter(s =>
        score.winning_position === "opposition"
      ).length;

      const totalVotes = propVotes + oppVotes;
      if (totalVotes === 0) return;

      if (Math.abs(propVotes - oppVotes) <= 1) {
        debateStats.close_debates++;
      }

      if (propVotes === totalVotes || oppVotes === totalVotes) {
        debateStats.unanimous_decisions++;
      }
    });

    const insights: string[] = [];

    if (teamStats.perfect_teams > 0) {
      insights.push(`${teamStats.perfect_teams} team(s) went undefeated in preliminary rounds`);
    }

    if (teamStats.winless_teams > 0) {
      insights.push(`${teamStats.winless_teams} team(s) did not win any preliminary rounds`);
    }

    const competitiveness = 1 - (Math.abs(teamStats.avg_wins - tournament.prelim_rounds / 2) / (tournament.prelim_rounds / 2));
    if (competitiveness > 0.8) {
      insights.push("Highly competitive tournament with balanced team performance");
    } else if (competitiveness < 0.5) {
      insights.push("Performance gap between top and bottom teams is significant");
    }

    if (debateStats.close_debates / debateStats.total_debates > 0.3) {
      insights.push("Many close debates indicate high quality competition");
    }

    if (schoolPerformance.length > 0) {
      const topSchool = schoolPerformance[0];
      if (topSchool.teams_count > 1) {
        insights.push(`${topSchool.school_name} demonstrated strong depth with multiple competitive teams`);
      }
    }

    const avgSpeakerVariance = speakerResults.reduce((sum, s, _, arr) => {
      const mean = speakerStats.avg_speaker_points;
      return sum + Math.pow((s.total_speaker_points || 0) - mean, 2);
    }, 0) / speakerResults.length;

    if (Math.sqrt(avgSpeakerVariance) < speakerStats.avg_speaker_points * 0.2) {
      insights.push("Speaker scores show consistent judging standards");
    }

    const statsData = {
      tournament_summary: {
        total_teams: teamStats.total_teams,
        total_speakers: speakerStats.total_speakers,
        total_debates: debateStats.total_debates,
        completion_rate: debateStats.completed_debates / debateStats.total_debates,
      },
      team_statistics: teamStats,
      speaker_statistics: speakerStats,
      school_performance: schoolPerformance,
      debate_statistics: debateStats,
      insights,
      data_quality: {
        missing_team_results: teams.length - teamResults.length,
        missing_speaker_results: (teams.reduce((sum, t) => sum + t.members.length, 0)) - speakerResults.length,
        scored_debates_percentage: (tournamentScores.length / debateStats.total_debates) * 100,
      },
    };

    return {
      success: true,
      error: null,
      data: statsData,
      type: 'success'
    };
  },
});

export const exportRankingsData = query({
  args: {
    token: v.string(),
    tournament_id: v.id("tournaments"),
    ranking_type: v.union(v.literal("schools"), v.literal("students"), v.literal("volunteers")),
    include_elimination: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<RankingResponse<ExportedRankingResult>> => {
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySessionReadOnly, {
      token: args.token,
    });

    if (!sessionResult.valid || sessionResult.user?.role !== "admin") {
      throw new Error("Admin access required");
    }

    const tournament = await ctx.db.get(args.tournament_id);
    if (!tournament) {
      throw new Error("Tournament not found");
    }

    const includeElims = args.include_elimination || false;

    try {
      await validateTournamentData(ctx, tournament, includeElims);
    } catch (error: any) {
      return {
        success: false,
        error: `Rankings export not available: ${error.message}`,
        data: [],
        type: 'data_insufficient'
      };
    }

    if (args.ranking_type === "schools") {
      const schoolResponse = await ctx.runQuery(api.functions.rankings.getSchoolRankings, {
        token: args.token,
        tournament_id: args.tournament_id,
        include_elimination: args.include_elimination,
      });

      if (!schoolResponse.success) {
        return {
          success: false,
          error: schoolResponse.error,
          data: [],
          type: schoolResponse.type
        };
      }

      const exportData = schoolResponse.data.map(school => ({
        rank: school.rank,
        school_name: school.school_name,
        school_type: school.school_type,
        total_teams: school.total_teams,
        total_wins: school.total_wins,
        total_points: school.total_points,
        best_team_rank: school.best_team_rank,
        avg_team_rank: school.avg_team_rank.toFixed(2),
        teams_list: school.teams.map(t => `${t.team_name} (Rank ${t.rank})`).join('; '),
      }));

      return {
        success: true,
        error: null,
        data: exportData,
        type: 'success'
      };
    }

    if (args.ranking_type === "students") {
      const studentResponse = await ctx.runQuery(api.functions.rankings.getStudentRankings, {
        token: args.token,
        tournament_id: args.tournament_id,
        include_elimination: args.include_elimination,
      });

      if (!studentResponse.success) {
        return {
          success: false,
          error: studentResponse.error,
          data: [],
          type: studentResponse.type
        };
      }

      const exportData = studentResponse.data.map(student => ({
        rank: student.rank,
        speaker_name: student.speaker_name,
        speaker_email: student.speaker_email,
        team_name: student.team_name,
        school_name: student.school_name,
        total_speaker_points: student.total_speaker_points,
        average_speaker_score: student.average_speaker_score.toFixed(2),
        team_wins: student.team_wins,
        team_rank: student.team_rank,
        debates_count: student.debates_count,
        avg_position_rank: student.avg_position_rank_in_team.toFixed(2),
        speaking_efficiency: student.speaking_time_efficiency.toFixed(2),
        cross_tournament_participation: student.cross_tournament_performance.tournaments_participated,
      }));

      return {
        success: true,
        error: null,
        data: exportData,
        type: 'success'
      };
    }

    if (args.ranking_type === "volunteers") {
      const volunteerResponse = await ctx.runQuery(api.functions.rankings.getVolunteerRankings, {
        token: args.token,
        tournament_id: args.tournament_id,
      });

      if (!volunteerResponse.success) {
        return {
          success: false,
          error: volunteerResponse.error,
          data: [],
          type: volunteerResponse.type
        };
      }

      const exportData = volunteerResponse.data.map(volunteer => ({
        rank: volunteer.rank,
        volunteer_name: volunteer.volunteer_name,
        volunteer_email: volunteer.volunteer_email,
        school_name: volunteer.school_name,
        total_debates_judged: volunteer.total_debates_judged,
        elimination_debates: volunteer.elimination_debates_judged,
        prelim_debates: volunteer.prelim_debates_judged,
        head_judge_assignments: volunteer.head_judge_assignments,
        avg_feedback_score: volunteer.avg_feedback_score.toFixed(2),
        feedback_count: volunteer.total_feedback_count,
        consistency_score: volunteer.consistency_score.toFixed(2),
        cross_tournament_debates: volunteer.cross_tournament_stats.total_debates_across_tournaments,
      }));

      return {
        success: true,
        error: null,
        data: exportData,
        type: 'success'
      };
    }

    return {
      success: false,
      error: "Invalid ranking type",
      data: [],
      type: 'validation_error'
    };
  },
});