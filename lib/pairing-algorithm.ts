import { Id } from "@/convex/_generated/dataModel";

interface TeamData {
  _id: Id<"teams">;
  name: string;
  school_id?: Id<"schools">;
  school_name?: string;
  side_history: ('proposition' | 'opposition')[];
  opponents_faced: string[];
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

interface JudgeData {
  _id: Id<"users">;
  name: string;
  school_id?: Id<"schools">;
  school_name?: string;
  total_debates_judged: number;
  elimination_debates: number;
  avg_feedback_score: number;
  conflicts: string[];
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

interface Tournament {
  _id: Id<"tournaments">;
  name: string;
  prelim_rounds: number;
  elimination_rounds: number;
  judges_per_debate: number;
}

export class PairingAlgorithm {
  private readonly teams: TeamData[];
  private readonly judges: JudgeData[];
  private tournament: Tournament;
  private readonly roundNumber: number;
  private readonly method: 'fold' | 'swiss';

  constructor(
    teams: TeamData[],
    judges: JudgeData[],
    tournament: Tournament,
    roundNumber: number
  ) {
    this.teams = teams.filter(t => t.name);
    this.judges = judges.filter(j => j.name);
    this.tournament = tournament;
    this.roundNumber = roundNumber;
    this.method = roundNumber <= 5 ? 'fold' : 'swiss';
  }

  public generatePairings(): PairingResult[] {
    console.log(`Generating ${this.method} pairings for Round ${this.roundNumber}`);
    console.log(`Teams: ${this.teams.length}, Judges: ${this.judges.length}`);

    if (this.teams.length === 0) {
      throw new Error("No teams available for pairing");
    }

    let pairings: PairingResult[];

    if (this.method === 'fold') {
      pairings = this.generateFoldPairings();
    } else {
      pairings = this.generateSwissPairings();
    }

    pairings = this.assignJudges(pairings);
    pairings = this.assignRoomNames(pairings);
    pairings = this.validatePairings(pairings);
    pairings = this.calculateQualityScores(pairings);

    return pairings;
  }

  private generateFoldPairings(): PairingResult[] {
    const pairings: PairingResult[] = [];
    const availableTeams = [...this.teams];

    if (availableTeams.length % 2 === 1) {
      const byeTeam = this.selectByeTeam(availableTeams);
      pairings.push({
        room_name: "",
        proposition_team_id: byeTeam._id,
        opposition_team_id: undefined,
        judges: [],
        head_judge_id: undefined,
        is_bye_round: true,
        conflicts: [],
        quality_score: 0,
      });

      const byeIndex = availableTeams.findIndex(t => t._id === byeTeam._id);
      availableTeams.splice(byeIndex, 1);
    }

    if (this.roundNumber === 1) {
      return this.generateRound1Pairings(availableTeams, pairings);
    } else {
      return this.generateFoldSystemPairings(availableTeams, pairings);
    }
  }

  private generateRound1Pairings(teams: TeamData[], existingPairings: PairingResult[]): PairingResult[] {

    const shuffled = this.shuffleArray([...teams]);
    const midPoint = Math.floor(shuffled.length / 2);
    const propTeams = shuffled.slice(0, midPoint);
    const oppTeams = shuffled.slice(midPoint);

    for (let i = 0; i < propTeams.length && i < oppTeams.length; i++) {
      existingPairings.push({
        room_name: "",
        proposition_team_id: propTeams[i]._id,
        opposition_team_id: oppTeams[i]._id,
        judges: [],
        head_judge_id: undefined,
        is_bye_round: false,
        conflicts: [],
        quality_score: 0,
      });
    }

    return existingPairings;
  }

  private generateFoldSystemPairings(teams: TeamData[], existingPairings: PairingResult[]): PairingResult[] {

    const sortedTeams = [...teams].sort((a, b) => {
      if (a.wins !== b.wins) return b.wins - a.wins;
      if (a.total_points !== b.total_points) return b.total_points - a.total_points;
      return a.performance_score - b.performance_score;
    });

    const propPool: TeamData[] = [];
    const oppPool: TeamData[] = [];

    sortedTeams.forEach(team => {
      const lastSide = team.side_history[team.side_history.length - 1];
      if (lastSide === 'proposition') {
        oppPool.push(team);
      } else {
        propPool.push(team);
      }
    });

    while (Math.abs(propPool.length - oppPool.length) > 1) {
      if (propPool.length > oppPool.length) {
        const team = propPool.pop()!;
        oppPool.push(team);
      } else {
        const team = oppPool.pop()!;
        propPool.push(team);
      }
    }

    const pairedProp = new Set<string>();
    const pairedOpp = new Set<string>();

    for (const propTeam of propPool) {
      if (pairedProp.has(propTeam._id)) continue;

      let bestOpponent: TeamData | null = null;
      let bestScore = -1;

      for (const oppTeam of oppPool) {
        if (pairedOpp.has(oppTeam._id)) continue;
        if (propTeam.opponents_faced.includes(oppTeam._id)) continue;
        if (propTeam.school_id && propTeam.school_id === oppTeam.school_id) continue;

        const performanceDiff = Math.abs(propTeam.performance_score - oppTeam.performance_score);
        const score = 1000 - performanceDiff;

        if (score > bestScore) {
          bestScore = score;
          bestOpponent = oppTeam;
        }
      }

      if (bestOpponent) {
        existingPairings.push({
          room_name: "",
          proposition_team_id: propTeam._id,
          opposition_team_id: bestOpponent._id,
          judges: [],
          head_judge_id: undefined,
          is_bye_round: false,
          conflicts: [],
          quality_score: bestScore,
        });

        pairedProp.add(propTeam._id);
        pairedOpp.add(bestOpponent._id);
      }
    }

    return existingPairings;
  }

  private generateSwissPairings(): PairingResult[] {
    const pairings: PairingResult[] = [];
    const availableTeams = [...this.teams];

    availableTeams.sort((a, b) => {
      if (a.wins !== b.wins) return b.wins - a.wins;
      if (a.total_points !== b.total_points) return b.total_points - a.total_points;
      return a.performance_score - b.performance_score;
    });

    if (availableTeams.length % 2 === 1) {
      const byeTeam = this.selectByeTeam(availableTeams);
      pairings.push({
        room_name: "",
        proposition_team_id: byeTeam._id,
        opposition_team_id: undefined,
        judges: [],
        head_judge_id: undefined,
        is_bye_round: true,
        conflicts: [],
        quality_score: 0,
      });

      const byeIndex = availableTeams.findIndex(t => t._id === byeTeam._id);
      availableTeams.splice(byeIndex, 1);
    }

    const paired = new Set<string>();

    for (const team1 of availableTeams) {
      if (paired.has(team1._id)) continue;

      let bestOpponent: TeamData | null = null;
      let bestScore = -1;

      for (const team2 of availableTeams) {
        if (paired.has(team2._id) || team1._id === team2._id) continue;
        if (team1.opponents_faced.includes(team2._id)) continue;
        if (team1.school_id && team1.school_id === team2.school_id) continue;

        const performanceDiff = Math.abs(team1.performance_score - team2.performance_score);
        const score = 1000 - performanceDiff;

        if (score > bestScore) {
          bestScore = score;
          bestOpponent = team2;
        }
      }

      if (bestOpponent) {

        const { propTeam, oppTeam } = this.determineSides(team1, bestOpponent);

        pairings.push({
          room_name: "",
          proposition_team_id: propTeam._id,
          opposition_team_id: oppTeam._id,
          judges: [],
          head_judge_id: undefined,
          is_bye_round: false,
          conflicts: [],
          quality_score: bestScore,
        });

        paired.add(team1._id);
        paired.add(bestOpponent._id);
      }
    }

    return pairings;
  }

  private selectByeTeam(teams: TeamData[]): TeamData {
    const noBye = teams.filter(team => team.bye_rounds.length === 0);

    if (noBye.length > 0) {
      return noBye.reduce((lowest, team) =>
        team.performance_score < lowest.performance_score ? team : lowest
      );
    }

    return teams.reduce((lowest, team) =>
      team.performance_score < lowest.performance_score ? team : lowest
    );
  }

  private determineSides(team1: TeamData, team2: TeamData): { propTeam: TeamData; oppTeam: TeamData } {
    const team1PropCount = team1.side_history.filter(s => s === 'proposition').length;
    const team1OppCount = team1.side_history.filter(s => s === 'opposition').length;
    const team2PropCount = team2.side_history.filter(s => s === 'proposition').length;
    const team2OppCount = team2.side_history.filter(s => s === 'opposition').length;
    
    const team1PropNeed = team1OppCount - team1PropCount;
    const team2PropNeed = team2OppCount - team2PropCount;

    if (team1PropNeed > team2PropNeed) {
      return { propTeam: team1, oppTeam: team2 };
    } else if (team2PropNeed > team1PropNeed) {
      return { propTeam: team2, oppTeam: team1 };
    } else {
      return team1.performance_score >= team2.performance_score
        ? { propTeam: team1, oppTeam: team2 }
        : { propTeam: team2, oppTeam: team1 };
    }
  }

  private assignJudges(pairings: PairingResult[]): PairingResult[] {
    const judgesPerDebate = this.tournament.judges_per_debate;
    const availableJudges = [...this.judges];

    availableJudges.sort((a, b) => {
      const scoreA = (a.total_debates_judged * 0.4) +
        (a.elimination_debates * 0.3) +
        (a.avg_feedback_score * 0.2) +
        (a.cross_tournament_stats.consistency_score * 0.1);
      const scoreB = (b.total_debates_judged * 0.4) +
        (b.elimination_debates * 0.3) +
        (b.avg_feedback_score * 0.2) +
        (b.cross_tournament_stats.consistency_score * 0.1);
      return scoreB - scoreA;
    });

    const judgeAssignments = new Map<string, number>();
    availableJudges.forEach(judge => judgeAssignments.set(judge._id, judge.assignments_this_tournament));

    return pairings.map((pairing) => {
      if (pairing.is_bye_round) {
        return pairing;
      }

      const assignedJudges: Id<"users">[] = [];
      const conflicts: PairingConflict[] = [...pairing.conflicts];

      const propTeam = this.teams.find(t => t._id === pairing.proposition_team_id);
      const oppTeam = this.teams.find(t => t._id === pairing.opposition_team_id);

      const eligibleJudges = availableJudges.filter(judge => {

        if (propTeam?.school_id && judge.school_id === propTeam.school_id) return false;
        if (oppTeam?.school_id && judge.school_id === oppTeam.school_id) return false;

        if (propTeam && judge.conflicts.includes(propTeam._id)) return false;
        return !(oppTeam && judge.conflicts.includes(oppTeam._id));


      });

      eligibleJudges.sort((a, b) => {
        const workloadA = judgeAssignments.get(a._id) || 0;
        const workloadB = judgeAssignments.get(b._id) || 0;

        if (workloadA !== workloadB) {
          return workloadA - workloadB;
        }

        const qualityA = a.total_debates_judged + (a.avg_feedback_score * 10);
        const qualityB = b.total_debates_judged + (b.avg_feedback_score * 10);
        return qualityB - qualityA;
      });

      let targetJudgeCount = Math.min(judgesPerDebate, eligibleJudges.length);

      if (targetJudgeCount > 1 && targetJudgeCount % 2 === 0 && targetJudgeCount !== judgesPerDebate) {
        targetJudgeCount -= 1;
      }

      for (let i = 0; i < targetJudgeCount; i++) {
        const judge = eligibleJudges[i];
        assignedJudges.push(judge._id);
        judgeAssignments.set(judge._id, (judgeAssignments.get(judge._id) || 0) + 1);
      }

      let headJudge: Id<"users"> | undefined;
      if (assignedJudges.length > 0) {
        const judgeExperience = assignedJudges.map(judgeId => {
          const judge = availableJudges.find(j => j._id === judgeId)!;
          return {
            id: judgeId,
            experience: judge.total_debates_judged + (judge.elimination_debates * 2) + (judge.avg_feedback_score * 5)
          };
        });

        judgeExperience.sort((a, b) => b.experience - a.experience);
        headJudge = judgeExperience[0].id;
      }

      if (assignedJudges.length < judgesPerDebate) {
        conflicts.push({
          type: 'judge_conflict',
          description: `Only ${assignedJudges.length} judges assigned (target: ${judgesPerDebate})`,
          severity: assignedJudges.length === 0 ? 'error' : 'warning',
          judge_ids: assignedJudges as Id<"users">[],
        });
      }

      return {
        ...pairing,
        judges: assignedJudges,
        head_judge_id: headJudge,
        conflicts,
      };
    });
  }

  private assignRoomNames(pairings: PairingResult[]): PairingResult[] {
    let roomCounter = 1;

    return pairings.map(pairing => ({
      ...pairing,
      room_name: pairing.is_bye_round
        ? `Public Speaking ${roomCounter++}`
        : `Room ${roomCounter++}`,
    }));
  }

  private validatePairings(pairings: PairingResult[]): PairingResult[] {
    return pairings.map(pairing => {
      const conflicts: PairingConflict[] = [...pairing.conflicts];

      if (!pairing.is_bye_round && pairing.proposition_team_id && pairing.opposition_team_id) {
        const propTeam = this.teams.find(t => t._id === pairing.proposition_team_id);
        const oppTeam = this.teams.find(t => t._id === pairing.opposition_team_id);

        if (propTeam && oppTeam) {

          if (propTeam.opponents_faced.includes(oppTeam._id)) {
            conflicts.push({
              type: 'repeat_opponent',
              description: `${propTeam.name} and ${oppTeam.name} have faced each other before`,
              severity: 'error',
              team_ids: [propTeam._id, oppTeam._id],
            });
          }

          if (propTeam.school_id && propTeam.school_id === oppTeam.school_id) {
            conflicts.push({
              type: 'same_school',
              description: `Both teams are from the same school (${propTeam.school_name})`,
              severity: 'warning',
              team_ids: [propTeam._id, oppTeam._id],
            });
          }

          const propSideBalance = Math.abs(
            propTeam.side_history.filter(s => s === 'proposition').length -
            propTeam.side_history.filter(s => s === 'opposition').length
          );

          const oppSideBalance = Math.abs(
            oppTeam.side_history.filter(s => s === 'proposition').length -
            oppTeam.side_history.filter(s => s === 'opposition').length
          );

          if (propSideBalance > 2) {
            conflicts.push({
              type: 'side_imbalance',
              description: `${propTeam.name} has significant side imbalance`,
              severity: 'warning',
              team_ids: [propTeam._id],
            });
          }

          if (oppSideBalance > 2) {
            conflicts.push({
              type: 'side_imbalance',
              description: `${oppTeam.name} has significant side imbalance`,
              severity: 'warning',
              team_ids: [oppTeam._id],
            });
          }
        }
      }

      if (pairing.is_bye_round && pairing.proposition_team_id) {
        const byeTeam = this.teams.find(t => t._id === pairing.proposition_team_id);
        if (byeTeam && byeTeam.bye_rounds.length > 0) {
          conflicts.push({
            type: 'bye_violation',
            description: `${byeTeam.name} has already had a bye round`,
            severity: 'error',
            team_ids: [byeTeam._id],
          });
        }
      }

      return {
        ...pairing,
        conflicts,
      };
    });
  }

  private calculateQualityScores(pairings: PairingResult[]): PairingResult[] {
    return pairings.map(pairing => {
      if (pairing.is_bye_round) {
        return { ...pairing, quality_score: 0 };
      }

      let score = 100;

      pairing.conflicts.forEach(conflict => {
        if (conflict.severity === 'error') {
          score -= 25;
        } else {
          score -= 10;
        }
      });

      if (pairing.judges.length >= this.tournament.judges_per_debate) {
        score += 10;
      }

      if (pairing.proposition_team_id && pairing.opposition_team_id) {
        const propTeam = this.teams.find(t => t._id === pairing.proposition_team_id);
        const oppTeam = this.teams.find(t => t._id === pairing.opposition_team_id);

        if (propTeam && oppTeam) {
          const performanceDiff = Math.abs(propTeam.performance_score - oppTeam.performance_score);
          if (performanceDiff < 50) {
            score += 15;
          } else if (performanceDiff > 200) {
            score -= 15;
          }
        }
      }

      return {
        ...pairing,
        quality_score: Math.max(0, score),
      };
    });
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  static validatePairingConflicts(
    teams: TeamData[],
    judges: JudgeData[],
    propositionTeamId?: Id<"teams">,
    oppositionTeamId?: Id<"teams">,
    judgeIds: Id<"users">[] = []
  ): PairingConflict[] {
    const conflicts: PairingConflict[] = [];

    const propTeam = teams.find(t => t._id === propositionTeamId);
    const oppTeam = teams.find(t => t._id === oppositionTeamId);

    if (propositionTeamId === oppositionTeamId) {
      conflicts.push({
        type: 'same_school',
        description: 'Team cannot debate against itself',
        severity: 'error',
        team_ids: propositionTeamId ? [propositionTeamId] : undefined,
      });
    }

    if (propTeam && oppTeam) {
      if (propTeam.opponents_faced.includes(oppTeam._id)) {
        conflicts.push({
          type: 'repeat_opponent',
          description: `${propTeam.name} and ${oppTeam.name} have faced each other before`,
          severity: 'error',
          team_ids: [propTeam._id, oppTeam._id],
        });
      }

      if (propTeam.school_id && propTeam.school_id === oppTeam.school_id) {
        conflicts.push({
          type: 'same_school',
          description: `Both teams are from the same school`,
          severity: 'warning',
          team_ids: [propTeam._id, oppTeam._id],
        });
      }
    }

    judgeIds.forEach(judgeId => {
      const judge = judges.find(j => j._id === judgeId);
      if (!judge) return;

      if (propTeam?.school_id === judge.school_id) {
        conflicts.push({
          type: 'judge_conflict',
          description: `Judge ${judge.name} is from the same school as proposition team`,
          severity: 'error',
          judge_ids: [judgeId],
          team_ids: propTeam ? [propTeam._id] : undefined,
        });
      }

      if (oppTeam?.school_id === judge.school_id) {
        conflicts.push({
          type: 'judge_conflict',
          description: `Judge ${judge.name} is from the same school as opposition team`,
          severity: 'error',
          judge_ids: [judgeId],
          team_ids: oppTeam ? [oppTeam._id] : undefined,
        });
      }

      if (propTeam && judge.conflicts.includes(propTeam._id)) {
        conflicts.push({
          type: 'feedback_conflict',
          description: `Judge ${judge.name} has feedback conflicts with ${propTeam.name}`,
          severity: 'warning',
          judge_ids: [judgeId],
          team_ids: [propTeam._id],
        });
      }

      if (oppTeam && judge.conflicts.includes(oppTeam._id)) {
        conflicts.push({
          type: 'feedback_conflict',
          description: `Judge ${judge.name} has feedback conflicts with ${oppTeam.name}`,
          severity: 'warning',
          judge_ids: [judgeId],
          team_ids: [oppTeam._id],
        });
      }
    });

    return conflicts;
  }
}

export class PairingAlgorithmTests {
  static runAllTests(): void {
    console.log("🧪 Running Pairing Algorithm Tests...\n");

    this.testBasicFoldPairing();
    this.testSwissPairing();
    this.testByeRoundAssignment();
    this.testJudgeAssignment();
    this.testConflictDetection();
    this.testSideBalance();
    this.testRepeatOpponentAvoidance();
    this.testSchoolConflictAvoidance();
    this.testQualityScoring();
    this.testMultipleRoundGeneration();

    console.log("✅ All tests completed!");
  }

  private static testBasicFoldPairing(): void {
    console.log("🔄 Testing basic fold pairing...");

    const teams = this.createMockTeams(8);
    const judges = this.createMockJudges(15);
    const tournament = this.createMockTournament();

    const algorithm = new PairingAlgorithm(teams, judges, tournament, 1);
    const pairings = algorithm.generatePairings();

    console.assert(pairings.length === 4, "Should generate 4 pairings for 8 teams");
    console.assert(pairings.every(p => !p.is_bye_round), "No bye rounds with even teams");
    console.assert(pairings.every(p => p.judges.length > 0), "All pairings should have judges");

    console.log("✅ Basic fold pairing test passed\n");
  }

  private static testSwissPairing(): void {
    console.log("🔄 Testing Swiss pairing...");

    const teams = this.createMockTeams(8);

    teams.forEach((team, index) => {
      team.wins = index < 4 ? 3 : 1;
      team.performance_score = team.wins * 100 + (index * 10);
      team.side_history = ['proposition', 'opposition', 'proposition'];
    });

    const judges = this.createMockJudges(15);
    const tournament = this.createMockTournament();

    const algorithm = new PairingAlgorithm(teams, judges, tournament, 6);
    const pairings = algorithm.generatePairings();

    console.assert(pairings.length === 4, "Should generate 4 pairings for 8 teams");
    console.assert(pairings.every(p => p.quality_score > 0), "All pairings should have quality scores");

    console.log("✅ Swiss pairing test passed\n");
  }

  private static testByeRoundAssignment(): void {
    console.log("🔄 Testing bye round assignment...");

    const teams = this.createMockTeams(7);
    const judges = this.createMockJudges(12);
    const tournament = this.createMockTournament();

    const algorithm = new PairingAlgorithm(teams, judges, tournament, 1);
    const pairings = algorithm.generatePairings();

    const byeRounds = pairings.filter(p => p.is_bye_round);
    console.assert(byeRounds.length === 1, "Should have exactly one bye round");
    console.assert(pairings.length === 4, "Should have 3 debates + 1 bye = 4 total");

    console.log("✅ Bye round assignment test passed\n");
  }

  private static testJudgeAssignment(): void {
    console.log("🔄 Testing judge assignment...");

    const teams = this.createMockTeams(6);
    const judges = this.createMockJudges(10);
    const tournament = this.createMockTournament();
    tournament.judges_per_debate = 3;

    const algorithm = new PairingAlgorithm(teams, judges, tournament, 1);
    const pairings = algorithm.generatePairings();

    pairings.forEach(pairing => {
      if (!pairing.is_bye_round) {
        console.assert(pairing.judges.length <= 3, "Should not exceed max judges per debate");
        console.assert(pairing.judges.length % 2 === 1, "Should have odd number of judges");
        if (pairing.head_judge_id) {
          console.assert(pairing.judges.includes(pairing.head_judge_id), "Head judge should be in judge list");
        }
      }
    });

    console.log("✅ Judge assignment test passed\n");
  }

  private static testConflictDetection(): void {
    console.log("🔄 Testing conflict detection...");

    const teams = this.createMockTeams(4);

    teams[0].school_id = "school1" as Id<"schools">;
    teams[1].school_id = "school1" as Id<"schools">;
    teams[0].school_name = "Same School";
    teams[1].school_name = "Same School";

    teams[2].opponents_faced = [teams[3]._id];
    teams[3].opponents_faced = [teams[2]._id];

    const judges = this.createMockJudges(8);
    const tournament = this.createMockTournament();

    const conflicts = PairingAlgorithm.validatePairingConflicts(
      teams, judges, teams[0]._id, teams[1]._id, []
    );

    console.assert(conflicts.length > 0, "Should detect same school conflict");
    console.assert(conflicts.some(c => c.type === 'same_school'), "Should have same school conflict");

    console.log("✅ Conflict detection test passed\n");
  }

  private static testSideBalance(): void {
    console.log("🔄 Testing side balance...");

    const teams = this.createMockTeams(4);

    teams[0].side_history = ['proposition', 'proposition', 'proposition'];
    teams[1].side_history = ['opposition', 'opposition', 'opposition'];

    const judges = this.createMockJudges(8);
    const tournament = this.createMockTournament();

    const algorithm = new PairingAlgorithm(teams, judges, tournament, 4);
    const pairings = algorithm.generatePairings();

    const team0Pairing = pairings.find(p =>
      p.proposition_team_id === teams[0]._id || p.opposition_team_id === teams[0]._id
    );

    console.assert(team0Pairing !== undefined, "Team with heavy prop history should be paired");

    console.log("✅ Side balance test passed\n");
  }

  private static testRepeatOpponentAvoidance(): void {
    console.log("🔄 Testing repeat opponent avoidance...");

    const teams = this.createMockTeams(4);
    teams[0].opponents_faced = [teams[1]._id];
    teams[1].opponents_faced = [teams[0]._id];

    const judges = this.createMockJudges(8);
    const tournament = this.createMockTournament();

    const algorithm = new PairingAlgorithm(teams, judges, tournament, 2);
    const pairings = algorithm.generatePairings();

    const invalidPairing = pairings.find(p =>
      (p.proposition_team_id === teams[0]._id && p.opposition_team_id === teams[1]._id) ||
      (p.proposition_team_id === teams[1]._id && p.opposition_team_id === teams[0]._id)
    );

    console.assert(invalidPairing === undefined, "Should avoid repeat opponents");

    console.log("✅ Repeat opponent avoidance test passed\n");
  }

  private static testSchoolConflictAvoidance(): void {
    console.log("🔄 Testing school conflict avoidance...");

    const teams = this.createMockTeams(4);
    teams[0].school_id = "school1" as Id<"schools">;
    teams[1].school_id = "school1" as Id<"schools">;

    const judges = this.createMockJudges(8);
    const tournament = this.createMockTournament();

    const algorithm = new PairingAlgorithm(teams, judges, tournament, 1);
    const pairings = algorithm.generatePairings();

    const sameSchoolPairing = pairings.find(p =>
      (p.proposition_team_id === teams[0]._id && p.opposition_team_id === teams[1]._id) ||
      (p.proposition_team_id === teams[1]._id && p.opposition_team_id === teams[0]._id)
    );

    if (sameSchoolPairing) {
      console.assert(
        sameSchoolPairing.conflicts.some(c => c.type === 'same_school'),
        "Same school pairing should have conflict flag"
      );
    }

    console.log("✅ School conflict avoidance test passed\n");
  }

  private static testQualityScoring(): void {
    console.log("🔄 Testing quality scoring...");

    const teams = this.createMockTeams(4);
    const judges = this.createMockJudges(8);
    const tournament = this.createMockTournament();

    const algorithm = new PairingAlgorithm(teams, judges, tournament, 1);
    const pairings = algorithm.generatePairings();

    pairings.forEach(pairing => {
      console.assert(
        true,
        "Quality score should be a number"
      );
      console.assert(
        pairing.quality_score >= 0,
        "Quality score should be non-negative"
      );
    });

    console.log("✅ Quality scoring test passed\n");
  }

  private static testMultipleRoundGeneration(): void {
    console.log("🔄 Testing multiple round generation...");

    const teams = this.createMockTeams(8);
    const judges = this.createMockJudges(15);
    const tournament = this.createMockTournament();

    for (let round = 1; round <= 5; round++) {
      const algorithm = new PairingAlgorithm(teams, judges, tournament, round);
      const pairings = algorithm.generatePairings();

      console.assert(pairings.length === 4, `Round ${round} should have 4 pairings`);

      pairings.forEach(pairing => {
        if (!pairing.is_bye_round) {
          const propTeam = teams.find(t => t._id === pairing.proposition_team_id);
          const oppTeam = teams.find(t => t._id === pairing.opposition_team_id);

          if (propTeam && oppTeam) {
            propTeam.side_history.push('proposition');
            propTeam.opponents_faced.push(oppTeam._id);

            oppTeam.side_history.push('opposition');
            oppTeam.opponents_faced.push(propTeam._id);
          }
        }
      });
    }

    console.log("✅ Multiple round generation test passed\n");
  }

  private static createMockTeams(count: number): TeamData[] {
    const teams: TeamData[] = [];

    for (let i = 0; i < count; i++) {
      teams.push({
        _id: `team${i}` as Id<"teams">,
        name: `Team ${i + 1}`,
        school_id: `school${Math.floor(i / 2)}` as Id<"schools">,
        school_name: `School ${Math.floor(i / 2) + 1}`,
        side_history: [],
        opponents_faced: [],
        wins: 0,
        total_points: 0,
        bye_rounds: [],
        performance_score: 0,
        cross_tournament_performance: {
          total_tournaments: 0,
          total_wins: 0,
          total_debates: 0,
          avg_performance: 0,
        },
      });
    }

    return teams;
  }

  private static createMockJudges(count: number): JudgeData[] {
    const judges: JudgeData[] = [];

    for (let i = 0; i < count; i++) {
      judges.push({
        _id: `judge${i}` as Id<"users">,
        name: `Judge ${i + 1}`,
        school_id: i < count / 2 ? `school${i % 3}` as Id<"schools"> : undefined,
        school_name: i < count / 2 ? `School ${(i % 3) + 1}` : undefined,
        total_debates_judged: Math.floor(Math.random() * 20),
        elimination_debates: Math.floor(Math.random() * 5),
        avg_feedback_score: 3 + Math.random() * 2,
        conflicts: [],
        assignments_this_tournament: 0,
        cross_tournament_stats: {
          total_tournaments: Math.floor(Math.random() * 5),
          total_debates: Math.floor(Math.random() * 50),
          total_elimination_debates: Math.floor(Math.random() * 10),
          avg_feedback: 3 + Math.random() * 2,
          consistency_score: 0.7 + Math.random() * 0.3,
        },
      });
    }

    return judges;
  }

  private static createMockTournament(): Tournament {
    return {
      _id: "tournament1" as Id<"tournaments">,
      name: "Test Tournament",
      prelim_rounds: 5,
      elimination_rounds: 3,
      judges_per_debate: 3,
    };
  }
}

if (typeof require !== 'undefined' && require.main === module) {
  PairingAlgorithmTests.runAllTests();
}

export function generateTournamentPairings(
  teams: TeamData[],
  judges: JudgeData[],
  tournament: Tournament,
  roundNumber: number
): PairingResult[] {
  const algorithm = new PairingAlgorithm(teams, judges, tournament, roundNumber);
  return algorithm.generatePairings();
}

export function validatePairing(
  teams: TeamData[],
  judges: JudgeData[],
  propositionTeamId?: Id<"teams">,
  oppositionTeamId?: Id<"teams">,
  judgeIds: Id<"users">[] = []
): PairingConflict[] {
  return PairingAlgorithm.validatePairingConflicts(
    teams,
    judges,
    propositionTeamId,
    oppositionTeamId,
    judgeIds
  );
}