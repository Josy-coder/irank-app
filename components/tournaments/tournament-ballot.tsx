"use client";

import React, { useState, useEffect, useMemo} from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Progress } from "@/components/ui/progress";
import {
  FileText,
  Users,
  Crown,
  CheckCircle,
  Clock,
  AlertTriangle,
  Edit3,
  Eye,
  Download,
  Timer,
  MessageSquare,
  BarChart3,
  Mic,
  MicOff,
  Play,
  Pause,
  Square,
  ArrowUp,
  ArrowDown,
  Users2,
  Brain,
  Shield,
  Target,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";
import { useGeminiValidation } from "@/hooks/useGeminiValidation";

interface TournamentBallotsProps {
  tournament: any;
  userRole: "admin" | "school_admin" | "volunteer" | "student";
  token: string;
  userId?: string;
  schoolId?: string;
}

const SCORING_CATEGORIES = [
  { key: "content_knowledge", label: "Content & Knowledge", icon: Brain, description: "Understanding of topic and evidence quality", color: "text-blue-600" },
  { key: "argumentation_logic", label: "Argumentation & Logic", icon: Target, description: "Logical flow and reasoning strength", color: "text-green-600" },
  { key: "presentation_style", label: "Presentation Style", icon: Users2, description: "Speaking clarity and delivery", color: "text-purple-600" },
  { key: "teamwork_strategy", label: "Teamwork & Strategy", icon: Users, description: "Team coordination and strategic thinking", color: "text-orange-600" },
  { key: "rebuttal_response", label: "Rebuttal & Response", icon: Shield, description: "Handling of opposing arguments", color: "text-red-600" },
];

const SPEAKER_POSITIONS = [
  { id: "PM", label: "Prime Minister", team: "prop" },
  { id: "DPM", label: "Deputy Prime Minister", team: "prop" },
  { id: "MG", label: "Member of Government", team: "prop" },
  { id: "LO", label: "Leader of Opposition", team: "opp" },
  { id: "DLO", label: "Deputy Leader of Opposition", team: "opp" },
  { id: "MO", label: "Member of Opposition", team: "opp" },
];

function BallotSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-4 w-48" />
              </div>
              <Skeleton className="h-6 w-20" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-16" />
            </div>
            <Separator />
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-6 w-28" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function getDebateStatusColor(status: string) {
  switch (status) {
    case "completed": return "bg-green-100 text-green-800";
    case "inProgress": return "bg-blue-100 text-blue-800";
    case "pending": return "bg-yellow-100 text-yellow-800";
    case "noShow": return "bg-red-100 text-red-800";
    default: return "bg-gray-100 text-gray-800";
  }
}

function getDebateStatusIcon(status: string) {
  switch (status) {
    case "completed": return CheckCircle;
    case "inProgress": return Timer;
    case "pending": return Clock;
    case "noShow": return AlertTriangle;
    default: return Clock;
  }
}

function calculateFinalScore(scores: Record<string, number>): number {
  const rawScore = Object.values(scores).reduce((sum, score) => sum + score, 0);
  const attendanceBonus = 5;
  const totalRaw = rawScore + attendanceBonus;
  let finalScore = (totalRaw / 55) * 30;

  if (finalScore < 16.3) {
    finalScore = 16.3;
  }

  return Math.round(finalScore * 10) / 10;
}

function DebateTimer({ debate }: any) {
  const [currentTime, setCurrentTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [speakingTime, setSpeakingTime] = useState(0);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning) {
      interval = setInterval(() => {
        setCurrentTime(prev => prev + 1);
        setSpeakingTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="p-4">
      <div className="text-center space-y-4">
        <div className="text-3xl font-bold font-mono">
          {formatTime(currentTime)}
        </div>

        <div className="flex justify-center gap-2">
          <Button
            onClick={() => setIsRunning(!isRunning)}
            variant={isRunning ? "destructive" : "default"}
          >
            {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>

          <Button
            onClick={() => {
              setCurrentTime(0);
              setSpeakingTime(0);
              setIsRunning(false);
            }}
            variant="outline"
          >
            <Square className="h-4 w-4" />
          </Button>

          <Button
            onClick={() => setIsRecording(!isRecording)}
            variant={isRecording ? "destructive" : "outline"}
          >
            {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
        </div>

        <div className="text-sm text-muted-foreground space-y-1">
          <div>Speaking Time: {formatTime(speakingTime)}</div>
          <div>Current Speaker: {debate.current_speaker || "None"}</div>
          <div>POIs: {debate.poi_count || 0}</div>
        </div>
      </div>
    </Card>
  );
}

function ArgumentFlow({ debate, onAddArgument }: any) {
  const [newArgument, setNewArgument] = useState("");
  const [argumentType, setArgumentType] = useState<"main" | "rebuttal" | "poi">("main");

  const handleAddArgument = () => {
    if (!newArgument.trim()) return;

    onAddArgument({
      type: argumentType,
      content: newArgument,
      timestamp: Date.now(),
    });

    setNewArgument("");
  };

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <h4 className="font-medium flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Argument Flow
        </h4>

        <ScrollArea className="h-40">
          <div className="space-y-2">
            {debate.argument_flow?.map((arg: any, index: number) => (
              <div key={index} className="p-2 border rounded text-sm">
                <Badge variant="outline" className="mb-1">
                  {arg.type}
                </Badge>
                <p>{arg.content}</p>
                <div className="text-xs text-muted-foreground mt-1">
                  {new Date(arg.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="space-y-2">
          <div className="flex gap-2">
            <Select value={argumentType} onValueChange={(value: any) => setArgumentType(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="main">Main</SelectItem>
                <SelectItem value="rebuttal">Rebuttal</SelectItem>
                <SelectItem value="poi">POI</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Add argument..."
              value={newArgument}
              onChange={(e) => setNewArgument(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddArgument()}
            />
            <Button onClick={handleAddArgument} size="sm">
              Add
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function CollaborativeNotes({ debate, userId, onUpdateNotes }: any) {
  const [notes, setNotes] = useState("");
  const [visibility, setVisibility] = useState<"private" | "judges" | "all">("judges");

  const handleSaveNote = () => {
    if (!notes.trim()) return;

    onUpdateNotes({
      content: notes,
      author: userId,
      timestamp: Date.now(),
      visibility,
    });

    setNotes("");
  };

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Collaborative Notes
          </h4>
          <Select value={visibility} onValueChange={(value: any) => setVisibility(value)}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="private">Private</SelectItem>
              <SelectItem value="judges">Judges</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <ScrollArea className="h-32">
          <div className="space-y-2">
            {debate.shared_notes?.map((note: any, index: number) => (
              <div key={index} className="p-2 bg-muted rounded text-sm">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-medium">Judge {note.author}</span>
                  <Badge variant="outline" className="text-xs">
                    {note.visibility}
                  </Badge>
                </div>
                <p>{note.content}</p>
                <div className="text-xs text-muted-foreground mt-1">
                  {new Date(note.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="space-y-2">
          <Textarea
            placeholder="Add a note..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
          <Button onClick={handleSaveNote} size="sm" className="w-full">
            Save Note
          </Button>
        </div>
      </div>
    </Card>
  );
}

function SpeakerPositionManager({ speakers, positions, onUpdatePositions }: any) {
  const [speakerPositions, setSpeakerPositions] = useState<Record<string, string>>(positions || {});

  const handlePositionChange = (speakerId: string, newPosition: string) => {
    const newPositions = { ...speakerPositions };

    const currentSpeakerWithPosition = Object.keys(newPositions).find(
      id => newPositions[id] === newPosition
    );

    if (currentSpeakerWithPosition) {
      newPositions[currentSpeakerWithPosition] = speakerPositions[speakerId] || "";
    }

    newPositions[speakerId] = newPosition;
    setSpeakerPositions(newPositions);
    onUpdatePositions(newPositions);
  };

  const movePosition = (speakerId: string, direction: "up" | "down") => {
    const currentPosition = speakerPositions[speakerId];
    const currentIndex = SPEAKER_POSITIONS.findIndex(p => p.id === currentPosition);

    if (currentIndex === -1) return;

    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= SPEAKER_POSITIONS.length) return;

    const newPosition = SPEAKER_POSITIONS[newIndex];
    handlePositionChange(speakerId, newPosition.id);
  };

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <h4 className="font-medium">Speaker Positions</h4>

        <div className="space-y-2">
          {speakers.map((speaker: any) => (
            <div key={speaker.id} className="flex items-center gap-2 p-2 border rounded">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{speaker.name}</p>
                <p className="text-sm text-muted-foreground">
                  {SPEAKER_POSITIONS.find(p => p.id === speakerPositions[speaker.id])?.label || "Unassigned"}
                </p>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => movePosition(speaker.id, "up")}
                  disabled={speakerPositions[speaker.id] === SPEAKER_POSITIONS[0]?.id}
                >
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => movePosition(speaker.id, "down")}
                  disabled={speakerPositions[speaker.id] === SPEAKER_POSITIONS[SPEAKER_POSITIONS.length - 1]?.id}
                >
                  <ArrowDown className="h-3 w-3" />
                </Button>
              </div>

              <Select
                value={speakerPositions[speaker.id] || ""}
                onValueChange={(value) => handlePositionChange(speaker.id, value)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Select position" />
                </SelectTrigger>
                <SelectContent>
                  {SPEAKER_POSITIONS.map((position) => (
                    <SelectItem key={position.id} value={position.id}>
                      {position.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function JudgingInterface({ debate, ballot, userId, onSubmitBallot }: any) {
  const { validateFeedback, isValidating } = useGeminiValidation();
  const [scores, setScores] = useState<Record<string, Record<string, number>>>({});
  const [teamWinner, setTeamWinner] = useState<string>("");
  const [winningPosition, setWinningPosition] = useState<"proposition" | "opposition" | "">("");
  const [notes, setNotes] = useState("");
  const [speakerComments, setSpeakerComments] = useState<Record<string, string>>({});
  const [speakerPositions, setSpeakerPositions] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [isMobile, setIsMobile] = useState(false);

  const isHeadJudge = debate.head_judge_id === debate.my_submission?.judge_id;
  const canEdit = !ballot?.feedback_submitted;

  useEffect(() => {
    const checkIsMobile = () => setIsMobile(window.innerWidth < 768);
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  useEffect(() => {
    if (ballot) {

      const loadedScores: Record<string, Record<string, number>> = {};
      ballot.speaker_scores?.forEach((score: any) => {
        loadedScores[score.speaker_id] = {
          content_knowledge: score.content_knowledge || 0,
          argumentation_logic: score.argumentation_logic || 0,
          presentation_style: score.presentation_style || 0,
          teamwork_strategy: score.teamwork_strategy || 0,
          rebuttal_response: score.rebuttal_response || 0,
        };
        setSpeakerComments(prev => ({
          ...prev,
          [score.speaker_id]: score.comments || ""
        }));
      });
      setScores(loadedScores);
      setTeamWinner(ballot.winning_team_id || "");
      setWinningPosition(ballot.winning_position || "");
      setNotes(ballot.notes || "");
    }
  }, [ballot]);

  const updateScore = (speakerId: string, category: string, value: number) => {
    if (!canEdit) return;

    setScores(prev => ({
      ...prev,
      [speakerId]: {
        ...prev[speakerId],
        [category]: Math.max(0, Math.min(10, value))
      }
    }));
  };

  const updateSpeakerComment = (speakerId: string, comment: string) => {
    if (!canEdit) return;

    setSpeakerComments(prev => ({
      ...prev,
      [speakerId]: comment
    }));
  };

  const handleValidation = async () => {
    const allComments = Object.values(speakerComments).join(" ");
    const result = await validateFeedback(allComments, speakerComments, notes);
    setValidationResult(result);
    return result;
  };

  const handleSubmit = async (isFinal: boolean = false) => {
    if (!canEdit && !isHeadJudge) return;

    setIsSubmitting(true);

    try {

      const validation = await handleValidation();

      if (!validation.isAppropriate) {
        toast.error("Please review your feedback before submitting", {
          description: validation.issues?.[0] || "Inappropriate content detected",
        });
        setIsSubmitting(false);
        return;
      }

      const speakerScores = Object.entries(scores).map(([speakerId, categoryScores]) => {
        const finalScore = calculateFinalScore(categoryScores);
        const position = speakerPositions[speakerId] || "Speaker";

        return {
          speaker_id: speakerId as Id<"users">,
          team_id: debate.proposition_team?.members.includes(speakerId)
            ? debate.proposition_team._id
            : debate.opposition_team._id,
          position,
          score: finalScore,
          ...categoryScores,
          comments: speakerComments[speakerId] || "",
          clarity: 0,
          fairness: 0,
          knowledge: 0,
          helpfulness: 0,
          bias_detected: false,
          bias_explanation: "",
        };
      });

      await onSubmitBallot({
        debate_id: debate._id,
        winning_team_id: teamWinner as Id<"teams">,
        winning_position: winningPosition as "proposition" | "opposition",
        speaker_scores: speakerScores,
        notes,
        is_final_submission: isFinal,
      });

      toast.success(isFinal ? "Ballot submitted successfully!" : "Ballot draft saved!");

    } catch (error: any) {
      toast.error(error.message || "Failed to submit ballot");
    } finally {
      setIsSubmitting(false);
    }
  };

  const allSpeakers = [
    ...(debate.proposition_team?.members || []),
    ...(debate.opposition_team?.members || [])
  ];

  if (isMobile) {
    return (
      <Drawer>
        <DrawerTrigger asChild>
          <Button className="w-full">
            <Edit3 className="h-4 w-4 mr-2" />
            Open Judging Interface
          </Button>
        </DrawerTrigger>
        <DrawerContent className="max-h-[95vh]">
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <Edit3 className="h-5 w-5" />
              Judge Ballot - {debate.room_name}
              {isHeadJudge && (
                <Badge variant="default" className="ml-2">
                  <Crown className="h-3 w-3 mr-1" />
                  Head Judge
                </Badge>
              )}
            </DrawerTitle>
          </DrawerHeader>

          <ScrollArea className="flex-1 px-4">
            <div className="space-y-6 pb-4">
              
              <Tabs defaultValue="scoring" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="scoring">Scoring</TabsTrigger>
                  <TabsTrigger value="winner">Winner</TabsTrigger>
                  <TabsTrigger value="tools">Tools</TabsTrigger>
                  <TabsTrigger value="notes">Notes</TabsTrigger>
                </TabsList>

                <TabsContent value="scoring" className="space-y-4 mt-4">
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 border rounded-lg">
                      <h4 className="font-medium text-green-700 text-sm mb-1">Proposition</h4>
                      <p className="font-semibold text-sm">{debate.proposition_team?.name}</p>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <h4 className="font-medium text-red-700 text-sm mb-1">Opposition</h4>
                      <p className="font-semibold text-sm">{debate.opposition_team?.name}</p>
                    </div>
                  </div>

                  
                  {allSpeakers.map((speakerId) => {
                    const speakerScores = scores[speakerId] || {};
                    const finalScore = calculateFinalScore(speakerScores);
                    const team = debate.proposition_team?.members.includes(speakerId)
                      ? debate.proposition_team
                      : debate.opposition_team;

                    return (
                      <Card key={speakerId} className="p-3">
                        <div className="space-y-3">
                          
                          <div className="flex justify-between items-center">
                            <div>
                              <h4 className="font-medium">Speaker {speakerId}</h4>
                              <p className="text-xs text-muted-foreground">{team?.name}</p>
                            </div>
                            <div className="text-right">
                              <div className="text-xl font-bold text-primary">{finalScore}</div>
                              <div className="text-xs text-muted-foreground">out of 30</div>
                            </div>
                          </div>

                          
                          <div className="grid grid-cols-2 gap-3">
                            {SCORING_CATEGORIES.map((category) => {
                              const CategoryIcon = category.icon;
                              return (
                                <div key={category.key} className="space-y-2">
                                  <Label className="text-xs flex items-center gap-1">
                                    <CategoryIcon className={`h-3 w-3 ${category.color}`} />
                                    {category.label.split(' ')[0]}
                                  </Label>
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="number"
                                      min="0"
                                      max="10"
                                      value={speakerScores[category.key] || 0}
                                      onChange={(e) => updateScore(speakerId, category.key, parseInt(e.target.value) || 0)}
                                      disabled={!canEdit}
                                      className="w-16 text-center"
                                    />
                                    <span className="text-xs text-muted-foreground">/10</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          
                          <div className="space-y-2">
                            <Label className="text-xs">Feedback</Label>
                            <Textarea
                              placeholder="Quick feedback..."
                              value={speakerComments[speakerId] || ""}
                              onChange={(e) => updateSpeakerComment(speakerId, e.target.value)}
                              disabled={!canEdit}
                              rows={2}
                              className="text-sm"
                            />
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </TabsContent>

                <TabsContent value="winner" className="space-y-4 mt-4">
                  {canEdit && (
                    <div className="space-y-4">
                      <Label className="text-base font-medium">Select Winning Team</Label>
                      <div className="space-y-3">
                        <Button
                          variant={teamWinner === debate.proposition_team?._id ? "default" : "outline"}
                          onClick={() => {
                            setTeamWinner(debate.proposition_team._id);
                            setWinningPosition("proposition");
                          }}
                          className="w-full p-4 h-auto"
                        >
                          <div className="text-center">
                            <div className="font-medium">{debate.proposition_team?.name}</div>
                            <div className="text-sm opacity-75">Proposition</div>
                          </div>
                        </Button>
                        <Button
                          variant={teamWinner === debate.opposition_team?._id ? "default" : "outline"}
                          onClick={() => {
                            setTeamWinner(debate.opposition_team._id);
                            setWinningPosition("opposition");
                          }}
                          className="w-full p-4 h-auto"
                        >
                          <div className="text-center">
                            <div className="font-medium">{debate.opposition_team?.name}</div>
                            <div className="text-sm opacity-75">Opposition</div>
                          </div>
                        </Button>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="tools" className="space-y-4 mt-4">
                  <div className="grid gap-4">
                    <DebateTimer debate={debate} onTimeUpdate={() => {}} />
                    <SpeakerPositionManager
                      speakers={allSpeakers.map(id => ({ id, name: `Speaker ${id}` }))}
                      positions={speakerPositions}
                      onUpdatePositions={setSpeakerPositions}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="notes" className="space-y-4 mt-4">
                  <div className="space-y-4">
                    <CollaborativeNotes
                      debate={debate}
                      userId={userId}
                      onUpdateNotes={() => {}}
                    />

                    <div className="space-y-2">
                      <Label className="text-base font-medium">Personal Judge Notes</Label>
                      <Textarea
                        placeholder="Additional notes about the debate..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        disabled={!canEdit}
                        rows={4}
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              
              {validationResult && !validationResult.isAppropriate && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {validationResult.issues?.[0] || "Please review your feedback for appropriateness"}
                  </AlertDescription>
                </Alert>
              )}

              
              {canEdit && (
                <div className="flex flex-col gap-2 pt-4">
                  <Button
                    onClick={() => handleSubmit(false)}
                    variant="outline"
                    disabled={isSubmitting || isValidating}
                    className="w-full"
                  >
                    {isValidating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Validating...
                      </>
                    ) : (
                      "Save Draft"
                    )}
                  </Button>
                  <Button
                    onClick={() => handleSubmit(true)}
                    disabled={isSubmitting || !teamWinner || isValidating}
                    className="w-full"
                  >
                    {isSubmitting ? "Submitting..." : "Submit Final Ballot"}
                  </Button>
                </div>
              )}

              {ballot?.feedback_submitted && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Ballot has been submitted and cannot be edited.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </ScrollArea>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Edit3 className="h-5 w-5" />
            Judge Ballot - {debate.room_name}
          </CardTitle>
          {isHeadJudge && (
            <Badge variant="default" className="w-fit">
              <Crown className="h-3 w-3 mr-1" />
              Head Judge
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <div className="lg:col-span-2 space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium text-green-700 mb-2">Proposition</h4>
                  <p className="font-semibold">{debate.proposition_team?.name}</p>
                  <p className="text-sm text-muted-foreground">{debate.proposition_team?.school?.name}</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium text-red-700 mb-2">Opposition</h4>
                  <p className="font-semibold">{debate.opposition_team?.name}</p>
                  <p className="text-sm text-muted-foreground">{debate.opposition_team?.school?.name}</p>
                </div>
              </div>

              
              {canEdit && (
                <div className="space-y-4">
                  <Label className="text-base font-medium">Winning Team</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button
                      variant={teamWinner === debate.proposition_team?._id ? "default" : "outline"}
                      onClick={() => {
                        setTeamWinner(debate.proposition_team._id);
                        setWinningPosition("proposition");
                      }}
                      className="p-4 h-auto"
                    >
                      <div className="text-center">
                        <div className="font-medium">{debate.proposition_team?.name}</div>
                        <div className="text-sm opacity-75">Proposition</div>
                      </div>
                    </Button>
                    <Button
                      variant={teamWinner === debate.opposition_team?._id ? "default" : "outline"}
                      onClick={() => {
                        setTeamWinner(debate.opposition_team._id);
                        setWinningPosition("opposition");
                      }}
                      className="p-4 h-auto"
                    >
                      <div className="text-center">
                        <div className="font-medium">{debate.opposition_team?.name}</div>
                        <div className="text-sm opacity-75">Opposition</div>
                      </div>
                    </Button>
                  </div>
                </div>
              )}

              
              <div className="space-y-6">
                <Label className="text-base font-medium">Speaker Scores</Label>

                {allSpeakers.map((speakerId) => {
                  const speakerScores = scores[speakerId] || {};
                  const finalScore = calculateFinalScore(speakerScores);
                  const team = debate.proposition_team?.members.includes(speakerId)
                    ? debate.proposition_team
                    : debate.opposition_team;

                  return (
                    <Card key={speakerId} className="p-6">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="font-medium">Speaker {speakerId}</h4>
                            <p className="text-sm text-muted-foreground">{team?.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Position: {SPEAKER_POSITIONS.find(p => p.id === speakerPositions[speakerId])?.label || "Unassigned"}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-3xl font-bold text-primary">{finalScore}</div>
                            <div className="text-sm text-muted-foreground">out of 30</div>
                            <Progress value={(finalScore / 30) * 100} className="w-20 mt-1" />
                          </div>
                        </div>

                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {SCORING_CATEGORIES.map((category) => {
                            const CategoryIcon = category.icon;
                            const score = speakerScores[category.key] || 0;
                            return (
                              <div key={category.key} className="space-y-2">
                                <Label className="text-sm flex items-center gap-2">
                                  <CategoryIcon className={`h-4 w-4 ${category.color}`} />
                                  {category.label}
                                </Label>
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="number"
                                      min="0"
                                      max="10"
                                      value={score}
                                      onChange={(e) => updateScore(speakerId, category.key, parseInt(e.target.value) || 0)}
                                      disabled={!canEdit}
                                      className="w-20"
                                    />
                                    <span className="text-sm text-muted-foreground">/ 10</span>
                                  </div>
                                  <Progress value={(score / 10) * 100} className="w-full" />
                                </div>
                                <p className="text-xs text-muted-foreground">{category.description}</p>
                              </div>
                            );
                          })}
                        </div>

                        
                        <div className="space-y-2">
                          <Label className="text-sm">Comments & Feedback</Label>
                          <Textarea
                            placeholder="Provide constructive feedback..."
                            value={speakerComments[speakerId] || ""}
                            onChange={(e) => updateSpeakerComment(speakerId, e.target.value)}
                            disabled={!canEdit}
                            rows={3}
                          />
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>

              
              <div className="space-y-2">
                <Label className="text-base font-medium">Judge Notes</Label>
                <Textarea
                  placeholder="Additional notes about the debate..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={!canEdit}
                  rows={4}
                />
              </div>
            </div>

            
            <div className="space-y-4">
              <DebateTimer debate={debate} onTimeUpdate={() => {}} />
              <ArgumentFlow debate={debate} onAddArgument={() => {}} />
              <CollaborativeNotes debate={debate} userId={userId} onUpdateNotes={() => {}} />
              <SpeakerPositionManager
                speakers={allSpeakers.map(id => ({ id, name: `Speaker ${id}` }))}
                positions={speakerPositions}
                onUpdatePositions={setSpeakerPositions}
              />
            </div>
          </div>

          
          {validationResult && (
            <div className="mt-6">
              {validationResult.isAppropriate ? (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Feedback validation passed. Confidence: {(validationResult.confidence * 100).toFixed(0)}%
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <p>Please review your feedback:</p>
                      <ul className="list-disc list-inside text-sm">
                        {validationResult.issues?.map((issue: string, index: number) => (
                          <li key={index}>{issue}</li>
                        ))}
                      </ul>
                      {validationResult.suggestions && validationResult.suggestions.length > 0 && (
                        <div>
                          <p className="font-medium">Suggestions:</p>
                          <ul className="list-disc list-inside text-sm">
                            {validationResult.suggestions.map((suggestion: string, index: number) => (
                              <li key={index}>{suggestion}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          
          {canEdit && (
            <div className="flex gap-2 pt-6 border-t">
              <Button
                onClick={() => handleSubmit(false)}
                variant="outline"
                disabled={isSubmitting || isValidating}
              >
                {isValidating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Validating...
                  </>
                ) : (
                  "Save Draft"
                )}
              </Button>
              <Button
                onClick={() => handleSubmit(true)}
                disabled={isSubmitting || !teamWinner || isValidating}
              >
                {isSubmitting ? "Submitting..." : "Submit Final Ballot"}
              </Button>
              <Button
                onClick={handleValidation}
                variant="outline"
                disabled={isValidating}
                className="ml-auto"
              >
                <Shield className="h-4 w-4 mr-2" />
                Validate Feedback
              </Button>
            </div>
          )}

          {ballot?.feedback_submitted && (
            <Alert className="mt-6">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Ballot has been submitted and cannot be edited.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BallotCard({ debate, userRole, userId, onViewDetails, onEditBallot }: any) {
  const StatusIcon = getDebateStatusIcon(debate.status);

  const canEdit = userRole === "admin" ||
    (userRole === "volunteer" && debate.judges?.some((j: any) => j._id === userId));

  const canSeeDetails = debate.can_see_full_details || userRole === "admin" || userRole === "volunteer";

  const submissionProgress = debate.judges?.length > 0
    ? (debate.final_submissions_count || 0) / debate.judges.length * 100
    : 0;

  return (
    <Card className="hover:shadow-md transition-all duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg">{debate.room_name}</CardTitle>
            <Badge variant="secondary" className={getDebateStatusColor(debate.status)}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {debate.status}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {debate.recording && (
              <Button variant="ghost" size="sm" title="Download Recording">
                <Download className="h-4 w-4" />
              </Button>
            )}
            {canEdit && (
              <Button variant="ghost" size="sm" onClick={() => onEditBallot(debate)} title="Edit Ballot">
                <Edit3 className="h-4 w-4" />
              </Button>
            )}
            {canSeeDetails && (
              <Button variant="ghost" size="sm" onClick={() => onViewDetails(debate)} title="View Details">
                <Eye className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-green-700 border-green-700">Prop</Badge>
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{debate.proposition_team?.name}</p>
              {debate.proposition_team?.school && (
                <p className="text-xs text-muted-foreground truncate">
                  {debate.proposition_team.school.name}
                </p>
              )}
            </div>
            {debate.winning_team_id === debate.proposition_team?._id && (
              <Crown className="h-4 w-4 text-yellow-500" />
            )}
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-red-700 border-red-700">Opp</Badge>
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{debate.opposition_team?.name}</p>
              {debate.opposition_team?.school && (
                <p className="text-xs text-muted-foreground truncate">
                  {debate.opposition_team.school.name}
                </p>
              )}
            </div>
            {debate.winning_team_id === debate.opposition_team?._id && (
              <Crown className="h-4 w-4 text-yellow-500" />
            )}
          </div>
        </div>

        <Separator />

        
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              Judges ({debate.judges?.length || 0})
            </span>
            {userRole === "admin" && (
              <div className="text-xs text-muted-foreground">
                {submissionProgress.toFixed(0)}% submitted
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {debate.judges?.map((judge: any) => (
              <Badge
                key={judge._id}
                variant={judge.is_head_judge ? "default" : "outline"}
                className="gap-1"
              >
                {judge.name || `Judge ${judge._id}`}
                {judge.is_head_judge && <Crown className="h-3 w-3" />}
                {userRole === "admin" && (
                  <div className="ml-1">
                    {judge.is_final ? (
                      <CheckCircle className="h-3 w-3 text-green-500" />
                    ) : judge.has_submitted ? (
                      <Clock className="h-3 w-3 text-yellow-500" />
                    ) : (
                      <div className="h-3 w-3 rounded-full bg-gray-300" />
                    )}
                  </div>
                )}
              </Badge>
            ))}
          </div>
        </div>

        
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Round {debate.round?.round_number}</span>
          <span>{debate.round?.type}</span>
        </div>

        
        {userRole === "admin" && debate.judges?.length > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>Submission Progress</span>
              <span>{debate.final_submissions_count || 0}/{debate.judges.length}</span>
            </div>
            <Progress value={submissionProgress} className="w-full h-2" />
          </div>
        )}

        
        {debate.winning_team_id && canSeeDetails && (
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Result:</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {debate.winning_team_id === debate.proposition_team?._id
                    ? debate.proposition_team.name
                    : debate.opposition_team?.name
                  } wins
                </span>
                <Badge variant="outline" className={
                  debate.winning_position === "proposition"
                    ? "text-green-700 border-green-700"
                    : "text-red-700 border-red-700"
                }>
                  {debate.winning_position}
                </Badge>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BallotDetailsDialog({ debate, isOpen, onClose }: any) {
  const [selectedJudge, setSelectedJudge] = useState<string>("all");

  const ballotDetails = debate?.ballot_details || [];
  const filteredBallots = selectedJudge === "all"
    ? ballotDetails
    : ballotDetails.filter((b: any) => b.judge_id === selectedJudge);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Ballot Details - {debate?.room_name || "Unknown Debate"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          
          {ballotDetails.length > 1 && (
            <div className="flex items-center gap-2">
              <Label>View Judge:</Label>
              <Select value={selectedJudge} onValueChange={setSelectedJudge}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Judges</SelectItem>
                  {ballotDetails.map((ballot: any) => (
                    <SelectItem key={ballot.judge_id} value={ballot.judge_id}>
                      {ballot.judge_name || `Judge ${ballot.judge_id}`}
                      {debate?.head_judge_id === ballot.judge_id && " (Head)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
            <div className="text-center">
              <h3 className="font-semibold text-green-700">{debate?.proposition_team?.name}</h3>
              <p className="text-sm text-muted-foreground">Proposition</p>
              {debate?.winning_team_id === debate?.proposition_team?._id && (
                <Badge variant="default" className="mt-2">
                  <Crown className="h-3 w-3 mr-1" />
                  Winner
                </Badge>
              )}
            </div>
            <div className="text-center">
              <h3 className="font-semibold text-red-700">{debate?.opposition_team?.name}</h3>
              <p className="text-sm text-muted-foreground">Opposition</p>
              {debate?.winning_team_id === debate?.opposition_team?._id && (
                <Badge variant="default" className="mt-2">
                  <Crown className="h-3 w-3 mr-1" />
                  Winner
                </Badge>
              )}
            </div>
          </div>

          
          {filteredBallots.map((ballot: any, index: number) => (
            <Card key={ballot.judge_id || index}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  {ballot.judge_name || `Judge ${ballot.judge_id}`}
                  {debate.head_judge_id === ballot.judge_id && (
                    <Badge variant="default">
                      <Crown className="h-3 w-3 mr-1" />
                      Head Judge
                    </Badge>
                  )}
                  {ballot.feedback_submitted && (
                    <Badge variant="outline" className="text-green-600">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Submitted
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Decision:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">
                        {ballot.winning_team_id === debate.proposition_team?._id
                          ? debate.proposition_team?.name
                          : debate.opposition_team?.name
                        }
                      </span>
                      <Badge variant="outline" className={
                        ballot.winning_position === "proposition"
                          ? "text-green-700 border-green-700"
                          : "text-red-700 border-red-700"
                      }>
                        {ballot.winning_position}
                      </Badge>
                    </div>
                  </div>
                </div>

                
                <div>
                  <h4 className="font-medium mb-3">Speaker Scores</h4>
                  <div className="space-y-3">
                    {ballot.speaker_scores?.map((score: any, scoreIndex: number) => (
                      <div key={scoreIndex} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h5 className="font-medium">Speaker {score.speaker_id}</h5>
                            <p className="text-sm text-muted-foreground">{score.position}</p>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-primary">{score.score}</div>
                            <div className="text-sm text-muted-foreground">out of 30</div>
                          </div>
                        </div>

                        
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                          {SCORING_CATEGORIES.map((category) => {
                            const CategoryIcon = category.icon;
                            const categoryScore = score[category.key] || 0;
                            return (
                              <div key={category.key} className="text-center">
                                <div className="flex items-center justify-center gap-1 mb-1">
                                  <CategoryIcon className={`h-3 w-3 ${category.color}`} />
                                  <span className="text-xs font-medium">{category.label.split(' ')[0]}</span>
                                </div>
                                <div className="text-sm font-bold">{categoryScore}/10</div>
                                <Progress value={(categoryScore / 10) * 100} className="h-1 mt-1" />
                              </div>
                            );
                          })}
                        </div>

                        
                        {score.comments && (
                          <div className="pt-3 border-t">
                            <Label className="text-xs font-medium">Judge Feedback:</Label>
                            <p className="text-sm mt-1 p-2 bg-muted rounded">{score.comments}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                
                {ballot.notes && (
                  <div className="pt-3 border-t">
                    <Label className="text-sm font-medium">Judge Notes:</Label>
                    <p className="text-sm mt-1 p-3 bg-muted rounded">{ballot.notes}</p>
                  </div>
                )}

                
                <div className="text-xs text-muted-foreground pt-2 border-t">
                  Submitted: {new Date(ballot.submitted_at).toLocaleString()}
                </div>
              </CardContent>
            </Card>
          ))}

          {filteredBallots.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No ballot details available</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function TournamentBallots({
                                            tournament,
                                            userRole,
                                            token,
                                            userId,
                                          }: TournamentBallotsProps) {
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedDebate, setSelectedDebate] = useState<any>(null);
  const [showJudgingInterface, setShowJudgingInterface] = useState(false);
  const [judgingDebate, setJudgingDebate] = useState<any>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  let queryFn: any;
  let queryArgs: any;

  if (userRole === "admin") {
    queryFn = api.functions.admin.ballots.getAllTournamentBallots;
    queryArgs = {
      token,
      tournament_id: tournament._id,
      round_number: selectedRound || undefined,
      status_filter: statusFilter !== "all" ? statusFilter as any : undefined,
    };
  } else if (userRole === "volunteer") {
    queryFn = api.functions.volunteers.ballots.getJudgeAssignedDebates;
    queryArgs = {
      token,
      tournament_id: tournament._id,
      round_number: selectedRound || undefined,
    };
  } else {
    queryFn = api.functions.ballots.getTournamentBallots;
    queryArgs = {
      token,
      tournament_id: tournament._id,
      round_number: selectedRound || undefined,
    };
  }

  const ballotsQuery = useQuery(queryFn, queryArgs);


  const submitBallot = useMutation(api.functions.volunteers.ballots.submitBallot);
  const updateBallot = useMutation(api.functions.admin.ballots.updateBallot);
  const flagBallot = useMutation(api.functions.admin.ballots.flagBallotForReview);

  const ballots = useMemo(() => ballotsQuery || [], [ballotsQuery]);
  const isLoading = ballotsQuery === undefined;

  const availableRounds = useMemo<number[]>(() => {
    if (!ballots || ballots.length === 0) return [];
    const rounds = ballots
      .map((b: any) => b.round?.round_number)
      .filter(Boolean)
      .sort((a: number, b: number) => a - b);
    return Array.from(new Set(rounds));
  }, [ballots]);

  const filteredBallots = useMemo(() => {
    if (!ballots) return [];

    let filtered = ballots;

    if (statusFilter !== "all") {
      filtered = filtered.filter((b: any) => b.status === statusFilter);
    }

    return filtered.sort((a: any, b: any) => {
      if (!a.round || !b.round) return 0;
      return a.round.round_number - b.round.round_number;
    });
  }, [ballots, statusFilter]);

  const handleViewDetails = (debate: any) => {
    setSelectedDebate(debate);
    setShowDetailsDialog(true);
  };

  const handleEditBallot = async (debate: any) => {
    if (userRole === "volunteer") {

      setJudgingDebate(debate);
      setShowJudgingInterface(true);
    } else if (userRole === "admin") {

      setJudgingDebate(debate);
      setShowJudgingInterface(true);
    }
  };

  const handleSubmitBallot = async (ballotData: any) => {
    try {
      if (userRole === "volunteer") {
        await submitBallot(ballotData);
      } else if (userRole === "admin") {

        await updateBallot({
          token,
          ballot_id: ballotData.ballot_id,
          updates: ballotData,
        });
      }
      setShowJudgingInterface(false);
      setJudgingDebate(null);
    } catch (error: any) {
      throw error;
    }
  };

  const handleFlagBallot = async (ballotId: string, reason: string) => {
    try {
      await flagBallot({
        token,
        ballot_id: ballotId as Id<"judging_scores">,
        reason,
      });
      toast.success("Ballot flagged for review");
    } catch (error: any) {
      toast.error(error.message || "Failed to flag ballot");
    }
  };

  const getStats = () => {
    const total = filteredBallots.length;
    const completed = filteredBallots.filter((b: any) => b.status === "completed").length;
    const inProgress = filteredBallots.filter((b: any) => b.status === "inProgress").length;
    const pending = filteredBallots.filter((b: any) => b.status === "pending").length;

    return { total, completed, inProgress, pending };
  };

  const stats = getStats();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <div className="flex bg-brown rounded-t-md flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-3">
            <div>
              <h2 className="text-xl text-white font-bold">Tournament Ballots</h2>
              <div className="text-xs text-gray-300">Loading...</div>
            </div>
          </div>
          <div className="p-4">
            <BallotSkeleton />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex bg-brown rounded-t-md flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-3">
          <div>
            <h2 className="text-xl text-white font-bold">Tournament Ballots</h2>
            <div className="flex items-center gap-4 text-xs text-gray-300">
              <span>{filteredBallots.length} debates</span>
              {userRole === "volunteer" && <span>Your judging assignments</span>}
              {userRole === "admin" && (
                <span>
                  {stats.completed} completed • {stats.inProgress} in progress • {stats.pending} pending
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Select value={selectedRound?.toString() || "all"} onValueChange={(value) => setSelectedRound(value === "all" ? null : Number(value))}>
              <SelectTrigger className="w-32 h-8 bg-background">
                <SelectValue placeholder="All Rounds" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Rounds</SelectItem>
                {availableRounds.map((round: number) => (
                  <SelectItem key={round} value={round.toString()}>
                    Round {round}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32 h-8 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="inProgress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="noShow">No Show</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="p-4">
          {filteredBallots.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium mb-2">No ballots found</h3>
              <p className="text-muted-foreground text-center text-sm max-w-sm mx-auto">
                {selectedRound || statusFilter !== "all"
                  ? "Try adjusting your filters to see more results"
                  : userRole === "volunteer"
                    ? "You don't have any judging assignments yet"
                    : "No debates have been created for this tournament yet"
                }
              </p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {filteredBallots.map((debate: any) => (
                <BallotCard
                  key={debate._id}
                  debate={debate}
                  userRole={userRole}
                  token={token}
                  userId={userId}
                  onViewDetails={handleViewDetails}
                  onEditBallot={handleEditBallot}
                />
              ))}
            </div>
          )}
        </div>
      </Card>

      
      {showJudgingInterface && judgingDebate && (
        <Dialog open={showJudgingInterface} onOpenChange={setShowJudgingInterface}>
          <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>Judging Interface</DialogTitle>
            </DialogHeader>
            <div className="overflow-y-auto max-h-[85vh]">
              <JudgingInterface
                debate={judgingDebate}
                ballot={judgingDebate.my_submission}
                userRole={userRole}
                token={token}
                onSubmitBallot={handleSubmitBallot}
                userId={userId}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      
      <BallotDetailsDialog
        debate={selectedDebate}
        isOpen={showDetailsDialog}
        onClose={() => setShowDetailsDialog(false)}
        userRole={userRole}
        token={token}
      />
    </div>
  );
}