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
  Loader2,
  Flag,
  CheckSquare,
  Search,
  Plus,
  Minus,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";
import { useGemini } from "@/hooks/useGemini";

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

const getPositionsForFormat = (format: string, teamSize: number) => {
  switch (format) {
    case "WorldSchools":
      return Array.from({ length: teamSize }, (_, i) => ({
        id: `speaker_${i + 1}`,
        label: `Speaker ${i + 1}`,
        team: i < teamSize / 2 ? "prop" : "opp"
      }));
    case "BritishParliamentary":
      return [
        { id: "PM", label: "Prime Minister", team: "prop" },
        { id: "DPM", label: "Deputy Prime Minister", team: "prop" },
        { id: "MG", label: "Member of Government", team: "prop" },
        { id: "LO", label: "Leader of Opposition", team: "opp" },
        { id: "DLO", label: "Deputy Leader of Opposition", team: "opp" },
        { id: "MO", label: "Member of Opposition", team: "opp" },
      ];
    case "PublicForum":
      return [
        { id: "speaker_1", label: "Speaker 1", team: "prop" },
        { id: "speaker_2", label: "Speaker 2", team: "opp" },
      ];
    case "LincolnDouglas":
      return [
        { id: "affirmative", label: "Affirmative", team: "prop" },
        { id: "negative", label: "Negative", team: "opp" },
      ];
    default:
      return Array.from({ length: teamSize }, (_, i) => ({
        id: `speaker_${i + 1}`,
        label: `Speaker ${i + 1}`,
        team: i < teamSize / 2 ? "prop" : "opp"
      }));
  }
};

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

function DebateTimer({ debate, onUpdateDebate }: any) {
  const [currentTime, setCurrentTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [speakingTime, setSpeakingTime] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const getFileUrl = useMutation(api.files.getUrl);
  const updateDebateRecording = useMutation(api.functions.ballots.updateRecording);

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

  useEffect(() => {
    let recordingInterval: NodeJS.Timeout;
    if (isRecording) {
      recordingInterval = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(recordingInterval);
  }, [isRecording]);

  useEffect(() => {
    const loadRecordingUrl = async () => {
      if (debate.recording && !audioUrl) {
        try {
          const url = await getFileUrl({ storageId: debate.recording });
          setAudioUrl(url);
        } catch (error) {
          console.error('Error loading recording:', error);
        }
      }
    };

    loadRecordingUrl();
  }, [debate.recording, audioUrl, getFileUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });

      setAudioChunks([]);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setAudioChunks(prev => [...prev, event.data]);
        }
      };

      recorder.onstop = async () => {

        const audioBlob = new Blob(audioChunks, { type: recorder.mimeType });
        await uploadRecording(audioBlob);

        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start(1000);
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingDuration(0);

      toast.success("Recording started");
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error("Failed to start recording. Please check microphone permissions.");
    }
  };
  
  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      setIsRecording(false);
      toast.success("Recording stopped. Uploading...");
    }
  };

  const uploadRecording = async (audioBlob: Blob) => {
    setIsUploading(true);
    try {

      const uploadUrl = await generateUploadUrl();

      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": audioBlob.type },
        body: audioBlob,
      });

      if (!result.ok) {
        throw new Error("Upload failed");
      }

      const { storageId } = await result.json();

      await updateDebateRecording({
        debate_id: debate._id,
        recording_id: storageId,
        duration: recordingDuration,
      });

      const url = await getFileUrl({ storageId });
      setAudioUrl(url);

      toast.success("Recording uploaded successfully!");

      if (onUpdateDebate) {
        onUpdateDebate({
          ...debate,
          recording: storageId,
          recording_duration: recordingDuration
        });
      }
    } catch (error) {
      console.error('Error uploading recording:', error);
      toast.error("Failed to upload recording");
    } finally {
      setIsUploading(false);
    }
  };

  const playRecording = () => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play();
      setIsPlaying(true);

      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => {
        setIsPlaying(false);
        toast.error("Failed to play recording");
      };
    }
  };

  const downloadRecording = () => {
    if (audioUrl) {
      const link = document.createElement('a');
      link.href = audioUrl;
      link.download = `debate-${debate.room_name}-recording.webm`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const estimatedSize = recordingDuration * 8 * 1024;

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
            size="sm"
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
            size="sm"
          >
            <Square className="h-4 w-4" />
          </Button>

          <Button
            onClick={isRecording ? stopRecording : startRecording}
            variant={isRecording ? "destructive" : "outline"}
            disabled={isUploading}
            size="sm"
          >
            {isUploading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : isRecording ? (
              <MicOff className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>
        </div>

        <div className="text-sm text-muted-foreground space-y-1">
          <div>Speaking Time: {formatTime(speakingTime)}</div>
          <div>Current Speaker: {debate.current_speaker || "None"}</div>
          <div>POIs: {debate.poi_count || 0}</div>

          {isRecording && (
            <div className="text-red-600 font-medium flex items-center justify-center gap-1">
              <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
              Recording: {formatTime(recordingDuration)}
              <span className="text-xs">({formatFileSize(estimatedSize)})</span>
            </div>
          )}

          {debate.recording && (
            <div className="text-green-600 text-xs space-y-2">
              <div className="flex items-center justify-center gap-1">
                <CheckCircle className="h-3 w-3" />
                Recorded ({formatTime(debate.recording_duration || 0)})
              </div>

              <div className="flex justify-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={playRecording}
                  disabled={isPlaying || !audioUrl}
                  className="h-6 px-2"
                >
                  {isPlaying ? (
                    <Pause className="h-3 w-3" />
                  ) : (
                    <Play className="h-3 w-3" />
                  )}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={downloadRecording}
                  disabled={!audioUrl}
                  className="h-6 px-2"
                >
                  <Download className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
function ArgumentFlow({ debate, onAddArgument, onUpdateArgumentFlow }: any) {
  const [newArgument, setNewArgument] = useState("");
  const [argumentType, setArgumentType] = useState<"main" | "rebuttal" | "poi">("main");
  const [selectedArgument, setSelectedArgument] = useState<string | null>(null);
  const [argumentStrength, setArgumentStrength] = useState(5);

  const argumentFlow = debate.argument_flow || [];

  const handleAddArgument = () => {
    if (!newArgument.trim()) return;

    const newArg = {
      type: argumentType,
      content: newArgument,
      speaker: debate.current_speaker,
      team: argumentType === "poi" ? debate.opposition_team_id : debate.proposition_team_id,
      timestamp: Date.now(),
      strength: argumentStrength,
      rebutted_by: [],
    };

    onAddArgument(newArg);
    setNewArgument("");
    setArgumentStrength(5);
  };

  const handleArgumentConnection = (parentId: string, childId: string) => {
    const updatedFlow = argumentFlow.map((arg: any, index: number) => {
      if (index === parseInt(parentId)) {
        return {
          ...arg,
          rebutted_by: [...(arg.rebutted_by || []), childId]
        };
      }
      return arg;
    });
    onUpdateArgumentFlow(updatedFlow);
  };

  const getArgumentColor = (type: string) => {
    switch (type) {
      case "main": return "border-blue-500 bg-blue-50";
      case "rebuttal": return "border-red-500 bg-red-50";
      case "poi": return "border-yellow-500 bg-yellow-50";
      default: return "border-gray-500 bg-gray-50";
    }
  };

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <h4 className="font-medium flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Argument Flow
        </h4>

        <ScrollArea className="h-64">
          <div className="space-y-3">
            {argumentFlow.map((arg: any, index: number) => (
              <div key={index} className={`p-3 border rounded-lg ${getArgumentColor(arg.type)}`}>
                <div className="flex justify-between items-start mb-2">
                  <Badge variant="outline" className="mb-1">
                    {arg.type}
                  </Badge>
                  <div className="flex items-center gap-1">
                    <span className="text-xs">Strength:</span>
                    <div className="flex">
                      {Array.from({ length: 5 }, (_, i) => (
                        <div
                          key={i}
                          className={`w-2 h-2 rounded-full mx-px ${
                            i < (arg.strength || 3) ? 'bg-blue-500' : 'bg-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <p className="text-sm mb-2">{arg.content}</p>

                <div className="flex justify-between items-center text-xs text-muted-foreground">
                  <span>Speaker {arg.speaker}</span>
                  <span>{new Date(arg.timestamp).toLocaleTimeString()}</span>
                </div>

                {arg.rebutted_by && arg.rebutted_by.length > 0 && (
                  <div className="mt-2 pt-2 border-t">
                    <span className="text-xs text-muted-foreground">Rebutted by:</span>
                    <div className="flex gap-1 mt-1">
                      {arg.rebutted_by.map((rebuttal: string, idx: number) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          Arg {rebuttal}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-1 mt-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (selectedArgument && selectedArgument !== index.toString()) {
                        handleArgumentConnection(selectedArgument, index.toString());
                        setSelectedArgument(null);
                      } else {
                        setSelectedArgument(index.toString());
                      }
                    }}
                    className={`h-6 text-xs ${selectedArgument === index.toString() ? 'bg-blue-100' : ''}`}
                  >
                    <ArrowRight className="h-3 w-3 mr-1" />
                    {selectedArgument === index.toString() ? 'Selected' : 'Link'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="space-y-3 pt-3 border-t">
          <div className="flex gap-2">
            <Select value={argumentType} onValueChange={(value: any) => setArgumentType(value)}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="main">Main</SelectItem>
                <SelectItem value="rebuttal">Rebuttal</SelectItem>
                <SelectItem value="poi">POI</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex-1">
              <Input
                placeholder="Add argument..."
                value={newArgument}
                onChange={(e) => setNewArgument(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddArgument()}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-xs">Strength:</Label>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setArgumentStrength(Math.max(1, argumentStrength - 1))}
                className="h-6 w-6 p-0"
              >
                <Minus className="h-3 w-3" />
              </Button>

              <div className="flex mx-2">
                {Array.from({ length: 5 }, (_, i) => (
                  <div
                    key={i}
                    className={`w-3 h-3 rounded-full mx-px cursor-pointer ${
                      i < argumentStrength ? 'bg-blue-500' : 'bg-gray-300'
                    }`}
                    onClick={() => setArgumentStrength(i + 1)}
                  />
                ))}
              </div>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => setArgumentStrength(Math.min(5, argumentStrength + 1))}
                className="h-6 w-6 p-0"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <Button onClick={handleAddArgument} size="sm" className="w-full">
            Add Argument
          </Button>
        </div>
      </div>
    </Card>
  );
}

function FactCheckingInterface({ debate, onAddFactCheck, userId }: any) {
  const { factCheckClaim, isFactChecking } = useGemini();
  const [selectedText, setSelectedText] = useState("");
  const [factCheckResult, setFactCheckResult] = useState<any>(null);
  const [manualResult, setManualResult] = useState<"true" | "false" | "partially_true" | "inconclusive">("inconclusive");
  const [manualExplanation, setManualExplanation] = useState("");

  const existingFactChecks = debate.fact_checks || [];

  const handleAIFactCheck = async () => {
    if (!selectedText.trim()) return;

    const result = await factCheckClaim(selectedText);
    setFactCheckResult(result);
  };

  const handleManualFactCheck = () => {
    if (!selectedText.trim() || !manualExplanation.trim()) return;

    const factCheck = {
      claim: selectedText,
      result: manualResult,
      explanation: manualExplanation,
      sources: [],
      checked_by: userId,
      timestamp: Date.now(),
    };

    onAddFactCheck(factCheck);
    setSelectedText("");
    setManualExplanation("");
    setFactCheckResult(null);
  };

  const handleAcceptAIResult = () => {
    if (!factCheckResult) return;

    const factCheck = {
      claim: selectedText,
      result: factCheckResult.result,
      explanation: factCheckResult.explanation,
      sources: factCheckResult.sources || [],
      checked_by: userId,
      timestamp: Date.now(),
    };

    onAddFactCheck(factCheck);
    setSelectedText("");
    setFactCheckResult(null);
  };

  const getResultColor = (result: string) => {
    switch (result) {
      case "true": return "text-green-600 bg-green-50 border-green-200";
      case "false": return "text-red-600 bg-red-50 border-red-200";
      case "partially_true": return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "inconclusive": return "text-gray-600 bg-gray-50 border-gray-200";
      default: return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <h4 className="font-medium flex items-center gap-2">
          <Search className="h-4 w-4" />
          Fact Checking
        </h4>

        <div className="space-y-3">
          <div>
            <Label className="text-sm">Claim to check:</Label>
            <Textarea
              placeholder="Enter or paste claim to fact-check..."
              value={selectedText}
              onChange={(e) => setSelectedText(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleAIFactCheck}
              disabled={!selectedText.trim() || isFactChecking}
              size="sm"
              variant="outline"
            >
              {isFactChecking ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  Checking...
                </>
              ) : (
                <>
                  <Brain className="h-3 w-3 mr-1" />
                  AI Check
                </>
              )}
            </Button>

            <Button
              onClick={() => setFactCheckResult({ isManual: true })}
              disabled={!selectedText.trim()}
              size="sm"
              variant="outline"
            >
              <CheckSquare className="h-3 w-3 mr-1" />
              Manual Check
            </Button>
          </div>

          {factCheckResult && (
            <div className="space-y-3 p-3 border rounded-lg">
              {factCheckResult.isManual ? (
                <div className="space-y-3">
                  <h5 className="font-medium">Manual Fact Check</h5>

                  <div>
                    <Label className="text-sm">Result:</Label>
                    <Select value={manualResult} onValueChange={(value: any) => setManualResult(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">True</SelectItem>
                        <SelectItem value="false">False</SelectItem>
                        <SelectItem value="partially_true">Partially True</SelectItem>
                        <SelectItem value="inconclusive">Inconclusive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-sm">Explanation:</Label>
                    <Textarea
                      placeholder="Explain your fact check..."
                      value={manualExplanation}
                      onChange={(e) => setManualExplanation(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={handleManualFactCheck} size="sm">
                      Save Fact Check
                    </Button>
                    <Button
                      onClick={() => setFactCheckResult(null)}
                      size="sm"
                      variant="ghost"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <h5 className="font-medium">AI Fact Check Result</h5>

                  <div className={`p-2 rounded border ${getResultColor(factCheckResult.result)}`}>
                    <div className="font-medium capitalize">{factCheckResult.result.replace('_', ' ')}</div>
                    <div className="text-sm mt-1">
                      Confidence: {(factCheckResult.confidence * 100).toFixed(0)}%
                    </div>
                  </div>

                  {factCheckResult.explanation && (
                    <div>
                      <Label className="text-sm">Explanation:</Label>
                      <p className="text-sm p-2 bg-muted rounded">{factCheckResult.explanation}</p>
                    </div>
                  )}

                  {factCheckResult.sources && factCheckResult.sources.length > 0 && (
                    <div>
                      <Label className="text-sm">Sources:</Label>
                      <ul className="text-sm list-disc list-inside p-2 bg-muted rounded">
                        {factCheckResult.sources.map((source: string, idx: number) => (
                          <li key={idx}>{source}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button onClick={handleAcceptAIResult} size="sm">
                      Accept & Save
                    </Button>
                    <Button
                      onClick={() => setFactCheckResult({ isManual: true })}
                      size="sm"
                      variant="outline"
                    >
                      Edit Manually
                    </Button>
                    <Button
                      onClick={() => setFactCheckResult(null)}
                      size="sm"
                      variant="ghost"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {existingFactChecks.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Previous Fact Checks:</Label>
            <ScrollArea className="h-32">
              {existingFactChecks.map((check: any, idx: number) => (
                <div key={idx} className={`p-2 mb-2 rounded border text-sm ${getResultColor(check.result)}`}>
                  <div className="font-medium">&#34;{check.claim}&#34;</div>
                  <div className="capitalize">{check.result.replace('_', ' ')}</div>
                  {check.explanation && <div className="text-xs mt-1">{check.explanation}</div>}
                </div>
              ))}
            </ScrollArea>
          </div>
        )}
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

function SpeakerPositionManager({ speakers, positions, onUpdatePositions, tournament }: any) {
  const [speakerPositions, setSpeakerPositions] = useState<Record<string, string>>(positions || {});

  const availablePositions = useMemo(() => {
    return getPositionsForFormat(tournament.format || "WorldSchools", tournament.team_size || 6);
  }, [tournament.format, tournament.team_size]);

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
    const currentIndex = availablePositions.findIndex(p => p.id === currentPosition);

    if (currentIndex === -1) return;

    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= availablePositions.length) return;

    const newPosition = availablePositions[newIndex];
    handlePositionChange(speakerId, newPosition.id);
  };

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <h4 className="font-medium">Speaker Positions</h4>
        <div className="text-xs text-muted-foreground">
          Format: {tournament.format || "WorldSchools"} • Team Size: {tournament.team_size || 6}
        </div>

        <div className="space-y-2">
          {speakers.map((speaker: any) => (
            <div key={speaker.id} className="flex items-center gap-2 p-2 border rounded">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{speaker.name}</p>
                <p className="text-sm text-muted-foreground">
                  {availablePositions.find(p => p.id === speakerPositions[speaker.id])?.label || "Unassigned"}
                </p>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => movePosition(speaker.id, "up")}
                  disabled={speakerPositions[speaker.id] === availablePositions[0]?.id}
                >
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => movePosition(speaker.id, "down")}
                  disabled={speakerPositions[speaker.id] === availablePositions[availablePositions.length - 1]?.id}
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
                  {availablePositions.map((position) => (
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

function JudgingInterface({ debate, ballot, userId, onSubmitBallot, tournament }: any) {
  const { validateFeedback, checkBias, isValidating, isBiasChecking } = useGemini();
  const [scores, setScores] = useState<Record<string, Record<string, number>>>({});
  const [teamWinner, setTeamWinner] = useState<string>("");
  const [winningPosition, setWinningPosition] = useState<"proposition" | "opposition" | "">("");
  const [notes, setNotes] = useState("");
  const [speakerComments, setSpeakerComments] = useState<Record<string, string>>({});
  const [speakerPositions, setSpeakerPositions] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [biasCheckResults, setBiasCheckResults] = useState<Record<string, any>>({});
  const [isMobile, setIsMobile] = useState(false);
  const [argumentFlow, setArgumentFlow] = useState<any[]>(debate.argument_flow || []);
  const [factChecks, setFactChecks] = useState<any[]>(debate.fact_checks || []);

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

  const handleBiasCheck = async (speakerId: string) => {
    const comment = speakerComments[speakerId];
    if (!comment?.trim()) return;

    const result = await checkBias(comment, 'comment');
    setBiasCheckResults(prev => ({
      ...prev,
      [speakerId]: result
    }));
  };

  const handleValidation = async () => {
    const allComments = Object.values(speakerComments).join(" ");
    const result = await validateFeedback(allComments, speakerComments, notes);
    setValidationResult(result);
    return result;
  };

  const handleAddArgument = (argument: any) => {
    setArgumentFlow(prev => [...prev, argument]);
  };

  const handleUpdateArgumentFlow = (newFlow: any[]) => {
    setArgumentFlow(newFlow);
  };

  const handleAddFactCheck = (factCheck: any) => {
    setFactChecks(prev => [...prev, factCheck]);
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
        const biasResult = biasCheckResults[speakerId];

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
          bias_detected: biasResult?.hasBias || false,
          bias_explanation: biasResult?.suggestions?.join("; ") || "",
        };
      });

      await onSubmitBallot({
        debate_id: debate._id,
        winning_team_id: teamWinner as Id<"teams">,
        winning_position: winningPosition as "proposition" | "opposition",
        speaker_scores: speakerScores,
        notes,
        is_final_submission: isFinal,

        fact_checks: factChecks.length > 0 ? factChecks : undefined,
        argument_flow: argumentFlow.length > 0 ? argumentFlow : undefined,
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
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="scoring">Scoring</TabsTrigger>
                  <TabsTrigger value="winner">Winner</TabsTrigger>
                  <TabsTrigger value="tools">Tools</TabsTrigger>
                  <TabsTrigger value="arguments">Arguments</TabsTrigger>
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
                    const biasResult = biasCheckResults[speakerId];

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
                            <div className="flex items-center justify-between">
                              <Label className="text-xs">Feedback</Label>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleBiasCheck(speakerId)}
                                  disabled={!speakerComments[speakerId]?.trim() || isBiasChecking}
                                  className="h-6 px-2"
                                >
                                  {isBiasChecking ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Shield className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>
                            </div>
                            <Textarea
                              placeholder="Quick feedback..."
                              value={speakerComments[speakerId] || ""}
                              onChange={(e) => updateSpeakerComment(speakerId, e.target.value)}
                              disabled={!canEdit}
                              rows={2}
                              className="text-sm"
                            />
                            {biasResult && biasResult.hasBias && (
                              <Alert variant="destructive" className="p-2">
                                <AlertCircle className="h-3 w-3" />
                                <AlertDescription className="text-xs">
                                  Potential bias detected. {biasResult.suggestions?.[0]}
                                </AlertDescription>
                              </Alert>
                            )}
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
                      tournament={tournament}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="arguments" className="space-y-4 mt-4">
                  <div className="grid gap-4">
                    <ArgumentFlow
                      debate={{ ...debate, argument_flow: argumentFlow }}
                      onAddArgument={handleAddArgument}
                      onUpdateArgumentFlow={handleUpdateArgumentFlow}
                    />
                    <FactCheckingInterface
                      debate={{ ...debate, fact_checks: factChecks }}
                      onAddFactCheck={handleAddFactCheck}
                      userId={userId}
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
                  const biasResult = biasCheckResults[speakerId];

                  return (
                    <Card key={speakerId} className="p-6">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="font-medium">Speaker {speakerId}</h4>
                            <p className="text-sm text-muted-foreground">{team?.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Position: {speakerPositions[speakerId] || "Unassigned"}
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
                          <div className="flex items-center justify-between">
                            <Label className="text-sm">Comments & Feedback</Label>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleBiasCheck(speakerId)}
                                disabled={!speakerComments[speakerId]?.trim() || isBiasChecking}
                                title="Check for bias"
                              >
                                {isBiasChecking ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Shield className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          </div>
                          <Textarea
                            placeholder="Provide constructive feedback..."
                            value={speakerComments[speakerId] || ""}
                            onChange={(e) => updateSpeakerComment(speakerId, e.target.value)}
                            disabled={!canEdit}
                            rows={3}
                          />
                          {biasResult && biasResult.hasBias && (
                            <Alert variant="destructive">
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription>
                                <div className="space-y-1">
                                  <p>Potential bias detected</p>
                                  {biasResult.suggestions && (
                                    <ul className="text-sm list-disc list-inside">
                                      {biasResult.suggestions.map((suggestion: string, idx: number) => (
                                        <li key={idx}>{suggestion}</li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              </AlertDescription>
                            </Alert>
                          )}
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

              <ArgumentFlow
                debate={{ ...debate, argument_flow: argumentFlow }}
                onAddArgument={handleAddArgument}
                onUpdateArgumentFlow={handleUpdateArgumentFlow}
              />

              <FactCheckingInterface
                debate={{ ...debate, fact_checks: factChecks }}
                onAddFactCheck={handleAddFactCheck}
                userId={userId}
              />

              <CollaborativeNotes
                debate={debate}
                userId={userId}
                onUpdateNotes={() => {}}
              />

              <SpeakerPositionManager
                speakers={allSpeakers.map(id => ({ id, name: `Speaker ${id}` }))}
                positions={speakerPositions}
                onUpdatePositions={setSpeakerPositions}
                tournament={tournament}
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

function BallotCard({ debate, userRole, userId, onViewDetails, onEditBallot, onFlagBallot, onUnflagBallot }: any) {
  const StatusIcon = getDebateStatusIcon(debate.status);

  const canEdit = userRole === "admin" ||
    (userRole === "volunteer" && debate.judges?.some((j: any) => j._id === userId));

  const canSeeDetails = debate.can_see_full_details || userRole === "admin" || userRole === "volunteer";

  const canFlag = userRole === "admin" ||
    (userRole === "volunteer" && debate.judges?.some((j: any) => j._id === userId));

  const submissionProgress = debate.judges?.length > 0
    ? (debate.final_submissions_count || 0) / debate.judges.length * 100
    : 0;

  const hasFlaggedBallots = debate.has_flagged_ballots ||
    debate.judges?.some((j: any) => j.is_flagged);


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
            {hasFlaggedBallots && (
              <Badge variant="destructive" className="gap-1">
                <Flag className="h-3 w-3" />
                Flagged
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {debate.recording && (
              <Button variant="ghost" size="sm" title="Download Recording">
                <Download className="h-4 w-4" />
              </Button>
            )}
            {canFlag && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onFlagBallot(debate)}
                  title="Flag Ballot"
                  className={hasFlaggedBallots ? "text-red-600" : ""}
                >
                  <Flag className="h-4 w-4" />
                </Button>
                {userRole === "admin" && hasFlaggedBallots && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onUnflagBallot(debate)}
                    title="Unflag Ballot"
                    className="text-green-600"
                  >
                    <CheckCircle className="h-4 w-4" />
                  </Button>
                )}
              </>
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
                className={`gap-1 ${judge.is_flagged ? 'border-red-500 text-red-600' : ''}`}
              >
                {judge.name || `Judge ${judge._id}`}
                {judge.is_head_judge && <Crown className="h-3 w-3" />}
                {judge.is_flagged && <Flag className="h-3 w-3" />}
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


        {(debate.fact_checks?.length > 0 || debate.argument_flow?.length > 0) && canSeeDetails && (
          <div className="pt-2 border-t">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {debate.fact_checks?.length > 0 && (
                <span className="flex items-center gap-1">
                  <Search className="h-3 w-3" />
                  {debate.fact_checks.length} fact checks
                </span>
              )}
              {debate.argument_flow?.length > 0 && (
                <span className="flex items-center gap-1">
                  <BarChart3 className="h-3 w-3" />
                  {debate.argument_flow.length} arguments
                </span>
              )}
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


          {debate?.fact_checks?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Fact Checks ({debate.fact_checks.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {debate.fact_checks.map((check: any, idx: number) => (
                    <div key={idx} className={`p-3 rounded border ${
                      check.result === 'true' ? 'bg-green-50 border-green-200' :
                        check.result === 'false' ? 'bg-red-50 border-red-200' :
                          check.result === 'partially_true' ? 'bg-yellow-50 border-yellow-200' :
                            'bg-gray-50 border-gray-200'
                    }`}>
                      <div className="flex justify-between items-start mb-2">
                        <Badge variant="outline" className="capitalize">
                          {check.result.replace('_', ' ')}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(check.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm font-medium mb-1">&#34;{check.claim}&#34;</p>
                      {check.explanation && (
                        <p className="text-sm text-muted-foreground">{check.explanation}</p>
                      )}
                      {check.sources?.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium">Sources:</p>
                          <ul className="text-xs list-disc list-inside">
                            {check.sources.map((source: string, i: number) => (
                              <li key={i}>{source}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}


          {debate?.argument_flow?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Argument Flow ({debate.argument_flow.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {debate.argument_flow.map((arg: any, idx: number) => (
                    <div key={idx} className={`p-3 rounded border ${
                      arg.type === 'main' ? 'bg-blue-50 border-blue-200' :
                        arg.type === 'rebuttal' ? 'bg-red-50 border-red-200' :
                          'bg-yellow-50 border-yellow-200'
                    }`}>
                      <div className="flex justify-between items-start mb-2">
                        <Badge variant="outline" className="capitalize">
                          {arg.type}
                        </Badge>
                        <div className="flex items-center gap-2">
                          {arg.strength && (
                            <div className="flex">
                              {Array.from({ length: 5 }, (_, i) => (
                                <div
                                  key={i}
                                  className={`w-2 h-2 rounded-full mx-px ${
                                    i < arg.strength ? 'bg-blue-500' : 'bg-gray-300'
                                  }`}
                                />
                              ))}
                            </div>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {new Date(arg.timestamp).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm">{arg.content}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Speaker {arg.speaker}
                      </p>
                      {arg.rebutted_by?.length > 0 && (
                        <div className="mt-2 pt-2 border-t">
                          <span className="text-xs text-muted-foreground">Rebutted by:</span>
                          <div className="flex gap-1 mt-1">
                            {arg.rebutted_by.map((rebuttal: string, i: number) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                Arg {rebuttal}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}


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
                  {ballot.notes?.includes("[FLAG:") && (
                    <Badge variant="destructive">
                      <Flag className="h-3 w-3 mr-1" />
                      Flagged
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


                        {score.bias_detected && (
                          <div className="pt-3 border-t">
                            <Alert variant="destructive">
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription>
                                <p className="font-medium">Bias Detected</p>
                                {score.bias_explanation && (
                                  <p className="text-sm mt-1">{score.bias_explanation}</p>
                                )}
                              </AlertDescription>
                            </Alert>
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

function FlagBallotDialog({ debate, isOpen, onClose, onFlag }: any) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFlag = async () => {
    if (!reason.trim()) return;

    setIsSubmitting(true);
    try {
      await onFlag(debate, reason);
      setReason("");
      onClose();
    } catch (error) {
      console.error("Failed to flag ballot:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5" />
            Flag Ballot - {debate?.room_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Reason for flagging:</Label>
            <Textarea
              placeholder="Describe the issue with this ballot..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleFlag}
              disabled={!reason.trim() || isSubmitting}
              variant="destructive"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Flagging...
                </>
              ) : (
                <>
                  <Flag className="h-4 w-4 mr-2" />
                  Flag Ballot
                </>
              )}
            </Button>
            <Button onClick={onClose} variant="outline">
              Cancel
            </Button>
          </div>
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
  const [showFlagDialog, setShowFlagDialog] = useState(false);
  const [flaggingDebate, setFlaggingDebate] = useState<any>(null);

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
  const flagBallotAdmin = useMutation(api.functions.admin.ballots.flagBallotForReview);
  const flagBallotVolunteer = useMutation(api.functions.volunteers.ballots.flagBallot);
  const unflagBallot = useMutation(api.functions.admin.ballots.unflagBallot);

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
    setJudgingDebate(debate);
    setShowJudgingInterface(true);
  };

  const handleFlagBallot = (debate: any) => {
    setFlaggingDebate(debate);
    setShowFlagDialog(true);
  };

  const handleSubmitFlag = async (debate: any, reason: string) => {
    try {
      if (userRole === "admin") {


        const submissions = debate.judges?.filter((j: any) => j.has_submitted);
        if (!submissions || submissions.length === 0) {
          toast.error("No submitted ballots found to flag");
          return;
        }

        await flagBallotAdmin({
          token,
          ballot_id: submissions[0].ballot_id || debate._id,
          reason,
        });
      } else if (userRole === "volunteer") {

        const mySubmission = debate.my_submission;
        if (!mySubmission) {
          toast.error("No ballot found to flag");
          return;
        }

        await flagBallotVolunteer({
          token,
          ballot_id: mySubmission._id,
          reason,
        });
      }
      toast.success("Ballot flagged successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to flag ballot");
    }
  };

  const handleUnflagBallot = async (debate: any) => {
    try {
      if (userRole !== "admin") {
        toast.error("Only admins can unflag ballots");
        return;
      }

      const flaggedJudges = debate.judges?.filter((j: any) => j.is_flagged);
      if (!flaggedJudges || flaggedJudges.length === 0) {
        toast.error("No flagged ballots found");
        return;
      }

      await unflagBallot({
        token,
        ballot_id: flaggedJudges[0].ballot_id || debate._id,
      });

      toast.success("Ballot unflagged successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to unflag ballot");
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

  const getStats = () => {
    const total = filteredBallots.length;
    const completed = filteredBallots.filter((b: any) => b.status === "completed").length;
    const inProgress = filteredBallots.filter((b: any) => b.status === "inProgress").length;
    const pending = filteredBallots.filter((b: any) => b.status === "pending").length;
    const flagged = filteredBallots.filter((b: any) => b.has_flagged_ballots).length;

    return { total, completed, inProgress, pending, flagged };
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
                <>
                  <span>
                    {stats.completed} completed • {stats.inProgress} in progress • {stats.pending} pending
                  </span>
                  {stats.flagged > 0 && (
                    <span className="text-red-300 flex items-center gap-1">
                      <Flag className="h-3 w-3" />
                      {stats.flagged} flagged
                    </span>
                  )}
                </>
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
                  onFlagBallot={handleFlagBallot}
                  onUnflagBallot={handleUnflagBallot}
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
              <DialogTitle className="flex items-center gap-2">
                <Edit3 className="h-5 w-5" />
                Judging Interface
                <Badge variant="outline" className="ml-2">
                  {tournament.format || "WorldSchools"} Format
                </Badge>
              </DialogTitle>
            </DialogHeader>
            <div className="overflow-y-auto max-h-[85vh]">
              <JudgingInterface
                debate={judgingDebate}
                ballot={judgingDebate.my_submission}
                userRole={userRole}
                token={token}
                onSubmitBallot={handleSubmitBallot}
                userId={userId}
                tournament={tournament}
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

      <FlagBallotDialog
        debate={flaggingDebate}
        isOpen={showFlagDialog}
        onClose={() => setShowFlagDialog(false)}
        onFlag={handleSubmitFlag}
        userRole={userRole}
      />
    </div>
  );
}