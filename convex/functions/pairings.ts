import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { Doc, Id } from "../_generated/dataModel";

interface TeamPairingData {
  _id: Id<"teams">;
  name: string;
  school_id?: Id<"schools">;
  school_name?: string;
  members: Id<"users">[];
  status: string;
  payment_status: string;
  side_history: ('proposition' | 'opposition')[];
  opponents_faced: Id<"teams">[];
  wins: number;
  total_points: number;
  bye_rounds: number[];
  performance_score: number;
  cross_tournament_performance: {
    total_tournaments: number;
    total_wins: number;
    total_debates: number;
    avg_performance: number;
  };
}

interface JudgePairingData {
  _id: Id<"users">;
  name: string;
  email: string;
  school_id?: Id<"schools">;
  school_name?: string;
  total_debates_judged: number;
  elimination_debates: number;
  avg_feedback_score: number;
  conflicts: Id<"teams">[];
  assignments_this_tournament: number;
  cross_tournament_stats: {
    total_tournaments: number;
    total_debates: number;
    total_elimination_debates: number;
    avg_feedback: number;
    consistency_score: number;
  };
}

interface PairingConflict {
  type: 'repeat_opponent' | 'same_school' | 'side_imbalance' | 'judge_conflict' | 'bye_violation' | 'feedback_conflict';
  description: string;
  severity: 'warning' | 'error';
  team_ids?: Id<"teams">[];
  judge_ids?: Id<"users">[];
}

interface PairingResult {
  room_name: string;
  proposition_team_id?: Id<"teams">;
  opposition_team_id?: Id<"teams">;
  judges: Id<"users">[];
  head_judge_id?: Id<"users">;
  is_bye_round: boolean;
  conflicts: PairingConflict[];
  quality_score: number;
}

export const getTournamentPairingData = query({
  args: {
    token: v.string(),
    tournament_id: v.id("tournaments"),
    round_number: v.optional(v.number()),
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

    const league = tournament.league_id ? await ctx.db.get(tournament.league_id) : null;

    const teams = await ctx.db
      .query("teams")
      .withIndex("by_tournament_id_status", (q) =>
        q.eq("tournament_id", args.tournament_id).eq("status", "active")
      )
      .collect();

    const invitations = await ctx.db
      .query("tournament_invitations")
      .withIndex("by_tournament_id_target_type_status", (q) =>
        q.eq("tournament_id", args.tournament_id)
          .eq("target_type", "volunteer")
          .eq("status", "accepted")
      )
      .collect();

    const judgeIds = invitations.map(inv => inv.target_id);
    const judges = await Promise.all(
      judgeIds.map(id => ctx.db.get(id))
    );

    const rounds = await ctx.db
      .query("rounds")
      .withIndex("by_tournament_id", (q) => q.eq("tournament_id", args.tournament_id))
      .collect();

    const debates = await ctx.db
      .query("debates")
      .withIndex("by_tournament_id", (q) => q.eq("tournament_id", args.tournament_id))
      .collect();

    const results = await ctx.db
      .query("tournament_results")
      .withIndex("by_tournament_id", (q) => q.eq("tournament_id", args.tournament_id))
      .collect();

    const judgeFeedback = await ctx.db
      .query("judge_feedback")
      .withIndex("by_tournament_id", (q) => q.eq("tournament_id", args.tournament_id))
      .collect();

    let crossTournamentDebates: Doc<"debates">[] = [];
    let crossTournamentFeedback: Doc<"judge_feedback">[] = [];
    let leagueTournaments: Doc<"tournaments">[] = [];

    if (league) {
      leagueTournaments = await ctx.db
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

    const enrichedTeams: TeamPairingData[] = await Promise.all(
      teams.map(async (team) => {
        const school = team.school_id ? await ctx.db.get(team.school_id) : null;

        const teamDebates = debates
          .filter(d => d.proposition_team_id === team._id || d.opposition_team_id === team._id)
          .sort((a, b) => {
            const roundA = rounds.find(r => r._id === a.round_id)?.round_number || 0;
            const roundB = rounds.find(r => r._id === b.round_id)?.round_number || 0;
            return roundA - roundB;
          });

        const sideHistory: ('proposition' | 'opposition')[] = teamDebates.map(d =>
          d.proposition_team_id === team._id ? 'proposition' : 'opposition'
        );

        const opponentsFaced: Id<"teams">[] = [];
        teamDebates.forEach(d => {
          if (d.proposition_team_id === team._id && d.opposition_team_id) {
            opponentsFaced.push(d.opposition_team_id);
          } else if (d.opposition_team_id === team._id && d.proposition_team_id) {
            opponentsFaced.push(d.proposition_team_id);
          }
        });

        const byeRounds = teamDebates
          .filter(d => d.is_public_speaking)
          .map(d => {
            const round = rounds.find(r => r._id === d.round_id);
            return round?.round_number || 0;
          });

        const teamResult = results.find(r => r.team_id === team._id && r.result_type === "team");
        const wins = teamResult?.wins || 0;
        const totalPoints = teamResult?.team_points || 0;

        let crossTournamentPerformance = {
          total_tournaments: 0,
          total_wins: 0,
          total_debates: 0,
          avg_performance: 0,
        };

        if (league && team.school_id) {

          const schoolTeamsInLeague = new Set<Id<"teams">>();

          for (const leagueTournament of leagueTournaments) {
            const tournamentTeams = await ctx.db
              .query("teams")
              .withIndex("by_tournament_id_school_id", (q) =>
                q.eq("tournament_id", leagueTournament._id).eq("school_id", team.school_id!)
              )
              .collect();

            tournamentTeams.forEach(t => schoolTeamsInLeague.add(t._id));
          }

          const crossResults = await Promise.all(
            Array.from(schoolTeamsInLeague).map(async (teamId) => {
              return await ctx.db
                .query("tournament_results")
                .withIndex("by_team_id", (q) => q.eq("team_id", teamId))
                .filter(q => q.eq(q.field("result_type"), "team"))
                .collect();
            })
          );

          const flatResults = crossResults.flat();
          if (flatResults.length > 0) {
            crossTournamentPerformance = {
              total_tournaments: new Set(flatResults.map(r => r.tournament_id)).size,
              total_wins: flatResults.reduce((sum, r) => sum + (r.wins || 0), 0),
              total_debates: flatResults.length,
              avg_performance: flatResults.reduce((sum, r) => sum + (r.team_points || 0), 0) / flatResults.length,
            };
          }
        }

        return {
          _id: team._id,
          name: team.name,
          school_id: team.school_id,
          school_name: school?.name,
          members: team.members,
          status: team.status,
          payment_status: team.payment_status,
          side_history: sideHistory,
          opponents_faced: opponentsFaced,
          wins,
          total_points: totalPoints,
          bye_rounds: byeRounds,
          performance_score: wins * 100 + totalPoints,
          cross_tournament_performance: crossTournamentPerformance,
        };
      })
    );

    const enrichedJudges: JudgePairingData[] = await Promise.all(
      judges.filter(Boolean).map(async (judge) => {
        const school = judge!.school_id ? await ctx.db.get(judge!.school_id) : null;

        const conflicts: Id<"teams">[] = [];

        if (judge!.school_id) {
          teams.filter(t => t.school_id === judge!.school_id)
            .forEach(t => conflicts.push(t._id));
        }

        const poorFeedback = judgeFeedback.filter(f =>
          f.judge_id === judge!._id &&
          f.bias_detected === true &&
          ((f.clarity + f.fairness + f.knowledge + f.helpfulness) / 4) < 2.5
        );

        poorFeedback.forEach(f => {
          if (!conflicts.includes(f.team_id)) {
            conflicts.push(f.team_id);
          }
        });

        const totalDebatesJudged = debates.filter(d => d.judges.includes(judge!._id)).length;

        const eliminationDebates = debates.filter(d => {
          const round = rounds.find(r => r._id === d.round_id);
          const isElim = round && round.round_number > tournament.prelim_rounds;
          return isElim && d.judges.includes(judge!._id);
        }).length;

        const judgeScores = judgeFeedback.filter(f => f.judge_id === judge!._id);
        const avgFeedbackScore = judgeScores.length > 0
          ? judgeScores.reduce((sum, f) => sum + ((f.clarity + f.fairness + f.knowledge + f.helpfulness) / 4), 0) / judgeScores.length
          : 3.0;

        let crossTournamentStats = {
          total_tournaments: 0,
          total_debates: 0,
          total_elimination_debates: 0,
          avg_feedback: 3.0,
          consistency_score: 1.0,
        };

        if (league) {
          const crossDebates = crossTournamentDebates.filter(d => d.judges.includes(judge!._id));
          const crossFeedback = crossTournamentFeedback.filter(f => f.judge_id === judge!._id);

          if (crossDebates.length > 0) {
            const tournamentIds = new Set(crossDebates.map(d => d.tournament_id));

            crossTournamentStats = {
              total_tournaments: tournamentIds.size,
              total_debates: crossDebates.length,
              total_elimination_debates: crossDebates.filter(d => {

                return !!d.round_id;
              }).length,
              avg_feedback: crossFeedback.length > 0
                ? crossFeedback.reduce((sum, f) => sum + ((f.clarity + f.fairness + f.knowledge + f.helpfulness) / 4), 0) / crossFeedback.length
                : 3.0,
              consistency_score: crossFeedback.length > 0
                ? 1 - (crossFeedback.filter(f => f.bias_detected).length / crossFeedback.length)
                : 1.0,
            };
          }
        }

        return {
          _id: judge!._id,
          name: judge!.name,
          email: judge!.email,
          school_id: judge!.school_id,
          school_name: school?.name,
          total_debates_judged: totalDebatesJudged,
          elimination_debates: eliminationDebates,
          avg_feedback_score: avgFeedbackScore,
          conflicts,
          assignments_this_tournament: totalDebatesJudged,
          cross_tournament_stats: crossTournamentStats,
        };
      })
    );

    const currentRound = args.round_number || (rounds.length + 1);

    return {
      tournament,
      teams: enrichedTeams,
      judges: enrichedJudges,
      rounds: rounds.sort((a, b) => a.round_number - b.round_number),
      debates,
      results,
      current_round: currentRound,
      pairing_method: currentRound <= 5 ? "fold" : "swiss",
      can_generate_all_prelims: tournament.prelim_rounds <= 5,
      cross_tournament_data: {
        league_tournaments: leagueTournaments.length,
        total_debates: crossTournamentDebates.length,
        total_feedback: crossTournamentFeedback.length,
      }
    };
  },
});

export const savePairings = mutation({
  args: {
    token: v.string(),
    tournament_id: v.id("tournaments"),
    round_number: v.number(),
    pairings: v.array(v.object({
      room_name: v.string(),
      proposition_team_id: v.optional(v.id("teams")),
      opposition_team_id: v.optional(v.id("teams")),
      judges: v.array(v.id("users")),
      head_judge_id: v.optional(v.id("users")),
      is_bye_round: v.boolean(),
    })),
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

    const existingRound = await ctx.db
      .query("rounds")
      .withIndex("by_tournament_id_round_number", (q) =>
        q.eq("tournament_id", args.tournament_id).eq("round_number", args.round_number)
      )
      .first();

    let roundId: Id<"rounds">;

    if (existingRound) {
      const existingDebates = await ctx.db
        .query("debates")
        .withIndex("by_round_id", (q) => q.eq("round_id", existingRound._id))
        .collect();

      if (existingDebates.length > 0) {

        const activeDebates = existingDebates.filter(d =>
          d.status === "inProgress" || d.status === "completed"
        );

        if (activeDebates.length > 0) {
          throw new Error(`Cannot overwrite pairings: ${activeDebates.length} debates are in progress or completed`);
        }

        if (tournament.status === "inProgress") {

          if (existingRound.status === "inProgress") {
            throw new Error("Cannot overwrite pairings: Round is currently in progress");
          }
        }

        for (const debate of existingDebates) {
          await ctx.db.delete(debate._id);
        }
      }

      roundId = existingRound._id;
    } else {

      roundId = await ctx.db.insert("rounds", {
        tournament_id: args.tournament_id,
        round_number: args.round_number,
        type: args.round_number <= tournament.prelim_rounds ? "preliminary" : "elimination",
        status: "pending",
        start_time: Date.now() + (24 * 60 * 60 * 1000),
        end_time: Date.now() + (25 * 60 * 60 * 1000),
        motion: "",
        is_impromptu: false,
      });
    }

    const validationErrors: string[] = [];

    const allTeamIds = new Set<Id<"teams">>();
    args.pairings.forEach((pairing, index) => {
      if (pairing.proposition_team_id) {
        if (allTeamIds.has(pairing.proposition_team_id)) {
          validationErrors.push(`Team appears multiple times in pairings (Room ${index + 1})`);
        }
        allTeamIds.add(pairing.proposition_team_id);
      }
      if (pairing.opposition_team_id) {
        if (allTeamIds.has(pairing.opposition_team_id)) {
          validationErrors.push(`Team appears multiple times in pairings (Room ${index + 1})`);
        }
        allTeamIds.add(pairing.opposition_team_id);
      }
    });

    args.pairings.forEach((pairing, index) => {
      if (pairing.proposition_team_id && pairing.opposition_team_id &&
        pairing.proposition_team_id === pairing.opposition_team_id) {
        validationErrors.push(`Team cannot debate itself (Room ${index + 1})`);
      }
    });

    args.pairings.forEach((pairing, index) => {
      if (!pairing.is_bye_round && pairing.judges.length === 0) {
        validationErrors.push(`No judges assigned (Room ${index + 1})`);
      }

      if (pairing.head_judge_id && !pairing.judges.includes(pairing.head_judge_id)) {
        validationErrors.push(`Head judge not in judge list (Room ${index + 1})`);
      }

      if (pairing.judges.length > 1 && pairing.judges.length % 2 === 0 &&
        pairing.judges.length !== tournament.judges_per_debate) {
        validationErrors.push(`Even number of judges detected (Room ${index + 1})`);
      }
    });

    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
    }

    const debateIds: Id<"debates">[] = [];

    for (const pairing of args.pairings) {
      const debateId = await ctx.db.insert("debates", {
        round_id: roundId,
        tournament_id: args.tournament_id,
        room_name: pairing.room_name,
        proposition_team_id: pairing.proposition_team_id,
        opposition_team_id: pairing.opposition_team_id,
        judges: pairing.judges,
        head_judge_id: pairing.head_judge_id,
        status: "pending",
        is_public_speaking: pairing.is_bye_round,
        poi_count: 0,
      });

      debateIds.push(debateId);
    }

    try {
      await ctx.runMutation(internal.functions.notifications.sendTournamentNotification, {
        token: args.token,
        tournament_id: args.tournament_id,
        title: `Round ${args.round_number} Pairings Released`,
        message: `Pairings for Round ${args.round_number} have been published. Check your debate schedule and room assignments!`,
        type: "tournament",
        send_push: true,
      });
    } catch (error) {
      console.warn("Failed to send notifications:", error);
    }

    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: sessionResult.user.id,
      action: "tournament_updated",
      resource_type: "tournaments",
      resource_id: args.tournament_id,
      description: `Created pairings for Round ${args.round_number} (${args.pairings.length} pairings)`,
    });

    return {
      success: true,
      round_id: roundId,
      debate_ids: debateIds,
      notifications_sent: true,
    };
  },
});

export const handleTeamWithdrawal = mutation({
  args: {
    token: v.string(),
    team_id: v.id("teams"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sessionResult = await ctx.runMutation(internal.functions.auth.verifySession, {
      token: args.token,
    });

    if (!sessionResult.valid || sessionResult.user?.role !== "admin") {
      throw new Error("Admin access required");
    }

    const team = await ctx.db.get(args.team_id);
    if (!team) {
      throw new Error("Team not found");
    }

    if (team.status === "withdrawn") {
      throw new Error("Team is already withdrawn");
    }

    const teamSchool = team.school_id ? await ctx.db.get(team.school_id) : null;

    await ctx.db.patch(args.team_id, {
      status: "withdrawn",
      updated_at: Date.now(),
    });

    const pendingDebates = await ctx.db
      .query("debates")
      .withIndex("by_tournament_id_status", (q) =>
        q.eq("tournament_id", team.tournament_id).eq("status", "pending")
      )
      .filter(q =>
        q.or(
          q.eq(q.field("proposition_team_id"), args.team_id),
          q.eq(q.field("opposition_team_id"), args.team_id)
        )
      )
      .collect();

    const affectedDebates = [];
    for (const debate of pendingDebates) {
      const remainingTeamId = debate.proposition_team_id === args.team_id ?
        debate.opposition_team_id : debate.proposition_team_id;

      if (!remainingTeamId) continue;

      const remainingTeam = await ctx.db.get(remainingTeamId);
      const remainingSchool = remainingTeam?.school_id ? await ctx.db.get(remainingTeam.school_id) : null;

      const round = await ctx.db.get(debate.round_id);
      if (!round) continue;

      const roundDebates = await ctx.db
        .query("debates")
        .withIndex("by_round_id", (q) => q.eq("round_id", debate.round_id))
        .collect();

      const hasSchoolByeConflict = remainingSchool && roundDebates.some(d => {
        if (!d.is_public_speaking || d._id === debate._id) return false;

        const psTeamId = d.proposition_team_id;
        if (!psTeamId) return false;

        return false;
      });

      await ctx.db.patch(debate._id, {
        is_public_speaking: true,
        proposition_team_id: remainingTeamId,
        opposition_team_id: undefined,

      });

      affectedDebates.push({
        debate_id: debate._id,
        round_number: round.round_number,
        remaining_team: remainingTeam?.name,
        room_name: debate.room_name,
      });
    }

    try {
      await ctx.runMutation(internal.functions.notifications.sendTournamentNotification, {
        token: args.token,
        tournament_id: team.tournament_id,
        title: "Team Withdrawal",
        message: `Team "${team.name}" has withdrawn from the tournament. Affected pairings have been updated.`,
        type: "tournament",
        send_push: true,
      });
    } catch (error) {
      console.warn("Failed to send withdrawal notification:", error);
    }

    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: sessionResult.user.id,
      action: "team_updated",
      resource_type: "teams",
      resource_id: args.team_id,
      description: `Team withdrawn: ${team.name}${args.reason ? ` - Reason: ${args.reason}` : ''} (${affectedDebates.length} debates affected)`,
    });

    return {
      success: true,
      affected_debates: affectedDebates,
      withdrawal_reason: args.reason,
    };
  },
});

export const updatePairing = mutation({
  args: {
    token: v.string(),
    debate_id: v.id("debates"),
    updates: v.object({
      room_name: v.optional(v.string()),
      judges: v.optional(v.array(v.id("users"))),
      head_judge_id: v.optional(v.id("users")),
      proposition_team_id: v.optional(v.id("teams")),
      opposition_team_id: v.optional(v.id("teams")),
    }),
  },
  handler: async (ctx, args) => {
    const sessionResult = await ctx.runMutation(internal.functions.auth.verifySession, {
      token: args.token,
    });

    if (!sessionResult.valid || sessionResult.user?.role !== "admin") {
      throw new Error("Admin access required");
    }

    const debate = await ctx.db.get(args.debate_id);
    if (!debate) {
      throw new Error("Debate not found");
    }

    if (debate.status !== "pending") {
      throw new Error("Cannot update pairings for debates that have started");
    }

    if (args.updates.judges && args.updates.head_judge_id) {
      if (!args.updates.judges.includes(args.updates.head_judge_id)) {
        throw new Error("Head judge must be in the judges list");
      }
    }

    if (args.updates.proposition_team_id && args.updates.opposition_team_id) {
      if (args.updates.proposition_team_id === args.updates.opposition_team_id) {
        throw new Error("Team cannot debate against itself");
      }
    }

    const previousState = {
      room_name: debate.room_name,
      judges: debate.judges,
      head_judge_id: debate.head_judge_id,
      proposition_team_id: debate.proposition_team_id,
      opposition_team_id: debate.opposition_team_id,
    };

    await ctx.db.patch(args.debate_id, args.updates);

    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: sessionResult.user.id,
      action: "debate_updated",
      resource_type: "debates",
      resource_id: args.debate_id,
      description: `Updated pairing details`,
      previous_state: JSON.stringify(previousState),
      new_state: JSON.stringify(args.updates),
    });

    return { success: true };
  },
});

export const getTournamentPairings = query({
  args: {
    token: v.string(),
    tournament_id: v.id("tournaments"),
    round_number: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySessionReadOnly, {
      token: args.token,
    });

    if (!sessionResult.valid) {
      throw new Error("Authentication required");
    }

    let rounds;
    if (args.round_number) {
      const round = await ctx.db
        .query("rounds")
        .withIndex("by_tournament_id_round_number", (q) =>
          q.eq("tournament_id", args.tournament_id).eq("round_number", args.round_number as number)
        )
        .first();
      rounds = round ? [round] : [];
    } else {
      rounds = await ctx.db
        .query("rounds")
        .withIndex("by_tournament_id", (q) => q.eq("tournament_id", args.tournament_id))
        .collect();
    }

    const enrichedRounds = await Promise.all(
      rounds.map(async (round) => {
        const debates = await ctx.db
          .query("debates")
          .withIndex("by_round_id", (q) => q.eq("round_id", round._id))
          .collect();

        const enrichedDebates = await Promise.all(
          debates.map(async (debate) => {
            const propTeam = debate.proposition_team_id ?
              await ctx.db.get(debate.proposition_team_id) : null;
            const oppTeam = debate.opposition_team_id ?
              await ctx.db.get(debate.opposition_team_id) : null;

            const judges = await Promise.all(
              debate.judges.map(id => ctx.db.get(id))
            );

            const headJudge = debate.head_judge_id ?
              await ctx.db.get(debate.head_judge_id) : null;

            const propSchool = propTeam?.school_id ? await ctx.db.get(propTeam.school_id) : null;
            const oppSchool = oppTeam?.school_id ? await ctx.db.get(oppTeam.school_id) : null;

            const judgeDetails = await Promise.all(
              judges.filter(Boolean).map(async (judge) => {
                const school = judge!.school_id ? await ctx.db.get(judge!.school_id) : null;
                return {
                  ...judge!,
                  school: school ? {
                    _id: school._id,
                    name: school.name,
                    type: school.type,
                  } : null,
                };
              })
            );

            return {
              ...debate,
              proposition_team: propTeam ? {
                ...propTeam,
                school: propSchool ? {
                  _id: propSchool._id,
                  name: propSchool.name,
                  type: propSchool.type,
                } : null,
              } : null,
              opposition_team: oppTeam ? {
                ...oppTeam,
                school: oppSchool ? {
                  _id: oppSchool._id,
                  name: oppSchool.name,
                  type: oppSchool.type,
                } : null,
              } : null,
              judge_details: judgeDetails,
              head_judge: headJudge ? {
                ...headJudge,
                school: headJudge.school_id ? await ctx.db.get(headJudge.school_id) : null,
              } : null,
            };
          })
        );

        enrichedDebates.sort((a, b) => {
          const roomA = a.room_name || '';
          const roomB = b.room_name || '';

          const numA = parseInt(roomA.match(/\d+/)?.[0] || '999');
          const numB = parseInt(roomB.match(/\d+/)?.[0] || '999');

          if (numA !== numB) return numA - numB;
          return roomA.localeCompare(roomB);
        });

        return {
          ...round,
          debates: enrichedDebates,
        };
      })
    );

    return enrichedRounds.sort((a, b) => a.round_number - b.round_number);
  },
});

export const getPairingStats = query({
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

    const debates = await ctx.db
      .query("debates")
      .withIndex("by_tournament_id", (q) => q.eq("tournament_id", args.tournament_id))
      .collect();

    const rounds = await ctx.db
      .query("rounds")
      .withIndex("by_tournament_id", (q) => q.eq("tournament_id", args.tournament_id))
      .collect();

    const teams = await ctx.db
      .query("teams")
      .withIndex("by_tournament_id_status", (q) =>
        q.eq("tournament_id", args.tournament_id).eq("status", "active")
      )
      .collect();

    const matchupMatrix: Record<string, Set<string>> = {};
    teams.forEach(team => {
      matchupMatrix[team._id] = new Set();
    });

    debates.forEach(debate => {
      if (debate.proposition_team_id && debate.opposition_team_id && !debate.is_public_speaking) {
        matchupMatrix[debate.proposition_team_id]?.add(debate.opposition_team_id);
        matchupMatrix[debate.opposition_team_id]?.add(debate.proposition_team_id);
      }
    });

    const sideBalance: Record<string, { prop: number; opp: number; balance_score: number }> = {};
    teams.forEach(team => {
      sideBalance[team._id] = { prop: 0, opp: 0, balance_score: 0 };
    });

    debates.forEach(debate => {
      if (!debate.is_public_speaking) {
        if (debate.proposition_team_id) {
          sideBalance[debate.proposition_team_id].prop++;
        }
        if (debate.opposition_team_id) {
          sideBalance[debate.opposition_team_id].opp++;
        }
      }
    });

    Object.keys(sideBalance).forEach(teamId => {
      const balance = sideBalance[teamId];
      balance.balance_score = Math.abs(balance.prop - balance.opp);
    });

    const byeCount: Record<string, number> = {};
    const byeRounds: Record<string, number[]> = {};
    teams.forEach(team => {
      byeCount[team._id] = 0;
      byeRounds[team._id] = [];
    });

    debates.forEach(debate => {
      if (debate.is_public_speaking && debate.proposition_team_id) {
        byeCount[debate.proposition_team_id]++;

        const round = rounds.find(r => r._id === debate.round_id);
        if (round) {
          byeRounds[debate.proposition_team_id].push(round.round_number);
        }
      }
    });

    const schoolConflicts: Record<string, number> = {};
    debates.forEach(debate => {
      if (!debate.is_public_speaking && debate.proposition_team_id && debate.opposition_team_id) {
        const propTeam = teams.find(t => t._id === debate.proposition_team_id);
        const oppTeam = teams.find(t => t._id === debate.opposition_team_id);

        if (propTeam?.school_id && oppTeam?.school_id && propTeam.school_id === oppTeam.school_id) {
          const schoolId = propTeam.school_id;
          schoolConflicts[schoolId] = (schoolConflicts[schoolId] || 0) + 1;
        }
      }
    });

    const judgeWorkload: Record<string, {
      total_assignments: number;
      head_judge_count: number;
      rounds: number[];
      overload_score: number;
    }> = {};

    debates.forEach(debate => {
      const round = rounds.find(r => r._id === debate.round_id);
      const roundNumber = round?.round_number || 0;

      debate.judges.forEach(judgeId => {
        if (!judgeWorkload[judgeId]) {
          judgeWorkload[judgeId] = {
            total_assignments: 0,
            head_judge_count: 0,
            rounds: [],
            overload_score: 0,
          };
        }

        judgeWorkload[judgeId].total_assignments++;
        judgeWorkload[judgeId].rounds.push(roundNumber);

        if (debate.head_judge_id === judgeId) {
          judgeWorkload[judgeId].head_judge_count++;
        }
      });
    });

    const averageAssignments = Object.values(judgeWorkload).length > 0
      ? Object.values(judgeWorkload).reduce((sum, j) => sum + j.total_assignments, 0) / Object.values(judgeWorkload).length
      : 0;

    Object.keys(judgeWorkload).forEach(judgeId => {
      const workload = judgeWorkload[judgeId];
      workload.overload_score = Math.max(0, workload.total_assignments - averageAssignments);
    });

    const qualityMetrics = {
      repeat_matchups: Object.values(matchupMatrix).reduce((sum, opponents) =>
        sum + Math.max(0, opponents.size - 1), 0),

      side_imbalances: Object.values(sideBalance).filter(b => b.balance_score > 1).length,

      multiple_byes: Object.values(byeCount).filter(count => count > 1).length,

      school_conflicts: Object.values(schoolConflicts).reduce((sum, count) => sum + count, 0),

      judge_overloads: Object.values(judgeWorkload).filter(j => j.overload_score > 2).length,

      total_quality_score: 0,
    };

    qualityMetrics.total_quality_score =
      (qualityMetrics.repeat_matchups * 10) +
      (qualityMetrics.side_imbalances * 5) +
      (qualityMetrics.multiple_byes * 20) +
      (qualityMetrics.school_conflicts * 15) +
      (qualityMetrics.judge_overloads * 3);

    return {
      total_rounds: rounds.length,
      total_teams: teams.length,
      total_debates: debates.length,
      public_speaking_rounds: debates.filter(d => d.is_public_speaking).length,

      matchup_matrix: Object.fromEntries(
        Object.entries(matchupMatrix).map(([teamId, opponents]) => [
          teamId,
          Array.from(opponents)
        ])
      ),

      side_balance: sideBalance,
      bye_distribution: byeCount,
      bye_rounds: byeRounds,
      school_conflicts: schoolConflicts,
      judge_workload: judgeWorkload,
      quality_metrics: qualityMetrics,

      recommendations: generatePairingRecommendations(qualityMetrics, teams.length, rounds.length),
    };
  },
});

export const generateMultiplePrelimRounds = mutation({
  args: {
    token: v.string(),
    tournament_id: v.id("tournaments"),
    rounds_to_generate: v.number(),
    round_type: v.optional(v.union(v.literal("preliminary"), v.literal("elimination")))
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

    const roundType = args.round_type || "preliminary";

    if (roundType === "preliminary") {
      if (args.rounds_to_generate > 5) {
        throw new Error("Can only generate up to 5 preliminary rounds at once using fold system");
      }

      if (args.rounds_to_generate > tournament.prelim_rounds) {
        throw new Error(`Tournament only has ${tournament.prelim_rounds} preliminary rounds`);
      }
    } else if (roundType === "elimination") {

      const prelimRounds = await ctx.db
        .query("rounds")
        .withIndex("by_tournament_id", (q) => q.eq("tournament_id", args.tournament_id))
        .filter(q => q.eq(q.field("type"), "preliminary"))
        .collect();

      const incompletePrelims = prelimRounds.filter(r => r.status !== "completed");
      if (incompletePrelims.length > 0) {
        throw new Error(`Cannot generate elimination rounds: ${incompletePrelims.length} preliminary rounds are not yet completed`);
      }

      if (args.rounds_to_generate > tournament.elimination_rounds) {
        throw new Error(`Tournament only has ${tournament.elimination_rounds} elimination rounds`);
      }

      const results = await ctx.db
        .query("tournament_results")
        .withIndex("by_tournament_id_result_type", (q) =>
          q.eq("tournament_id", args.tournament_id).eq("result_type", "team")
        )
        .collect();

      if (results.length === 0) {
        throw new Error("Cannot generate elimination rounds: No team rankings available. Please calculate preliminary results first.");
      }
    }

    const existingDebates = await ctx.db
      .query("debates")
      .withIndex("by_tournament_id", (q) => q.eq("tournament_id", args.tournament_id))
      .collect();

    const rounds = await ctx.db
      .query("rounds")
      .withIndex("by_tournament_id", (q) => q.eq("tournament_id", args.tournament_id))
      .collect();

    const targetRounds = rounds
      .filter(r => r.type === roundType)
      .sort((a, b) => a.round_number - b.round_number)
      .slice(0, args.rounds_to_generate);

    const roundsWithDebates = targetRounds.filter(round =>
      existingDebates.some(debate => debate.round_id === round._id)
    );

    if (roundsWithDebates.length > 0) {
      throw new Error(`Cannot generate multiple ${roundType} rounds: Some rounds already have pairings`);
    }

    return {
      success: true,
      message: `Ready to generate ${args.rounds_to_generate} ${roundType} rounds`,
      should_generate_on_frontend: true,
      method: roundType === "preliminary" && args.rounds_to_generate <= 5 ? "fold" : "swiss",
      round_type: roundType,
      target_rounds: targetRounds.map(r => ({
        round_id: r._id,
        round_number: r.round_number,
        type: r.type
      }))
    };
  },
});
function generatePairingRecommendations(
  qualityMetrics: any,
  totalTeams: number,
  totalRounds: number
): string[] {
  const recommendations: string[] = [];

  if (qualityMetrics.repeat_matchups > 0) {
    recommendations.push(`${qualityMetrics.repeat_matchups} repeat matchups detected. Consider using Swiss system for future rounds.`);
  }

  if (qualityMetrics.side_imbalances > totalTeams * 0.3) {
    recommendations.push("High side imbalance detected. Review side assignment algorithm.");
  }

  if (qualityMetrics.multiple_byes > 0) {
    recommendations.push(`${qualityMetrics.multiple_byes} teams have multiple bye rounds. Ensure fair distribution.`);
  }

  if (qualityMetrics.school_conflicts > 0) {
    recommendations.push(`${qualityMetrics.school_conflicts} same-school matchups found. Review pairing constraints.`);
  }

  if (qualityMetrics.judge_overloads > 0) {
    recommendations.push("Some judges are overloaded. Consider recruiting more volunteers.");
  }

  if (totalRounds > 5 && qualityMetrics.repeat_matchups === 0) {
    recommendations.push("Excellent pairing quality maintained beyond round 5!");
  }

  if (qualityMetrics.total_quality_score === 0) {
    recommendations.push("Perfect pairing quality achieved!");
  } else if (qualityMetrics.total_quality_score < 20) {
    recommendations.push("Good pairing quality with minor issues.");
  } else if (qualityMetrics.total_quality_score < 50) {
    recommendations.push("Moderate pairing quality. Consider algorithm adjustments.");
  } else {
    recommendations.push("Poor pairing quality. Manual intervention recommended.");
  }

  return recommendations;
}

export const validatePairingConflicts = query({
  args: {
    token: v.string(),
    tournament_id: v.id("tournaments"),
    proposition_team_id: v.optional(v.id("teams")),
    opposition_team_id: v.optional(v.id("teams")),
    judges: v.array(v.id("users")),
    round_number: v.number(),
  },
  handler: async (ctx, args) => {
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySessionReadOnly, {
      token: args.token,
    });

    if (!sessionResult.valid || sessionResult.user?.role !== "admin") {
      throw new Error("Admin access required");
    }

    const conflicts: PairingConflict[] = [];

    if (!args.proposition_team_id && !args.opposition_team_id) {
      return conflicts;
    }

    const propTeam = args.proposition_team_id ? await ctx.db.get(args.proposition_team_id) : null;
    const oppTeam = args.opposition_team_id ? await ctx.db.get(args.opposition_team_id) : null;

    if (args.proposition_team_id === args.opposition_team_id) {
      conflicts.push({
        type: 'same_school',
        description: 'Team cannot debate against itself',
        severity: 'error',
        team_ids: [args.proposition_team_id!],
      });
    }

    if (propTeam && oppTeam && propTeam.school_id && propTeam.school_id === oppTeam.school_id) {
      const school = await ctx.db.get(propTeam.school_id);
      conflicts.push({
        type: 'same_school',
        description: `Both teams are from ${school?.name || 'the same school'}`,
        severity: 'warning',
        team_ids: [propTeam._id, oppTeam._id],
      });
    }

    if (propTeam && oppTeam) {
      const existingDebates = await ctx.db
        .query("debates")
        .withIndex("by_tournament_id", (q) => q.eq("tournament_id", args.tournament_id))
        .collect();

      const hasMetBefore = existingDebates.some(d =>
        (d.proposition_team_id === propTeam._id && d.opposition_team_id === oppTeam._id) ||
        (d.proposition_team_id === oppTeam._id && d.opposition_team_id === propTeam._id)
      );

      if (hasMetBefore) {
        conflicts.push({
          type: 'repeat_opponent',
          description: `${propTeam.name} and ${oppTeam.name} have faced each other before`,
          severity: 'error',
          team_ids: [propTeam._id, oppTeam._id],
        });
      }
    }

    for (const judgeId of args.judges) {
      const judge = await ctx.db.get(judgeId);
      if (!judge) continue;

      if (judge.school_id) {
        if (propTeam?.school_id === judge.school_id) {
          const school = await ctx.db.get(judge.school_id);
          conflicts.push({
            type: 'judge_conflict',
            description: `Judge ${judge.name} is from the same school as proposition team (${school?.name})`,
            severity: 'error',
            judge_ids: [judgeId],
            team_ids: propTeam ? [propTeam._id] : undefined,
          });
        }

        if (oppTeam?.school_id === judge.school_id) {
          const school = await ctx.db.get(judge.school_id);
          conflicts.push({
            type: 'judge_conflict',
            description: `Judge ${judge.name} is from the same school as opposition team (${school?.name})`,
            severity: 'error',
            judge_ids: [judgeId],
            team_ids: oppTeam ? [oppTeam._id] : undefined,
          });
        }
      }

      const poorFeedback = await ctx.db
        .query("judge_feedback")
        .withIndex("by_judge_id", (q) => q.eq("judge_id", judgeId))
        .filter(q => q.eq(q.field("bias_detected"), true))
        .collect();

      const conflictTeams = poorFeedback.filter(f =>
        (propTeam && f.team_id === propTeam._id) ||
        (oppTeam && f.team_id === oppTeam._id)
      );

      conflictTeams.forEach(feedback => {
        const teamName = feedback.team_id === propTeam?._id ? propTeam?.name : oppTeam?.name;
        conflicts.push({
          type: 'feedback_conflict',
          description: `Judge ${judge.name} has received bias complaints from ${teamName}`,
          severity: 'warning',
          judge_ids: [judgeId],
          team_ids: [feedback.team_id],
        });
      });
    }

    if (args.judges.length === 0) {
      conflicts.push({
        type: 'judge_conflict',
        description: 'No judges assigned to this debate',
        severity: 'error',
      });
    } else if (args.judges.length % 2 === 0 && args.judges.length > 1) {
      conflicts.push({
        type: 'judge_conflict',
        description: `Even number of judges (${args.judges.length}) may cause tie decisions`,
        severity: 'warning',
        judge_ids: args.judges,
      });
    }

    return conflicts;
  },
});

export const checkPreliminariesComplete = query({
  args: {
    token: v.string(),
    tournament_id: v.id("tournaments"),
  },
  handler: async (ctx, args) => {
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySessionReadOnly, {
      token: args.token,
    });

    if (!sessionResult.valid) {
      throw new Error("Authentication required");
    }

    const tournament = await ctx.db.get(args.tournament_id);
    if (!tournament) {
      throw new Error("Tournament not found");
    }

    const prelimRounds = await ctx.db
      .query("rounds")
      .withIndex("by_tournament_id", (q) => q.eq("tournament_id", args.tournament_id))
      .filter(q => q.eq(q.field("type"), "preliminary"))
      .collect();

    const incompleteRounds = prelimRounds.filter(r => r.status !== "completed");

    return {
      total_prelims: tournament.prelim_rounds,
      completed_prelims: prelimRounds.length - incompleteRounds.length,
      all_complete: incompleteRounds.length === 0,
      incomplete_rounds: incompleteRounds.map(r => ({
        round_number: r.round_number,
        status: r.status
      }))
    };
  },
});