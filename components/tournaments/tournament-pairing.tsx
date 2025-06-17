"use client";

import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeftRight,
  Edit3,
  Info,
  Loader2,
  Redo2,
  RefreshCw,
  Save,
  Settings,
  Shuffle,
  Target,
  Timer,
  Trophy,
  Undo2,
  Users,
  Zap,
  UserMinus,
  Crown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

import { generateTournamentPairings, validatePairing } from "@/lib/pairing-algorithm";
import { Id } from "@/convex/_generated/dataModel";
import { useOffline } from "@/hooks/useOffline";

interface Team {
  _id: Id<"teams">;
  name: string;
  school?: {
    _id: Id<"schools">;
    name: string;
    type: string;
  };
  members: Id<"users">[];
  status: string;
  payment_status: string;
}

interface Judge {
  _id: Id<"users">;
  name: string;
  email: string;
  school?: {
    _id: Id<"schools">;
    name: string;
  };
}

interface PairingDraft {
  room_name: string;
  proposition_team_id?: Id<"teams">;
  opposition_team_id?: Id<"teams">;
  judges: Id<"users">[];
  head_judge_id?: Id<"users">;
  is_bye_round: boolean;
  conflicts: Array<{
    type: string;
    description: string;
    severity: 'warning' | 'error';
  }>;
  quality_score: number;
}

interface TournamentPairingsProps {
  tournament: any;
  userRole: string;
  token: string;
  userId?: string;
  schoolId?: string;
}

interface MoveAction {
  type: 'swap_sides' | 'move_team' | 'update_room' | 'update_judges';
  debateIndex: number;
  oldValue: any;
  newValue: any;
  description: string;
  timestamp: number;
}

export default function TournamentPairings({
                                             tournament,
                                             userRole,
                                             token,
                                           }: TournamentPairingsProps) {
  const [currentRound, setCurrentRound] = useState(1);
  const [isDraft, setIsDraft] = useState(true);
  const [editingRoom, setEditingRoom] = useState<string | null>(null);
  const [showConflicts, setShowConflicts] = useState(true);
  const [showQualityScores, setShowQualityScores] = useState(false);
  const [autoSaveDrafts, setAutoSaveDrafts] = useState(true);
  const [pairingMethod, setPairingMethod] = useState<'fold' | 'swiss' | 'auto'>('auto');

  const [draggedTeam, setDraggedTeam] = useState<{
    team: Team;
    fromDebateIndex: number;
    fromPosition: string;
  } | null>(null);
  const [dropZoneActive, setDropZoneActive] = useState<string | null>(null);

  const [draftPairings, setDraftPairings] = useState<PairingDraft[]>([]);
  const [undoStack, setUndoStack] = useState<PairingDraft[][]>([]);
  const [redoStack, setRedoStack] = useState<PairingDraft[][]>([]);
  const [moveHistory, setMoveHistory] = useState<MoveAction[]>([]);
  const [lastSavedTimestamp, setLastSavedTimestamp] = useState<number | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [selectedDebateIndex, setSelectedDebateIndex] = useState<number | null>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);

  const draftSaveTimeoutRef = useRef<NodeJS.Timeout>();

  const isAdmin = userRole === 'admin';
  const hasToken = Boolean(token);

  const canViewPairings = hasToken;
  const canGeneratePairings = isAdmin;
  const canEditPairings = isAdmin;
  const canSavePairings = isAdmin;
  const canWithdrawTeams = isAdmin;
  const canEditRoomNames = isAdmin;
  const canEditJudges = isAdmin;
  const canViewConflicts = isAdmin;
  const canViewQualityScores = isAdmin;
  const canViewStats = isAdmin;
  const canViewHistory = isAdmin;
  const canUseKeyboardShortcuts = isAdmin;
  const canAccessSettings = isAdmin;

  const pairingData = useQuery(
    api.functions.pairings.getTournamentPairingData,
    canGeneratePairings ? {
      token,
      tournament_id: tournament._id,
      round_number: currentRound,
    } : "skip"
  );

  const existingPairings = useOffline(useQuery(
    api.functions.pairings.getTournamentPairings,
    canViewPairings ? {
      token,
      tournament_id: tournament._id,
      round_number: currentRound,
    } : "skip"
  ), "tournament-pairings");

  const pairingStats = useQuery(
    api.functions.pairings.getPairingStats,
    canViewStats ? {
      token,
      tournament_id: tournament._id,
    } : "skip"
  );

  const savePairingsMutation = useMutation(api.functions.pairings.savePairings);
  const updatePairingMutation = useMutation(api.functions.pairings.updatePairing);
  const handleTeamWithdrawalMutation = useMutation(api.functions.pairings.handleTeamWithdrawal);

  const currentDebates = useMemo(() => {
    const hasSavedPairings = existingPairings && existingPairings.length > 0;
    return hasSavedPairings ? existingPairings[0]?.debates || [] : [];
  }, [existingPairings]);

  const saveDraft = useCallback((newPairings: PairingDraft[], immediate = false) => {

    if (!canEditPairings || (!autoSaveDrafts && !immediate)) return;

    const draft = {
      pairings: newPairings,
      timestamp: Date.now(),
      round: currentRound,
      tournament_id: tournament._id,
      method: pairingMethod,
      move_history: moveHistory,
    };

    if (draftSaveTimeoutRef.current) {
      clearTimeout(draftSaveTimeoutRef.current);
    }

    const saveAction = () => {
      localStorage.setItem(`pairings_draft_${tournament._id}_${currentRound}`, JSON.stringify(draft));
      setLastSavedTimestamp(Date.now());
    };

    if (immediate) {
      saveAction();
    } else {
      draftSaveTimeoutRef.current = setTimeout(saveAction, 1000);
    }
  }, [canEditPairings, autoSaveDrafts, currentRound, tournament._id, pairingMethod, moveHistory]);

  useEffect(() => {
    const hasSavedPairings = currentDebates.length > 0;

    if (hasSavedPairings) {
      setIsDraft(false);
      setDraftPairings([]);
      setUndoStack([]);
      setRedoStack([]);
      setMoveHistory([]);
    } else if (canEditPairings) {

      const savedDraft = localStorage.getItem(`pairings_draft_${tournament._id}_${currentRound}`);
      if (savedDraft) {
        try {
          const draft = JSON.parse(savedDraft);
          setDraftPairings(draft.pairings || []);
          setMoveHistory(draft.move_history || []);
          setLastSavedTimestamp(draft.timestamp);
          setIsDraft(true);
        } catch (error) {
          console.error('Error loading draft:', error);
          toast.error('Failed to load draft pairings');
        }
      }
    }
  }, [tournament._id, currentRound, currentDebates, canEditPairings]);

  const stats = useMemo(() => {
    const pairings = isDraft ? draftPairings : currentDebates;
    const totalDebates = pairings.filter((p: any) => !p.is_bye_round && !p.is_public_speaking).length;
    const byeRounds = pairings.filter((p: any) => p.is_bye_round || p.is_public_speaking).length;
    const conflicts = pairings.reduce((sum: number, p: any) => sum + (p.conflicts?.length || p.pairing_conflicts?.length || 0), 0);
    const errors = pairings.reduce((sum: number, p: any) => {
      const conflictList = p.conflicts || p.pairing_conflicts || [];
      return sum + conflictList.filter((c: any) => c.severity === 'error').length;
    }, 0);
    const avgQuality = pairings.length > 0
      ? pairings.reduce((sum: number, p: any) => sum + (p.quality_score || 0), 0) / pairings.length
      : 0;

    return { totalDebates, byeRounds, conflicts, errors, avgQuality };
  }, [isDraft, draftPairings, currentDebates]);

  const generatePairings = useCallback(async () => {
    if (!canGeneratePairings || !pairingData || !pairingData.teams || !pairingData.judges) {
      if (!canGeneratePairings) {
        toast.error("You don't have permission to generate pairings");
        return;
      }
      toast.error("Tournament data not loaded");
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);

    try {
      if (draftPairings.length > 0) {
        setUndoStack(prev => [...prev.slice(-9), draftPairings]);
        setRedoStack([]);
      }

      setGenerationProgress(25);

      const method = pairingMethod === 'auto'
        ? (currentRound <= 5 ? 'fold' : 'swiss')
        : pairingMethod;

      if (currentRound > 5 && method === 'swiss') {
        toast.info("Switching to Swiss system for round 6+", {
          description: "The fold system is limited to 5 rounds. Using Swiss pairing for better matchups.",
        });
      }

      setGenerationProgress(50);

      const teams = pairingData.teams.map((team: any) => ({
        _id: team._id,
        name: team.name,
        school_id: team.school_id,
        school_name: team.school_name,
        side_history: team.side_history || [],
        opponents_faced: team.opponents_faced || [],
        wins: team.wins || 0,
        total_points: team.total_points || 0,
        bye_rounds: team.bye_rounds || [],
        performance_score: team.performance_score || 0,
        cross_tournament_performance: team.cross_tournament_performance || {
          total_tournaments: 0,
          total_wins: 0,
          total_debates: 0,
          avg_performance: 0,
        },
      }));

      const judges = pairingData.judges.map((judge: any) => ({
        _id: judge._id,
        name: judge.name,
        school_id: judge.school_id,
        school_name: judge.school_name,
        total_debates_judged: judge.total_debates_judged || 0,
        elimination_debates: judge.elimination_debates || 0,
        avg_feedback_score: judge.avg_feedback_score || 3.0,
        conflicts: judge.conflicts || [],
        assignments_this_tournament: judge.assignments_this_tournament || 0,
        cross_tournament_stats: judge.cross_tournament_stats || {
          total_tournaments: 0,
          total_debates: 0,
          total_elimination_debates: 0,
          avg_feedback: 3.0,
          consistency_score: 1.0,
        },
      }));

      setGenerationProgress(75);

      const result = generateTournamentPairings(teams, judges, tournament, currentRound);

      setGenerationProgress(100);

      const newPairings: PairingDraft[] = result.map(pairing => ({
        room_name: pairing.room_name,
        proposition_team_id: pairing.proposition_team_id,
        opposition_team_id: pairing.opposition_team_id,
        judges: pairing.judges,
        head_judge_id: pairing.head_judge_id,
        is_bye_round: pairing.is_bye_round,
        conflicts: pairing.conflicts,
        quality_score: pairing.quality_score,
      }));

      setDraftPairings(newPairings);
      setIsDraft(true);
      saveDraft(newPairings, true);

      const moveAction: MoveAction = {
        type: 'move_team',
        debateIndex: -1,
        oldValue: draftPairings,
        newValue: newPairings,
        description: `Generated ${method} pairings for Round ${currentRound}`,
        timestamp: Date.now(),
      };
      setMoveHistory(prev => [...prev, moveAction]);

      toast.success(`Generated ${result.length} pairings`, {
        description: `${stats.conflicts} conflicts detected, avg quality: ${stats.avgQuality.toFixed(1)}`,
      });

    } catch (error: any) {
      toast.error("Failed to generate pairings", {
        description: error.message || "An unexpected error occurred",
      });
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
    }
  },[canGeneratePairings, pairingData, draftPairings, currentRound, pairingMethod, tournament, stats]);

  const savePairings = useCallback(async () => {
    if (!canSavePairings || !savePairingsMutation) {
      toast.error("You don't have permission to save pairings");
      return;
    }

    if (stats.errors > 0) {
      const confirmed = window.confirm(
        `There are ${stats.errors} errors in the pairings. ` +
        `These may cause issues during the tournament. Save anyway?`
      );
      if (!confirmed) return;
    }

    try {
      await savePairingsMutation({
        token,
        tournament_id: tournament._id,
        round_number: currentRound,
        pairings: draftPairings,
      });

      setIsDraft(false);
      localStorage.removeItem(`pairings_draft_${tournament._id}_${currentRound}`);
      setUndoStack([]);
      setRedoStack([]);
      setMoveHistory([]);

      toast.success("Pairings saved successfully!", {
        description: "All participants have been notified",
      });
    } catch (error: any) {
      toast.error("Failed to save pairings", {
        description: error.message || "Please try again",
      });
    }
  }, [canSavePairings, savePairingsMutation, stats.errors, token, tournament._id, currentRound, draftPairings]);

  const handleTeamWithdrawal = async (teamId: Id<"teams">, teamName: string) => {
    if (!canWithdrawTeams || !handleTeamWithdrawalMutation) {
      toast.error("You don't have permission to withdraw teams");
      return;
    }

    const reason = window.prompt(`Why is ${teamName} withdrawing?`);
    if (reason === null) return;

    try {
      const result = await handleTeamWithdrawalMutation({
        token,
        team_id: teamId,
        reason: reason || undefined,
      });

      toast.success(`${teamName} withdrawn`, {
        description: `${result.affected_debates.length} debates converted to public speaking`,
      });

      setCurrentRound(prev => prev);
    } catch (error: any) {
      toast.error("Failed to withdraw team", {
        description: error.message,
      });
    }
  };

  const handleDragStart = (team: Team, debateIndex: number, position: string) => {
    if (!canEditPairings || !isDraft) return;

    setDraggedTeam({ team, fromDebateIndex: debateIndex, fromPosition: position });
    document.body.style.cursor = 'grabbing';
  };

  const handleDragEnd = () => {
    setDraggedTeam(null);
    setDropZoneActive(null);
    document.body.style.cursor = '';
  };

  const handleDragOver = (e: React.DragEvent, debateIndex: number, position: string) => {
    e.preventDefault();
    if (draggedTeam && canEditPairings) {
      setDropZoneActive(`${debateIndex}-${position}`);
    }
  };

  const handleDragLeave = () => {
    setDropZoneActive(null);
  };

  const handleDrop = async (e: React.DragEvent, toDebateIndex: number, toPosition: string) => {
    e.preventDefault();

    if (!draggedTeam || !isDraft || !canEditPairings) return;

    setIsRecalculating(true);

    try {
      setUndoStack(prev => [...prev.slice(-9), draftPairings]);
      setRedoStack([]);

      const newPairings = [...draftPairings];

      const destTeamId = toPosition === 'prop'
        ? newPairings[toDebateIndex].proposition_team_id
        : newPairings[toDebateIndex].opposition_team_id;

      if (draggedTeam.fromPosition === 'prop') {
        newPairings[draggedTeam.fromDebateIndex].proposition_team_id = destTeamId;
      } else {
        newPairings[draggedTeam.fromDebateIndex].opposition_team_id = destTeamId;
      }

      if (toPosition === 'prop') {
        newPairings[toDebateIndex].proposition_team_id = draggedTeam.team._id;
      } else {
        newPairings[toDebateIndex].opposition_team_id = draggedTeam.team._id;
      }

      [draggedTeam.fromDebateIndex, toDebateIndex].forEach(index => {
        if (newPairings[index] && pairingData) {
          newPairings[index].conflicts = validatePairing(
            pairingData.teams,
            pairingData.judges,
            newPairings[index].proposition_team_id,
            newPairings[index].opposition_team_id,
            newPairings[index].judges
          );
        }
      });

      setDraftPairings(newPairings);
      saveDraft(newPairings);

      const moveAction: MoveAction = {
        type: 'move_team',
        debateIndex: toDebateIndex,
        oldValue: {
          from: { index: draggedTeam.fromDebateIndex, position: draggedTeam.fromPosition },
          to: { index: toDebateIndex, position: toPosition }
        },
        newValue: draggedTeam.team.name,
        description: `Moved ${draggedTeam.team.name} to ${toPosition} in ${newPairings[toDebateIndex].room_name}`,
        timestamp: Date.now(),
      };
      setMoveHistory(prev => [...prev, moveAction]);

      toast.success(`Moved ${draggedTeam.team.name}`, {
        description: moveAction.description,
        duration: 2000,
      });

    } finally {
      setIsRecalculating(false);
      setDraggedTeam(null);
      setDropZoneActive(null);
    }
  };

  const swapSides = async (debateIndex: number) => {
    if (!isDraft || !canEditPairings) return;

    setIsRecalculating(true);

    try {
      setUndoStack(prev => [...prev.slice(-9), draftPairings]);
      setRedoStack([]);

      const newPairings = [...draftPairings];
      const pairing = newPairings[debateIndex];

      [pairing.proposition_team_id, pairing.opposition_team_id] =
        [pairing.opposition_team_id, pairing.proposition_team_id];

      if (pairingData) {
        pairing.conflicts = validatePairing(
          pairingData.teams,
          pairingData.judges,
          pairing.proposition_team_id,
          pairing.opposition_team_id,
          pairing.judges
        );
      }

      setDraftPairings(newPairings);
      saveDraft(newPairings);

      const moveAction: MoveAction = {
        type: 'swap_sides',
        debateIndex,
        oldValue: 'swapped',
        newValue: 'swapped',
        description: `Swapped sides in ${pairing.room_name}`,
        timestamp: Date.now(),
      };
      setMoveHistory(prev => [...prev, moveAction]);

      toast.success("Swapped team sides", {
        description: moveAction.description,
        duration: 2000,
      });

    } finally {
      setIsRecalculating(false);
    }
  };

  const updateRoomName = (debateIndex: number, newName: string) => {
    if (!isDraft || !canEditRoomNames) return;

    const newPairings = [...draftPairings];
    const oldName = newPairings[debateIndex].room_name;
    newPairings[debateIndex].room_name = newName;

    setDraftPairings(newPairings);
    saveDraft(newPairings);

    const moveAction: MoveAction = {
      type: 'update_room',
      debateIndex,
      oldValue: oldName,
      newValue: newName,
      description: `Renamed room from "${oldName}" to "${newName}"`,
      timestamp: Date.now(),
    };
    setMoveHistory(prev => [...prev, moveAction]);
  };

  const updateDebateJudges = async (debateIndex: number, newJudges: Id<"users">[], newHeadJudge?: Id<"users">) => {
    if (!isDraft || !canEditJudges) return;

    setIsRecalculating(true);

    try {
      setUndoStack(prev => [...prev.slice(-9), draftPairings]);
      setRedoStack([]);

      const newPairings = [...draftPairings];
      const oldJudges = newPairings[debateIndex].judges;
      const oldHeadJudge = newPairings[debateIndex].head_judge_id;

      newPairings[debateIndex].judges = newJudges;
      newPairings[debateIndex].head_judge_id = newHeadJudge;

      if (pairingData) {
        newPairings[debateIndex].conflicts = validatePairing(
          pairingData.teams,
          pairingData.judges,
          newPairings[debateIndex].proposition_team_id,
          newPairings[debateIndex].opposition_team_id,
          newJudges
        );
      }

      setDraftPairings(newPairings);
      saveDraft(newPairings);

      const moveAction: MoveAction = {
        type: 'update_judges',
        debateIndex,
        oldValue: { judges: oldJudges, headJudge: oldHeadJudge },
        newValue: { judges: newJudges, headJudge: newHeadJudge },
        description: `Updated judges in ${newPairings[debateIndex].room_name}`,
        timestamp: Date.now(),
      };
      setMoveHistory(prev => [...prev, moveAction]);

      toast.success("Updated judges", {
        description: moveAction.description,
        duration: 2000,
      });

    } finally {
      setIsRecalculating(false);
    }
  };

  const updateSavedPairing = async (debateId: Id<"debates">, updates: any) => {
    if (!canEditPairings || !updatePairingMutation) {
      toast.error("You don't have permission to update pairings");
      return;
    }

    try {
      await updatePairingMutation({
        token,
        debate_id: debateId,
        updates,
      });

      toast.success("Pairing updated", {
        description: "Changes saved successfully",
      });
    } catch (error: any) {
      toast.error("Failed to update pairing", {
        description: error.message,
      });
    }
  };

  const undo = useCallback(() => {
    if (!canEditPairings || undoStack.length === 0) return;

    const previous = undoStack[undoStack.length - 1];
    setRedoStack(prev => [...prev, draftPairings]);
    setUndoStack(prev => prev.slice(0, -1));
    setDraftPairings(previous);
    saveDraft(previous, true);

    toast.success("Undone", {
      description: "Previous state restored",
      duration: 1500,
    });
  }, [canEditPairings, undoStack, draftPairings, saveDraft]);

  const redo = useCallback(() => {
    if (!canEditPairings || redoStack.length === 0) return;

    const next = redoStack[redoStack.length - 1];
    setUndoStack(prev => [...prev, draftPairings]);
    setRedoStack(prev => prev.slice(0, -1));
    setDraftPairings(next);
    saveDraft(next, true);

    toast.success("Redone", {
      description: "Next state restored",
      duration: 1500,
    });
  }, [canEditPairings, redoStack, draftPairings, saveDraft]);

  const getTeamById = (teamId?: string): Team | undefined => {
    if (!teamId || !pairingData) return undefined;
    return pairingData.teams.find((t: Team) => t._id === teamId);
  };

  const getJudgeById = (judgeId?: string): Judge | undefined => {
    if (!judgeId || !pairingData) return undefined;
    return pairingData.judges.find((j: Judge) => j._id === judgeId);
  };

  React.useEffect(() => {
    if (!canUseKeyboardShortcuts || !isDraft) return;

    const handleKeyboard = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'z':
            e.preventDefault();
            undo();
            break;
          case 'y':
            e.preventDefault();
            redo();
            break;
          case 's':
            e.preventDefault();
            savePairings();
            break;
          case 'g':
            e.preventDefault();
            generatePairings();
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [canUseKeyboardShortcuts, isDraft, undo, redo, savePairings, generatePairings]);

  const ConflictBadge = ({ conflicts }: { conflicts: any[] }) => {
    if (!canViewConflicts || conflicts.length === 0) return null;

    const hasErrors = conflicts.some(c => c.severity === 'error');

    return (
      <Badge variant={hasErrors ? "destructive" : "secondary"} className="gap-1">
        {hasErrors ? <AlertCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
        {conflicts.length}
      </Badge>
    );
  };

  const QualityBadge = ({ score }: { score: number }) => {
    if (!canViewQualityScores) return null;

    const getVariant = () => {
      if (score >= 90) return "default";
      if (score >= 70) return "secondary";
      return "destructive";
    };

    const getIcon = () => {
      if (score >= 90) return <Target className="h-3 w-3" />;
      if (score >= 70) return <Zap className="h-3 w-3" />;
      return <AlertTriangle className="h-3 w-3" />;
    };

    return (
      <Badge variant={getVariant()} className="gap-1">
        {getIcon()}
        {score.toFixed(0)}
      </Badge>
    );
  };

  const TeamCard = ({
                      team,
                      position,
                      debateIndex,
                    }: {
    team?: Team;
    position: 'proposition' | 'opposition';
    debateIndex: number;
  }) => {
    const isDropTarget = dropZoneActive === `${debateIndex}-${position === 'proposition' ? 'prop' : 'opp'}`;

    return (
      <div
        draggable={canEditPairings && team && isDraft}
        onDragStart={() => team && handleDragStart(team, debateIndex, position === 'proposition' ? 'prop' : 'opp')}
        onDragEnd={handleDragEnd}
        onDragOver={(e) => handleDragOver(e, debateIndex, position === 'proposition' ? 'prop' : 'opp')}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, debateIndex, position === 'proposition' ? 'prop' : 'opp')}
        className={`p-3 border rounded-lg transition-all duration-200 ${
          team
            ? `bg-background border-border hover:border-primary ${isDraft && canEditPairings ? 'cursor-move' : ''}`
            : 'bg-muted border-dashed border-muted-foreground/25'
        } ${
          isDropTarget
            ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
            : ''
        } ${
          draggedTeam && !isDropTarget
            ? 'opacity-50'
            : ''
        }`}
      >
        {team ? (
          <div>
            <div className="font-medium text-foreground flex items-center justify-between">
              <div className="flex items-center gap-2">
                {team.name}
                {position === 'proposition' && (
                  <Badge variant="outline" className="text-green-700 border-green-700">Prop</Badge>
                )}
                {position === 'opposition' && (
                  <Badge variant="outline" className="text-red-700 border-red-700">Opp</Badge>
                )}
              </div>

              {canWithdrawTeams && team.status === 'active' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTeamWithdrawal(team._id, team.name);
                  }}
                  className="opacity-50 hover:opacity-100"
                  title="Withdraw team"
                >
                  <UserMinus className="h-3 w-3" />
                </Button>
              )}
            </div>
            {team.school && (
              <div className="text-sm text-muted-foreground">{team.school.name}</div>
            )}
            <div className="text-xs text-muted-foreground mt-1">
              {team.members.length} members • {team.status}
            </div>
          </div>
        ) : (
          <div className="text-muted-foreground text-center py-2 text-sm">
            {isDropTarget ? (
              <div className="text-primary font-medium">Drop team here</div>
            ) : (
              canEditPairings ? 'Drop team here' : 'No team assigned'
            )}
          </div>
        )}
      </div>
    );
  };

  const JudgeSelectionDialog = ({
                                  debate,
                                  onUpdate
                                }: {
    debate: any;
    debateIndex: number;
    onUpdate: (judges: Id<"users">[], headJudge?: Id<"users">) => void;
  }) => {
    const [selectedJudges, setSelectedJudges] = useState<Id<"users">[]>(debate.judges || []);
    const [selectedHeadJudge, setSelectedHeadJudge] = useState<Id<"users"> | undefined>(debate.head_judge_id);
    const [open, setOpen] = useState(false);

    if (!canEditJudges) return null;

    const handleJudgeToggle = (judgeId: Id<"users">, checked: boolean) => {
      if (checked) {
        const newJudges = [...selectedJudges, judgeId];
        setSelectedJudges(newJudges);

        if (newJudges.length === 1) {
          setSelectedHeadJudge(judgeId);
        }
      } else {
        const newJudges = selectedJudges.filter(id => id !== judgeId);
        setSelectedJudges(newJudges);

        if (selectedHeadJudge === judgeId) {
          setSelectedHeadJudge(newJudges.length > 0 ? newJudges[0] : undefined);
        }
      }
    };

    const handleSave = () => {
      onUpdate(selectedJudges, selectedHeadJudge);
      setOpen(false);
    };

    const getJudgeConflicts = (judge: any) => {
      const conflicts: string[] = [];

      if (debate.proposition_team?.school?._id === judge.school_id) {
        conflicts.push('Same school as Prop team');
      }
      if (debate.opposition_team?.school?._id === judge.school_id) {
        conflicts.push('Same school as Opp team');
      }

      if (judge.conflicts?.includes(debate.proposition_team?._id)) {
        conflicts.push('Feedback conflict with Prop');
      }
      if (judge.conflicts?.includes(debate.opposition_team?._id)) {
        conflicts.push('Feedback conflict with Opp');
      }

      return conflicts;
    };

    const sortedJudges = [...(pairingData?.judges || [])].sort((a, b) => {
      const conflictsA = getJudgeConflicts(a).length;
      const conflictsB = getJudgeConflicts(b).length;

      if (conflictsA !== conflictsB) return conflictsA - conflictsB;

      const experienceA = a.total_debates_judged + (a.elimination_debates * 2);
      const experienceB = b.total_debates_judged + (b.elimination_debates * 2);

      return experienceB - experienceA;
    });

    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm">
            <Edit3 className="h-3 w-3 mr-1" />
            Edit
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Judges - {debate.room_name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Select judges for this debate. Choose {tournament.judges_per_debate} judges (odd number recommended).
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <strong>Proposition:</strong> {debate.proposition_team?.name}
                {debate.proposition_team?.school && (
                  <div className="text-muted-foreground">({debate.proposition_team.school.name})</div>
                )}
              </div>
              <div>
                <strong>Opposition:</strong> {debate.opposition_team?.name}
                {debate.opposition_team?.school && (
                  <div className="text-muted-foreground">({debate.opposition_team.school.name})</div>
                )}
              </div>
            </div>

            <Separator />

            <ScrollArea className="h-96">
              <div className="space-y-2">
                {sortedJudges.map((judge: any) => {
                  const conflicts = getJudgeConflicts(judge);
                  const isSelected = selectedJudges.includes(judge._id);
                  const isHeadJudge = selectedHeadJudge === judge._id;

                  return (
                    <div
                      key={judge._id}
                      className={`flex items-center space-x-3 p-2 border rounded ${
                        conflicts.length > 0 ? 'border-red-200 bg-red-50' : 'border-border'
                      }`}
                    >
                      <Checkbox
                        id={`judge-${judge._id}`}
                        checked={isSelected}
                        onCheckedChange={(checked) => handleJudgeToggle(judge._id, !!checked)}
                        disabled={conflicts.length > 0}
                      />

                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <label htmlFor={`judge-${judge._id}`} className="text-sm font-medium">
                            {judge.name}
                          </label>

                          {isHeadJudge && (
                            <Badge variant="default" className="gap-1">
                              <Crown className="h-3 w-3" />
                              Head
                            </Badge>
                          )}

                          {judge.school_name && (
                            <span className="text-xs text-muted-foreground">
                              ({judge.school_name})
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-muted-foreground">
                          {judge.total_debates_judged} debates • {judge.elimination_debates} eliminations
                          {judge.avg_feedback_score && (
                            <span> • {judge.avg_feedback_score.toFixed(1)}/5 rating</span>
                          )}
                        </div>

                        {conflicts.length > 0 && (
                          <div className="text-xs text-red-600 mt-1">
                            Conflicts: {conflicts.join(', ')}
                          </div>
                        )}
                      </div>

                      {isSelected && selectedJudges.length > 1 && (
                        <Button
                          variant={isHeadJudge ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedHeadJudge(judge._id)}
                        >
                          {isHeadJudge ? "Head Judge" : "Make Head"}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Selected: {selectedJudges.length} judges
                {selectedJudges.length % 2 === 0 && selectedJudges.length > 0 && (
                  <span className="text-orange-600 ml-1">(Even number - may cause ties)</span>
                )}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  const LoadingSkeleton = () => (
    <div className="space-y-2">
      <Card>
        <div className="flex flex-col lg:flex-row lg:items-center bg-brown rounded-t-md lg:justify-between gap-4 p-3">
          <div>
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-18" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-8 w-8" />
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-8 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-6 w-24" />
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-8" />
                    <Skeleton className="h-5 w-8" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Skeleton className="h-4 w-20 mb-2" />
                    <div className="p-3 border rounded-lg">
                      <Skeleton className="h-5 w-32 mb-1" />
                      <Skeleton className="h-4 w-24 mb-1" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                  <div>
                    <Skeleton className="h-4 w-20 mb-2" />
                    <div className="p-3 border rounded-lg">
                      <Skeleton className="h-5 w-32 mb-1" />
                      <Skeleton className="h-4 w-24 mb-1" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                </div>
                <Separator />
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-6 w-12" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-6 w-18" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </Card>
    </div>
  );

  const displayPairings = isDraft ?
    draftPairings.map((p, i) => ({
      ...p,
      _id: `draft-${i}`,
      proposition_team: getTeamById(p.proposition_team_id),
      opposition_team: getTeamById(p.opposition_team_id),
      judge_details: p.judges.map(jId => getJudgeById(jId)).filter(Boolean) as Judge[],
      head_judge: getJudgeById(p.head_judge_id),
      is_public_speaking: p.is_bye_round,
      pairing_conflicts: p.conflicts,
    })) :
    currentDebates;

  if (!canViewPairings) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-2">
      <Card className="">
        <div className="flex flex-col lg:flex-row lg:items-center bg-brown rounded-t-md lg:justify-between gap-4 p-3">
          <div>
            <h2 className="text-xl text-white font-bold flex items-center gap-2">
              Tournament Pairings
            </h2>
            <div className="flex items-center gap-4 text-xs text-gray-300">
              <span>Round {currentRound} • {displayPairings.length} pairings</span>
              {isDraft && canEditPairings && (
                <Badge variant="secondary" className="text-primary border-primary">
                  <Edit3 className="h-3 w-3 mr-1" />
                  Draft
                </Badge>
              )}
              {lastSavedTimestamp && canEditPairings && (
                <span className="text-xs">
                  Last saved: {new Date(lastSavedTimestamp).toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>

          
          {canEditPairings && (
            <div className="flex items-center gap-3 flex-wrap">
              <Select value={currentRound.toString()} onValueChange={(value) => setCurrentRound(Number(value))}>
                <SelectTrigger className="w-24 h-8 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: tournament.prelim_rounds + tournament.elimination_rounds }, (_, i) => (
                    <SelectItem key={i + 1} value={(i + 1).toString()}>
                      Round {i + 1}
                      {i + 1 <= tournament.prelim_rounds ? ' (Prelim)' : ' (Elim)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={pairingMethod} onValueChange={(value: 'fold' | 'swiss' | 'auto') => setPairingMethod(value)}>
                <SelectTrigger className="w-18 h-8 bg-background ">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto</SelectItem>
                  <SelectItem value="fold">Fold</SelectItem>
                  <SelectItem value="swiss">Swiss</SelectItem>
                </SelectContent>
              </Select>

              {canGeneratePairings && (
                <Button
                  onClick={generatePairings}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="hidden custom:block"> {generationProgress}% </span>
                    </>
                  ) : (
                    <>
                      <Shuffle className="h-4 w-4" />
                      <span className="hidden custom:block"> Generate </span>
                    </>
                  )}
                </Button>
              )}

              {isDraft && canSavePairings && (
                <Button onClick={savePairings} variant="default" disabled={isRecalculating}>
                  {isRecalculating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="hidden custom:block">Recalculating...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      <span className="hidden custom:block">Save Pairings </span>
                    </>
                  )}
                </Button>
              )}

              {canAccessSettings && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Pairing Settings</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="auto-save">Auto-save drafts</Label>
                        <Switch
                          id="auto-save"
                          checked={autoSaveDrafts}
                          onCheckedChange={setAutoSaveDrafts}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="show-conflicts">Show conflicts</Label>
                        <Switch
                          id="show-conflicts"
                          checked={showConflicts}
                          onCheckedChange={setShowConflicts}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="show-quality">Show quality scores</Label>
                        <Switch
                          id="show-quality"
                          checked={showQualityScores}
                          onCheckedChange={setShowQualityScores}
                        />
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          )}
        </div>

        
        {displayPairings.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 p-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-500" />
                  <span className="text-sm font-medium">Debates</span>
                </div>
                <div className="text-2xl font-bold mt-1">{stats.totalDebates}</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Timer className="h-5 w-5 text-green-500" />
                  <span className="text-sm font-medium">Bye Rounds</span>
                </div>
                <div className="text-2xl font-bold mt-1">{stats.byeRounds}</div>
              </CardContent>
            </Card>

            
            {canViewConflicts && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    <span className="text-sm font-medium">Conflicts</span>
                  </div>
                  <div className="text-2xl font-bold mt-1">{stats.conflicts}</div>
                </CardContent>
              </Card>
            )}

            {canViewConflicts && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <span className="text-sm font-medium">Errors</span>
                  </div>
                  <div className="text-2xl font-bold mt-1">{stats.errors}</div>
                </CardContent>
              </Card>
            )}

            {canViewQualityScores && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-purple-500" />
                    <span className="text-sm font-medium">Avg Quality</span>
                  </div>
                  <div className="text-2xl font-bold mt-1">{stats.avgQuality.toFixed(1)}</div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        
        {canEditPairings && isDraft && displayPairings.length > 0 && (
          <Card className="mx-4 mb-4">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={undo}
                    disabled={undoStack.length === 0}
                    size="sm"
                  >
                    <Undo2 className="h-4 w-4 mr-1" />
                    Undo
                  </Button>

                  <Button
                    variant="outline"
                    onClick={redo}
                    disabled={redoStack.length === 0}
                    size="sm"
                  >
                    <Redo2 className="h-4 w-4 mr-1" />
                    Redo
                  </Button>

                  {canViewHistory && moveHistory.length > 0 && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <RefreshCw className="h-4 w-4 mr-1" />
                          History ({moveHistory.length})
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Move History</DialogTitle>
                        </DialogHeader>
                        <ScrollArea className="h-96">
                          <div className="space-y-2">
                            {moveHistory.slice().reverse().map((move) => (
                              <div key={move.timestamp} className="flex items-center gap-3 p-2 border rounded">
                                <div className="text-sm font-mono bg-muted px-2 py-1 rounded">
                                  {new Date(move.timestamp).toLocaleTimeString()}
                                </div>
                                <div className="flex-1 text-sm">{move.description}</div>
                                <Badge variant="outline">{move.type}</Badge>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {canViewStats && pairingStats && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Info className="h-4 w-4 mr-1" />
                          Stats
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl">
                        <DialogHeader>
                          <DialogTitle>Tournament Statistics</DialogTitle>
                        </DialogHeader>
                        <Tabs defaultValue="overview">
                          <TabsList>
                            <TabsTrigger value="overview">Overview</TabsTrigger>
                            <TabsTrigger value="quality">Quality</TabsTrigger>
                            <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
                          </TabsList>

                          <TabsContent value="overview" className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <h4 className="font-medium mb-2">Tournament Progress</h4>
                                <div className="space-y-1 text-sm">
                                  <div>Total Rounds: {pairingStats.total_rounds}</div>
                                  <div>Total Teams: {pairingStats.total_teams}</div>
                                  <div>Total Debates: {pairingStats.total_debates}</div>
                                  <div>Public Speaking: {pairingStats.public_speaking_rounds}</div>
                                </div>
                              </div>
                              <div>
                                <h4 className="font-medium mb-2">Quality Metrics</h4>
                                <div className="space-y-1 text-sm">
                                  <div>Repeat Matchups: {pairingStats.quality_metrics?.repeat_matchups || 0}</div>
                                  <div>Side Imbalances: {pairingStats.quality_metrics?.side_imbalances || 0}</div>
                                  <div>School Conflicts: {pairingStats.quality_metrics?.school_conflicts || 0}</div>
                                  <div>Judge Overloads: {pairingStats.quality_metrics?.judge_overloads || 0}</div>
                                </div>
                              </div>
                            </div>
                          </TabsContent>

                          <TabsContent value="quality">
                            <div className="space-y-4">
                              <div>
                                <h4 className="font-medium mb-2">Overall Quality Score</h4>
                                <div className="text-3xl font-bold">
                                  {pairingStats.quality_metrics?.total_quality_score || 0}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  Lower scores indicate better quality
                                </div>
                              </div>
                            </div>
                          </TabsContent>

                          <TabsContent value="recommendations">
                            <div className="space-y-2">
                              {pairingStats.recommendations?.map((rec, index) => (
                                <Alert key={index}>
                                  <Info className="h-4 w-4" />
                                  <AlertDescription>{rec}</AlertDescription>
                                </Alert>
                              )) || (
                                <div className="text-muted-foreground">No recommendations available</div>
                              )}
                            </div>
                          </TabsContent>
                        </Tabs>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {currentRound > 5 && tournament.prelim_rounds > 5 && (
          <div className="mx-4 mb-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Pairing Method Changed</AlertTitle>
              <AlertDescription>
                Beyond Round 5, the system automatically switches to Swiss pairing to handle team matchups
                more effectively. Teams may face each other again, but performance-based matching is prioritized.
              </AlertDescription>
            </Alert>
          </div>
        )}

        
        <div className="grid gap-4 lg:grid-cols-2 p-4">
          {displayPairings.map((debate: any, index: number) => (
            <Card
              key={debate._id}
              className={`transition-all duration-200 ${
                selectedDebateIndex === index ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => setSelectedDebateIndex(selectedDebateIndex === index ? null : index)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {editingRoom === debate._id ? (
                      <Input
                        value={debate.room_name || ''}
                        onChange={(e) => updateRoomName(index, e.target.value)}
                        onBlur={() => setEditingRoom(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') setEditingRoom(null);
                          if (e.key === 'Escape') setEditingRoom(null);
                        }}
                        className="w-32"
                        autoFocus
                      />
                    ) : (
                      <CardTitle
                        className={`cursor-pointer hover:text-primary ${
                          canEditRoomNames && isDraft ? 'hover:underline' : ''
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (canEditRoomNames && isDraft) {
                            setEditingRoom(debate._id);
                          }
                        }}
                      >
                        {debate.room_name || `Room ${index + 1}`}
                      </CardTitle>
                    )}

                    {debate.is_public_speaking && (
                      <Badge variant="secondary" className="gap-1">
                        <Timer className="h-3 w-3" />
                        Public Speaking
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <ConflictBadge conflicts={debate.pairing_conflicts || debate.conflicts || []} />

                    {debate.quality_score !== undefined && (
                      <QualityBadge score={debate.quality_score} />
                    )}

                    {canEditPairings && !debate.is_public_speaking && isDraft && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          swapSides(index);
                        }}
                        title="Swap team sides"
                      >
                        <ArrowLeftRight className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {debate.is_public_speaking ? (
                  <div>
                    <div className="mb-2">
                      <span className="text-sm font-medium text-muted-foreground">Public Speaking:</span>
                    </div>
                    <TeamCard
                      team={debate.proposition_team}
                      position="proposition"
                      debateIndex={index}
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-sm font-medium text-green-700">Proposition</span>
                        <Badge variant="outline" className="text-green-700 border-green-700 text-xs">
                          Prop
                        </Badge>
                      </div>
                      <TeamCard
                        team={debate.proposition_team}
                        position="proposition"
                        debateIndex={index}
                      />
                    </div>

                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-sm font-medium text-red-700">Opposition</span>
                        <Badge variant="outline" className="text-red-700 border-red-700 text-xs">
                          Opp
                        </Badge>
                      </div>
                      <TeamCard
                        team={debate.opposition_team}
                        position="opposition"
                        debateIndex={index}
                      />
                    </div>
                  </div>
                )}

                {!debate.is_public_speaking && (
                  <>
                    <Separator />
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">
                          Judges ({debate.judge_details?.length || 0})
                        </span>
                        {canEditJudges && (
                          <>
                            {isDraft ? (
                              <JudgeSelectionDialog
                                debate={debate}
                                debateIndex={index}
                                onUpdate={(judges, headJudge) => updateDebateJudges(index, judges, headJudge)}
                              />
                            ) : (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <Edit3 className="h-3 w-3 mr-1" />
                                    Edit
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Edit Saved Pairing - {debate.room_name}</DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-4">
                                    <div className="text-sm text-muted-foreground">
                                      Update room name, judges, or other details for this saved pairing.
                                    </div>

                                    <div className="space-y-2">
                                      <Label>Room Name</Label>
                                      <Input
                                        defaultValue={debate.room_name}
                                        onChange={(e) => {
                                          setTimeout(() => {
                                            updateSavedPairing(debate._id, { room_name: e.target.value });
                                          }, 1000);
                                        }}
                                      />
                                    </div>

                                    <div className="text-sm">
                                      For advanced judge changes, please create new draft pairings.
                                    </div>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            )}
                          </>
                        )}
                      </div>

                      {debate.judge_details && debate.judge_details.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {debate.judge_details.map((judge: Judge) => (
                            <Badge
                              key={judge._id}
                              variant={judge._id === debate.head_judge?._id ? "default" : "outline"}
                              className="gap-1"
                            >
                              {judge.name}
                              {judge._id === debate.head_judge?._id && (
                                <Trophy className="h-3 w-3" />
                              )}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">No judges assigned</div>
                      )}
                    </div>
                  </>
                )}

                
                {canViewConflicts && (debate.pairing_conflicts || debate.conflicts) &&
                  (debate.pairing_conflicts || debate.conflicts).length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <div className="text-sm font-medium">Conflicts:</div>
                        {(debate.pairing_conflicts || debate.conflicts).map((conflict: any, i: number) => (
                          <Alert key={i} variant={conflict.severity === 'error' ? 'destructive' : 'default'}>
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription className="text-xs">
                              <span className="font-medium capitalize">{conflict.type.replace('_', ' ')}: </span>
                              {conflict.description}
                            </AlertDescription>
                          </Alert>
                        ))}
                      </div>
                    </>
                  )}

                {selectedDebateIndex === index && (
                  <>
                    <Separator />
                    <div className="space-y-2 text-sm">
                      <div className="font-medium">Debate Details:</div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-muted-foreground">Status:</span>
                          <span className="ml-2 capitalize">{debate.status}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Type:</span>
                          <span className="ml-2">
                            {debate.is_public_speaking ? 'Public Speaking' : 'Debate'}
                          </span>
                        </div>
                        {canViewQualityScores && debate.quality_score !== undefined && (
                          <div>
                            <span className="text-muted-foreground">Quality Score:</span>
                            <span className="ml-2">{debate.quality_score.toFixed(1)}/100</span>
                          </div>
                        )}
                        <div>
                          <span className="text-muted-foreground">Round Type:</span>
                          <span className="ml-2">
                            {currentRound <= tournament.prelim_rounds ? 'Preliminary' : 'Elimination'}
                          </span>
                        </div>
                      </div>

                      {!debate.is_public_speaking && (debate.proposition_team || debate.opposition_team) && (
                        <div className="mt-3 pt-2 border-t">
                          <div className="font-medium mb-2">Team Performance:</div>
                          <div className="grid grid-cols-2 gap-4 text-xs">
                            {debate.proposition_team && (
                              <div>
                                <div className="font-medium text-green-700">{debate.proposition_team.name}</div>
                                
                                {canViewConflicts && (
                                  <div className="text-muted-foreground">
                                    Payment: {debate.proposition_team.payment_status}
                                  </div>
                                )}
                              </div>
                            )}
                            {debate.opposition_team && (
                              <div>
                                <div className="font-medium text-red-700">{debate.opposition_team.name}</div>
                                
                                {canViewConflicts && (
                                  <div className="text-muted-foreground">
                                    Payment: {debate.opposition_team.payment_status}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        
        {displayPairings.length === 0 && (
          <Card className="m-4">
            <CardContent className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className=" font-medium mb-2">No Pairings Yet</h3>
              <p className="text-muted-foreground text-sm mb-4">
                {canGeneratePairings
                  ? `Generate pairings for Round ${currentRound} to get started.
                     ${currentRound <= 5 ? ' Using fold system.' : ' Using Swiss system.'}`
                  : `Pairings for Round ${currentRound} have not been generated yet.`
                }
              </p>
              {canGeneratePairings && (
                <div className="space-y-2">
                  <Button onClick={generatePairings} disabled={isGenerating}>
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Generating... {generationProgress}%
                      </>
                    ) : (
                      <>
                        <Shuffle className="h-4 w-4 mr-2" />
                        Generate Pairings
                      </>
                    )}
                  </Button>

                  {tournament.prelim_rounds <= 5 && currentRound === 1 && (
                    <div className="text-xs text-muted-foreground max-w-md mx-auto">
                      💡 With {tournament.prelim_rounds} preliminary rounds, you can generate all rounds at once using the fold system for optimal fairness
                    </div>
                  )}

                  {currentRound > 5 && (
                    <div className="text-xs text-muted-foreground max-w-md mx-auto">
                      ⚡ Using Swiss pairing system - teams with similar performance will be matched
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        
        {isGenerating && canGeneratePairings && (
          <div className="fixed inset-0 bg-background/50 backdrop-blur-sm z-50 flex items-center justify-center">
            <Card className="w-96">
              <CardContent className="p-6">
                <div className="text-center space-y-4">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                  <div>
                    <h3 className="font-medium">Generating Pairings</h3>
                    <p className="text-sm text-muted-foreground">
                      Creating optimal matchups for Round {currentRound}...
                    </p>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${generationProgress}%` }}
                    />
                  </div>
                  <div className="text-sm font-medium">{generationProgress}%</div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        
        {canUseKeyboardShortcuts && isDraft && displayPairings.length > 0 && (
          <div className="fixed bottom-4 right-4 z-40">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="opacity-70 hover:opacity-100">
                  <Info className="h-3 w-3 mr-1" />
                  Help
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Pairing Controls</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Keyboard Shortcuts</h4>
                    <div className="text-sm space-y-1">
                      <div><kbd className="px-2 py-1 bg-muted rounded text-xs">Ctrl+Z</kbd> - Undo</div>
                      <div><kbd className="px-2 py-1 bg-muted rounded text-xs">Ctrl+Y</kbd> - Redo</div>
                      <div><kbd className="px-2 py-1 bg-muted rounded text-xs">Ctrl+S</kbd> - Save Pairings</div>
                      <div><kbd className="px-2 py-1 bg-muted rounded text-xs">Ctrl+G</kbd> - Generate Pairings</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Mouse Controls</h4>
                    <div className="text-sm space-y-1">
                      <div>• <strong>Drag & Drop</strong> - Move teams between positions</div>
                      <div>• <strong>Click Room Name</strong> - Edit room name</div>
                      <div>• <strong>Click Swap Button</strong> - Switch team sides</div>
                      <div>• <strong>Click Card</strong> - Expand debate details</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Quality Indicators</h4>
                    <div className="text-sm space-y-1">
                      <div>🟢 <strong>Green (90+)</strong> - Excellent pairing</div>
                      <div>🟡 <strong>Yellow (70-89)</strong> - Good pairing</div>
                      <div>🔴 <strong>Red (&lt;70)</strong> - Needs attention</div>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}

        
        {autoSaveDrafts && isDraft && lastSavedTimestamp && canEditPairings && (
          <div className="fixed bottom-4 left-4 z-40">
            <div className="bg-muted/80 text-muted-foreground px-3 py-1 rounded-full text-xs flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              Auto-saved
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}