import { mutation, query } from "../../_generated/server";
import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { Doc, Id } from "../../_generated/dataModel";

export const getJudgeAssignedDebates = query({
  args: {
    token: v.string(),
    tournament_id: v.id("tournaments"),
    round_number: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<any[]> => {
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySessionReadOnly, {
      token: args.token,
    });

    if (!sessionResult.valid || !sessionResult.user || sessionResult.user.role !== "volunteer") {
      throw new Error("Volunteer access required");
    }

    const judgeId: Id<"users"> = sessionResult.user.id;

    let debates: Doc<"debates">[];
    if (args.round_number) {
      const round = await ctx.db
        .query("rounds")
        .withIndex("by_tournament_id_round_number", (q) =>
          q.eq("tournament_id", args.tournament_id).eq("round_number", args.round_number as number)
        )
        .first();

      if (round) {
        const allDebatesInRound = await ctx.db
          .query("debates")
          .withIndex("by_round_id", (q) => q.eq("round_id", round._id))
          .collect();

        debates = allDebatesInRound.filter(debate =>
          debate.judges.includes(judgeId)
        );
      } else {
        debates = [];
      }
    } else {
      const allDebates = await ctx.db
        .query("debates")
        .withIndex("by_tournament_id", (q) =>
          q.eq("tournament_id", args.tournament_id)
        )
        .collect();

      debates = allDebates.filter((debate) =>
        debate.judges.includes(judgeId)
      );
    }

    const enrichedDebates = await Promise.all(
      debates.map(async (debate) => {
        const propTeam: Doc<"teams"> | null = debate.proposition_team_id
          ? await ctx.db.get(debate.proposition_team_id)
          : null;
        const oppTeam: Doc<"teams"> | null = debate.opposition_team_id
          ? await ctx.db.get(debate.opposition_team_id)
          : null;

        const round: Doc<"rounds"> | null = await ctx.db.get(debate.round_id);

        const judgeSubmission: Doc<"judging_scores"> | null = await ctx.db
          .query("judging_scores")
          .withIndex("by_debate_id_judge_id", (q) =>
            q.eq("debate_id", debate._id).eq("judge_id", judgeId)
          )
          .first();

        const allSubmissions: Doc<"judging_scores">[] = await ctx.db
          .query("judging_scores")
          .withIndex("by_debate_id", (q) => q.eq("debate_id", debate._id))
          .collect();

        return {
          ...debate,
          round,
          proposition_team: propTeam,
          opposition_team: oppTeam,
          my_submission: judgeSubmission,
          all_submissions_count: allSubmissions.length,
          is_head_judge: debate.head_judge_id === judgeId,
        };
      })
    );

    return enrichedDebates.sort((a, b) => {
      if (!a.round || !b.round) return 0;
      return a.round.round_number - b.round.round_number;
    });
  },
});

export const submitBallot = mutation({
  args: {
    token: v.string(),
    debate_id: v.id("debates"),
    winning_team_id: v.id("teams"),
    winning_position: v.union(v.literal("proposition"), v.literal("opposition")),
    speaker_scores: v.array(v.object({
      speaker_id: v.id("users"),
      team_id: v.id("teams"),
      position: v.string(),
      score: v.number(),
      content_knowledge: v.number(),
      argumentation_logic: v.number(),
      presentation_style: v.number(),
      teamwork_strategy: v.number(),
      rebuttal_response: v.number(),
      comments: v.optional(v.string()),
      clarity: v.optional(v.number()),
      fairness: v.optional(v.number()),
      knowledge: v.optional(v.number()),
      helpfulness: v.optional(v.number()),
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

    if (!sessionResult.valid || !sessionResult.user || sessionResult.user.role !== "volunteer") {
      throw new Error("Volunteer access required");
    }

    const judgeId: Id<"users"> = sessionResult.user.id;

    const debate: Doc<"debates"> | null = await ctx.db.get(args.debate_id);
    if (!debate) {
      throw new Error("Debate not found");
    }

    if (!debate.judges.includes(judgeId)) {
      throw new Error("Not assigned to this debate");
    }

    const existingSubmission: Doc<"judging_scores"> | null = await ctx.db
      .query("judging_scores")
      .withIndex("by_debate_id_judge_id", (q) =>
        q.eq("debate_id", args.debate_id).eq("judge_id", judgeId)
      )
      .first();

    if (existingSubmission?.feedback_submitted) {
      throw new Error("Ballot already submitted and cannot be edited");
    }

    const validateScore = (score: number, field: string): void => {
      if (score < 0 || score > 10) {
        throw new Error(`${field} must be between 0 and 10`);
      }
    };

    const processedSpeakerScores = args.speaker_scores.map(speaker => {

      validateScore(speaker.content_knowledge, "content_knowledge");
      validateScore(speaker.argumentation_logic, "argumentation_logic");
      validateScore(speaker.presentation_style, "presentation_style");
      validateScore(speaker.teamwork_strategy, "teamwork_strategy");
      validateScore(speaker.rebuttal_response, "rebuttal_response");

      const rawScore: number = speaker.content_knowledge + speaker.argumentation_logic +
        speaker.presentation_style + speaker.teamwork_strategy +
        speaker.rebuttal_response;

      const attendanceBonus: number = 5;
      const totalRaw: number = rawScore + attendanceBonus;

      let finalScore: number = (totalRaw / 55) * 30;

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
      judge_id: judgeId,
      winning_team_id: args.winning_team_id,
      winning_position: args.winning_position,
      speaker_scores: processedSpeakerScores,
      notes: args.notes,
      submitted_at: Date.now(),
      feedback_submitted: args.is_final_submission,
    };

    let ballotId: Id<"judging_scores">;

    if (existingSubmission) {

      await ctx.db.patch(existingSubmission._id, ballotData);
      ballotId = existingSubmission._id;

      await ctx.runMutation(internal.functions.audit.createAuditLog, {
        user_id: judgeId,
        action: "ballot_submitted",
        resource_type: "judging_scores",
        resource_id: existingSubmission._id,
        description: args.is_final_submission
          ? "Submitted final ballot"
          : "Updated ballot draft",
      });
    } else {

      ballotId = await ctx.db.insert("judging_scores", ballotData);

      await ctx.runMutation(internal.functions.audit.createAuditLog, {
        user_id: judgeId,
        action: "ballot_submitted",
        resource_type: "judging_scores",
        resource_id: ballotId,
        description: args.is_final_submission
          ? "Submitted final ballot"
          : "Created ballot draft",
      });
    }

    if (args.is_final_submission && debate.head_judge_id === judgeId) {
      await ctx.db.patch(args.debate_id, {
        winning_team_id: args.winning_team_id,
        winning_team_position: args.winning_position,
        status: "completed",
      });
    }

    return { success: true, ballot_id: ballotId };
  },
});

export const getJudgeBallot = query({
  args: {
    token: v.string(),
    debate_id: v.id("debates"),
  },
  handler: async (ctx, args): Promise<Doc<"judging_scores"> | null> => {
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySessionReadOnly, {
      token: args.token,
    });

    if (!sessionResult.valid || !sessionResult.user || sessionResult.user.role !== "volunteer") {
      throw new Error("Volunteer access required");
    }

    const judgeId: Id<"users"> = sessionResult.user.id;

    const debate: Doc<"debates"> | null = await ctx.db.get(args.debate_id);
    if (!debate) {
      throw new Error("Debate not found");
    }

    if (!debate.judges.includes(judgeId)) {
      throw new Error("Not assigned to this debate");
    }

    return await ctx.db
      .query("judging_scores")
      .withIndex("by_debate_id_judge_id", (q) =>
        q.eq("debate_id", args.debate_id).eq("judge_id", judgeId)
      )
      .first();
  },
});

export const getDebateJudgeSubmissions = query({
  args: {
    token: v.string(),
    debate_id: v.id("debates"),
  },
  handler: async (ctx, args): Promise<any[]> => {
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySessionReadOnly, {
      token: args.token,
    });

    if (!sessionResult.valid || !sessionResult.user || sessionResult.user.role !== "volunteer") {
      throw new Error("Volunteer access required");
    }

    const judgeId: Id<"users"> = sessionResult.user.id;

    const debate: Doc<"debates"> | null = await ctx.db.get(args.debate_id);
    if (!debate) {
      throw new Error("Debate not found");
    }

    if (debate.head_judge_id !== judgeId) {
      throw new Error("Only head judge can view all submissions");
    }

    const submissions: Doc<"judging_scores">[] = await ctx.db
      .query("judging_scores")
      .withIndex("by_debate_id", (q) => q.eq("debate_id", args.debate_id))
      .collect();

    return await Promise.all(
      submissions.map(async (submission) => {
        const judge: Doc<"users"> | null = await ctx.db.get(submission.judge_id);
        return {
          ...submission,
          judge_name: judge?.name || "Unknown Judge",
        };
      })
    );
  },
});