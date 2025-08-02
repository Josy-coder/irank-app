import { mutation, query } from "../../_generated/server";
import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { Id, Doc } from "../../_generated/dataModel";
import { paginationOptsValidator } from "convex/server";

export const getAllTournamentBallots = query({
  args: {
    token: v.string(),
    tournament_id: v.id("tournaments"),
    round_number: v.optional(v.number()),
    status_filter: v.optional(v.union(
      v.literal("pending"),
      v.literal("inProgress"),
      v.literal("completed"),
      v.literal("noShow")
    )),
    search: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args): Promise<any> => {
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySessionReadOnly, {
      token: args.token,
    });

    if (!sessionResult.valid || !sessionResult.user || sessionResult.user.role !== "admin") {
      throw new Error("Admin access required");
    }

    let debatesQuery;
    if (args.round_number) {
      const round: Doc<"rounds"> | null = await ctx.db
        .query("rounds")
        .withIndex("by_tournament_id_round_number", (q) =>
          q.eq("tournament_id", args.tournament_id).eq("round_number", args.round_number as number)
        )
        .first();

      if (round) {
        debatesQuery = ctx.db
          .query("debates")
          .withIndex("by_round_id", (q) => q.eq("round_id", round._id));
      } else {
        return {
          page: [],
          isDone: true,
          continueCursor: null,
        };
      }
    } else {
      debatesQuery = ctx.db
        .query("debates")
        .withIndex("by_tournament_id", (q) => q.eq("tournament_id", args.tournament_id));
    }

    if (args.status_filter) {
      debatesQuery = debatesQuery.filter(d => d.eq(d.field("status"), args.status_filter));
    }

    const paginatedResult = await debatesQuery.paginate(args.paginationOpts);

    const enrichedDebates = await Promise.all(
      paginatedResult.page.map(async (debate) => {
        const propTeam: Doc<"teams"> | null = debate.proposition_team_id
          ? await ctx.db.get(debate.proposition_team_id)
          : null;
        const oppTeam: Doc<"teams"> | null = debate.opposition_team_id
          ? await ctx.db.get(debate.opposition_team_id)
          : null;

        const round: Doc<"rounds"> | null = await ctx.db.get(debate.round_id);

        const submissions: Doc<"judging_scores">[] = await ctx.db
          .query("judging_scores")
          .withIndex("by_debate_id", (q) => q.eq("debate_id", debate._id))
          .collect();

        const judges = await Promise.all(
          debate.judges.map(async (judgeId: Id<"users">) => {
            const judge: Doc<"users"> | null = await ctx.db.get(judgeId);
            const submission: Doc<"judging_scores"> | undefined = submissions.find(s => s.judge_id === judgeId);
            return {
              ...judge,
              has_submitted: !!submission,
              is_final: submission?.feedback_submitted || false,
              is_head_judge: debate.head_judge_id === judgeId,
              is_flagged: submission?.notes?.includes("[FLAG:") || submission?.notes?.includes("[JUDGE FLAG:") || false,
            };
          })
        );

        const judgesBallots = await Promise.all(
          debate.judges.map(async (judgeId: Id<"users">) => {
            const submission: Doc<"judging_scores"> | null = await ctx.db
              .query("judging_scores")
              .withIndex("by_debate_id_judge_id", (q) =>
                q.eq("debate_id", debate._id).eq("judge_id", judgeId)
              )
              .first();
            return {
              judge_id: judgeId,
              ballot: submission,
            };
          })
        );

        const completionPercentage: number = debate.judges.length > 0
          ? (submissions.filter(s => s.feedback_submitted).length / debate.judges.length) * 100
          : 0;

        return {
          ...debate,
          round,
          proposition_team: propTeam,
          opposition_team: oppTeam,
          judges,
          judges_ballots: judgesBallots,
          submissions_count: submissions.length,
          final_submissions_count: submissions.filter(s => s.feedback_submitted).length,
          completion_percentage: completionPercentage,
          has_flagged_ballots: submissions.some(s =>
            s.notes?.includes("[FLAG:") || s.notes?.includes("[JUDGE FLAG:")
          ),
          argument_flow: debate.argument_flow || [],
          fact_checks: debate.fact_checks || [],
          shared_notes: debate.shared_notes || [],
        };
      })
    );

    let filteredPage = enrichedDebates;
    if (args.search && args.search.trim()) {
      const searchLower = args.search.toLowerCase();
      filteredPage = enrichedDebates.filter(debate => {
        const roomName = debate.room_name?.toLowerCase() || '';
        const propTeamName = debate.proposition_team?.name?.toLowerCase() || '';
        const oppTeamName = debate.opposition_team?.name?.toLowerCase() || '';
        const judgeNames = debate.judges?.map(j => j.name?.toLowerCase()).join(' ') || '';

        return roomName.includes(searchLower) ||
          propTeamName.includes(searchLower) ||
          oppTeamName.includes(searchLower) ||
          judgeNames.includes(searchLower);
      });
    }

    const sortedPage = filteredPage.sort((a, b) => {
      if (!a.round || !b.round) return 0;
      return a.round.round_number - b.round.round_number;
    });

    return {
      ...paginatedResult,
      page: sortedPage,
    };
  },
});

const checkAndUpdateRoundCompletion = async (ctx: any, roundId: Id<"rounds">) => {
  const round = await ctx.db.get(roundId);
  if (!round || round.status === "completed") return;

  const roundDebates = await ctx.db
    .query("debates")
    .withIndex("by_round_id", (q: any) => q.eq("round_id", roundId))
    .collect();

  if (roundDebates.length === 0) return;

  const allDebatesCompleted = roundDebates.every((debate: any) => {
    return debate.status === "completed" && debate.winning_team_id;
  });

  let allBallotsSubmitted = true;
  for (const debate of roundDebates) {
    if (debate.judges && debate.judges.length > 0) {
      const submissions = await ctx.db
        .query("judging_scores")
        .withIndex("by_debate_id", (q: any) => q.eq("debate_id", debate._id))
        .filter((q: any) => q.eq(q.field("feedback_submitted"), true))
        .collect();

      if (submissions.length < debate.judges.length) {
        allBallotsSubmitted = false;
        break;
      }
    }
  }

  if (allDebatesCompleted && allBallotsSubmitted) {
    await ctx.db.patch(roundId, {
      status: "completed",
      end_time: Date.now(),
      updated_at: Date.now(),
    });

    console.log(`Round ${round.round_number} marked as completed - all debates finished and ballots submitted`);
  }
};


const updateDebateResults = async (ctx: any, debateId: Id<"debates">) => {
  const submissions = await ctx.db
    .query("judging_scores")
    .withIndex("by_debate_id", (q: { eq: (arg0: string, arg1: Id<"debates">) => any; }) => q.eq("debate_id", debateId))
    .filter((q: any) => q.eq(q.field("feedback_submitted"), true))
    .collect();

  if (submissions.length === 0) return;

  const debate = await ctx.db.get(debateId);
  if (!debate) return;

  const propVotes = submissions.filter((s: { winning_position: string; }) => s.winning_position === "proposition").length;
  const oppVotes = submissions.filter((s: { winning_position: string; }) => s.winning_position === "opposition").length;

  let winningTeamId: Id<"teams"> | undefined;
  let winningPosition: "proposition" | "opposition" | undefined;

  if (propVotes > oppVotes) {
    winningTeamId = debate.proposition_team_id;
    winningPosition = "proposition";
  } else if (oppVotes > propVotes) {
    winningTeamId = debate.opposition_team_id;
    winningPosition = "opposition";
  }

  const teamPoints = new Map<Id<"teams">, number>();
  submissions.forEach((submission: { speaker_scores: any[]; }) => {
    submission.speaker_scores.forEach(speakerScore => {
      const currentPoints = teamPoints.get(speakerScore.team_id) || 0;
      teamPoints.set(speakerScore.team_id, currentPoints + speakerScore.score);
    });
  });

  const avgTeamPoints = new Map<Id<"teams">, number>();
  teamPoints.forEach((totalPoints, teamId) => {
    avgTeamPoints.set(teamId, totalPoints / submissions.length);
  });

  await ctx.db.patch(debateId, {
    winning_team_id: winningTeamId,
    winning_team_position: winningPosition,
    proposition_votes: propVotes,
    opposition_votes: oppVotes,
    proposition_team_points: debate.proposition_team_id
      ? avgTeamPoints.get(debate.proposition_team_id) || 0
      : undefined,
    opposition_team_points: debate.opposition_team_id
      ? avgTeamPoints.get(debate.opposition_team_id) || 0
      : undefined,
    status: "completed",
    updated_at: Date.now(),
  });

  await checkAndUpdateRoundCompletion(ctx, debate.round_id);
};

export const updateBallot = mutation({
  args: {
    token: v.string(),
    ballot_id: v.id("judging_scores"),
    updates: v.object({
      winning_team_id: v.optional(v.id("teams")),
      winning_position: v.optional(v.union(v.literal("proposition"), v.literal("opposition"))),
      speaker_scores: v.optional(v.array(v.object({
        speaker_id: v.id("users"),
        team_id: v.id("teams"),
        position: v.string(),
        score: v.number(),
        role_fulfillment: v.number(),
        argumentation_clash: v.number(),
        content_development: v.number(),
        style_strategy_delivery: v.number(),
        comments: v.optional(v.string()),
        bias_detected: v.optional(v.boolean()),
        bias_explanation: v.optional(v.string()),
      }))),
      notes: v.optional(v.string()),
      feedback_submitted: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    const sessionResult = await ctx.runMutation(internal.functions.auth.verifySession, {
      token: args.token,
    });

    if (!sessionResult.valid || !sessionResult.user || sessionResult.user.role !== "admin") {
      throw new Error("Admin access required");
    }

    const ballot: Doc<"judging_scores"> | null = await ctx.db.get(args.ballot_id);
    if (!ballot) {
      throw new Error("Ballot not found");
    }

    const validateScore = (score: number, field: string): void => {
      if (score < 0 || score > 25) {
        throw new Error(`${field} must be between 0 and 25`);
      }
    };

    let processedSpeakerScores: typeof args.updates.speaker_scores = [];

    if (args.updates.speaker_scores) {
      processedSpeakerScores = args.updates.speaker_scores.map(speaker => {
        validateScore(speaker.role_fulfillment, "role_fulfillment");
        validateScore(speaker.argumentation_clash, "argumentation_clash");
        validateScore(speaker.content_development, "content_development");
        validateScore(speaker.style_strategy_delivery, "style_strategy_delivery");

        const rubricScore = speaker.role_fulfillment +
          speaker.argumentation_clash +
          speaker.content_development +
          speaker.style_strategy_delivery;

        const attendanceBonus = 5;
        const totalRaw = rubricScore + attendanceBonus;

        let finalScore = (totalRaw / 105) * 30;
        if (finalScore < 16.3) finalScore = 16.3;

        return {
          ...speaker,
          score: Math.round(finalScore * 10) / 10,
        };
      });
    }

    await ctx.db.patch(args.ballot_id, {
      ...args.updates,
      speaker_scores: args.updates.speaker_scores ? processedSpeakerScores : undefined,
      updated_at: Date.now(),
    });

    if (args.updates.feedback_submitted) {
      await updateDebateResults(ctx, ballot.debate_id);
    }

    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: sessionResult.user.id,
      action: "ballot_submitted",
      resource_type: "judging_scores",
      resource_id: args.ballot_id,
      description: "Admin updated ballot",
    });

    return { success: true };
  },
});

export const flagBallotForReview = mutation({
  args: {
    token: v.string(),
    ballot_id: v.id("judging_scores"),
    reason: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    const sessionResult = await ctx.runMutation(internal.functions.auth.verifySession, {
      token: args.token,
    });

    if (!sessionResult.valid || !sessionResult.user || sessionResult.user.role !== "admin") {
      throw new Error("Admin access required");
    }

    const ballot: Doc<"judging_scores"> | null = await ctx.db.get(args.ballot_id);
    if (!ballot) {
      throw new Error("Ballot not found");
    }

    const currentNotes: string = ballot.notes || "";
    const flaggedNotes: string = currentNotes + `\n[ADMIN FLAG: ${args.reason}]`;

    await ctx.db.patch(args.ballot_id, {
      notes: flaggedNotes,
      updated_at: Date.now(),
    });

    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: sessionResult.user.id,
      action: "ballot_submitted",
      resource_type: "judging_scores",
      resource_id: args.ballot_id,
      description: `Flagged ballot for review: ${args.reason}`,
    });

    return { success: true };
  },
});

export const unflagBallot = mutation({
  args: {
    token: v.string(),
    ballot_id: v.id("judging_scores"),
  },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    const sessionResult = await ctx.runMutation(internal.functions.auth.verifySession, {
      token: args.token,
    });

    if (!sessionResult.valid || !sessionResult.user || sessionResult.user.role !== "admin") {
      throw new Error("Admin access required");
    }

    const ballot: Doc<"judging_scores"> | null = await ctx.db.get(args.ballot_id);
    if (!ballot) {
      throw new Error("Ballot not found");
    }

    const currentNotes: string = ballot.notes || "";
    const unflaggedNotes: string = currentNotes
      .replace(/\n\[ADMIN FLAG:.*?]/g, '')
      .replace(/\n\[JUDGE FLAG:.*?]/g, '')
      .trim();

    await ctx.db.patch(args.ballot_id, {
      notes: unflaggedNotes,
      updated_at: Date.now(),
    });

    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: sessionResult.user.id,
      action: "ballot_submitted",
      resource_type: "judging_scores",
      resource_id: args.ballot_id,
      description: "Admin unflagged ballot",
    });

    return { success: true };
  },
});

export const submitBallot = mutation({
  args: {
    token: v.string(),
    debate_id: v.id("debates"),
    judge_id: v.id("users"),
    winning_team_id: v.id("teams"),
    winning_position: v.union(v.literal("proposition"), v.literal("opposition")),
    speaker_scores: v.array(v.object({
      speaker_id: v.id("users"),
      team_id: v.id("teams"),
      position: v.string(),
      score: v.number(),
      role_fulfillment: v.number(),
      argumentation_clash: v.number(),
      content_development: v.number(),
      style_strategy_delivery: v.number(),
      comments: v.optional(v.string()),
      bias_detected: v.optional(v.boolean()),
      bias_explanation: v.optional(v.string()),
    })),
    notes: v.optional(v.string()),
    is_final_submission: v.boolean(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; ballot_id: Id<"judging_scores"> }> => {
    const sessionResult = await ctx.runMutation(internal.functions.auth.verifySession, {
      token: args.token,
    });

    if (!sessionResult.valid || !sessionResult.user || sessionResult.user.role !== "admin") {
      throw new Error("Admin access required");
    }

    const debate: Doc<"debates"> | null = await ctx.db.get(args.debate_id);
    if (!debate) {
      throw new Error("Debate not found");
    }

    if (!debate.judges.includes(args.judge_id)) {
      throw new Error("Judge not assigned to this debate");
    }

    const existingSubmission: Doc<"judging_scores"> | null = await ctx.db
      .query("judging_scores")
      .withIndex("by_debate_id_judge_id", (q) =>
        q.eq("debate_id", args.debate_id).eq("judge_id", args.judge_id)
      )
      .first();

    if (existingSubmission?.feedback_submitted) {
      throw new Error("Final ballot already submitted for this judge");
    }

    const validateScore = (score: number, field: string): void => {
      if (score < 0 || score > 25) {
        throw new Error(`${field} must be between 0 and 25`);
      }
    };

    const processedSpeakerScores = args.speaker_scores.map(speaker => {
      validateScore(speaker.role_fulfillment, "role_fulfillment");
      validateScore(speaker.argumentation_clash, "argumentation_clash");
      validateScore(speaker.content_development, "content_development");
      validateScore(speaker.style_strategy_delivery, "style_strategy_delivery");

      const rubricScore: number = speaker.role_fulfillment + speaker.argumentation_clash +
        speaker.content_development + speaker.style_strategy_delivery;

      const attendanceBonus: number = 5;
      const totalRaw: number = rubricScore + attendanceBonus;

      let finalScore: number = (totalRaw / 105) * 30;

      if (finalScore < 16.3) {
        finalScore = 16.3;
      }

      return {
        ...speaker,
        score: Math.round(finalScore * 10) / 10,
      };
    });

    const ballotData = {
      debate_id: args.debate_id,
      judge_id: args.judge_id,
      winning_team_id: args.winning_team_id,
      winning_position: args.winning_position,
      speaker_scores: processedSpeakerScores,
      notes: args.notes,
      submitted_at: Date.now(),
      feedback_submitted: args.is_final_submission,
      created_at: Date.now(),
    };

    let ballotId: Id<"judging_scores">;

    if (existingSubmission) {
      await ctx.db.patch(existingSubmission._id, {
        ...ballotData,
        updated_at: Date.now(),
      });
      ballotId = existingSubmission._id;
    } else {
      ballotId = await ctx.db.insert("judging_scores", ballotData);
    }

    if (args.is_final_submission) {
      await updateDebateResults(ctx, args.debate_id);
    }

    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: sessionResult.user.id,
      action: "ballot_submitted",
      resource_type: "judging_scores",
      resource_id: ballotId,
      description: `Admin ${args.is_final_submission ? 'submitted' : 'updated'} ballot for judge ${args.judge_id}`,
    });

    return { success: true, ballot_id: ballotId };
  },
});