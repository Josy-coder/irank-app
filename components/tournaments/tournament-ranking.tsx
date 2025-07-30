"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Users,
  Star,
  Medal,
  Award,
  Download,
  Crown,
  Building,
  Loader2,
  Settings,
  ChevronUp,
  ChevronDown,
  Search,
  AlertTriangle,
  UsersRound, School, GraduationCap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";
import { Skeleton } from '../ui/skeleton';

interface RankingResponse<T> {
  success: boolean;
  error: string | null;
  data: T;
  type: 'success' | 'permission_error' | 'validation_error' | 'data_insufficient' | 'not_released';
}

interface TeamRanking {
  rank: number;
  team_id: Id<"teams">;
  team_name: string;
  school_id?: Id<"schools">;
  school_name?: string;
  school_type?: string;
  total_wins: number;
  total_losses: number;
  total_points: number;
  opponents_total_wins: number;
  opponents_total_points: number;
  head_to_head_wins: number;
  eliminated_in_round?: number;
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
  highest_individual_score: number;
  points_deviation: number;
  cross_tournament_performance: {
    tournaments_participated: number;
    avg_points_per_tournament: number;
    best_tournament_rank?: number;
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
  attendance_score: number;
  avg_feedback_score: number;
  total_feedback_count: number;
  consistency_score: number;
  cross_tournament_stats: {
    tournaments_judged: number;
    total_debates_across_tournaments: number;
    avg_feedback_across_tournaments: number;
  };
}

interface TournamentRankingsProps {
  tournament: any;
  userRole: string;
  token: string;
  userId?: string;
  schoolId?: string;
}

function RankingSkeleton() {
  return (
    <div className="space-y-4">
      
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

      
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <Skeleton className="h-8 w-full" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-40" />
            </div>
          </div>
        </CardContent>
      </Card>

      
      <div className="grid w-full grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>

      
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="hover:shadow-md transition-all duration-200">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <div>
                    <Skeleton className="h-5 w-32 mb-1" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
                <div className="text-right">
                  <Skeleton className="h-8 w-12 mb-1" />
                  <Skeleton className="h-3 w-8" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-4">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="text-center">
                    <Skeleton className="h-6 w-8 mx-auto mb-1" />
                    <Skeleton className="h-3 w-16 mx-auto" />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4 text-center text-sm">
                {Array.from({ length: 2 }).map((_, j) => (
                  <div key={j}>
                    <Skeleton className="h-4 w-8 mx-auto mb-1" />
                    <Skeleton className="h-3 w-12 mx-auto" />
                  </div>
                ))}
              </div>

              
              <div className="mt-4 pt-3 border-t">
                <Skeleton className="h-3 w-20 mx-auto mb-2" />
                <div className="grid grid-cols-3 gap-2 text-center">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <div key={j}>
                      <Skeleton className="h-4 w-6 mx-auto mb-1" />
                      <Skeleton className="h-3 w-8 mx-auto" />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function TournamentRankings({
                                             tournament,
                                             userRole,
                                             token,
                                           }: TournamentRankingsProps) {


  const [activeTab, setActiveTab] = useState<'teams' | 'schools' | 'students' | 'volunteers'>('teams');
  const [includeElimination, setIncludeElimination] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'rank' | 'name' | 'performance'>('rank');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filterSchool, setFilterSchool] = useState<string>('all');
  const [showDetails, setShowDetails] = useState<Record<string, boolean>>({});
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf'>('csv');

  const isAdmin = userRole === 'admin';
  const hasToken = Boolean(token);

  const canViewRankings = hasToken;
  const canRecalculateRankings = isAdmin;
  const canManageReleaseSettings = isAdmin;
  const canToggleElimination = isAdmin;
  const canExportRankings = isAdmin;

  const scope = includeElimination ? "full_tournament" : "prelims";

  console.log('Debug Info:', {
    userRole,
    hasToken: Boolean(token),
    tournamentRankingReleased: tournament.ranking_released,
    includeElimination,
    scope: includeElimination ? "full_tournament" : "prelims"
  });

  const teamRankingsResponse = useQuery(
    api.functions.rankings.getTeamRankings,
    canViewRankings ? {
      token,
      tournament_id: tournament._id,
      scope: scope,
    } : "skip"
  );

  const schoolRankingsResponse = useQuery(
    api.functions.rankings.getSchoolRankings,
    canViewRankings ? {
      token,
      tournament_id: tournament._id,
      scope: scope,
    } : "skip"
  );

  const studentRankingsResponse = useQuery(
    api.functions.rankings.getStudentRankings,
    canViewRankings ? {
      token,
      tournament_id: tournament._id,
      scope: scope,
    } : "skip"
  );

  const volunteerRankingsResponse = useQuery(
    api.functions.rankings.getVolunteerRankings,
    canViewRankings ? {
      token,
      tournament_id: tournament._id,
    } : "skip"
  );

  const updateRankingReleaseMutation = useMutation(api.functions.rankings.updateRankingRelease);

  const teamRankings = useMemo(() =>
      teamRankingsResponse?.success ? teamRankingsResponse.data : [],
    [teamRankingsResponse]
  );
  const teamError = teamRankingsResponse?.success === false ? teamRankingsResponse.error : null;

  const schoolRankings = useMemo(() =>
      schoolRankingsResponse?.success ? schoolRankingsResponse.data : [],
    [schoolRankingsResponse]
  );
  const schoolError = schoolRankingsResponse?.success === false ? schoolRankingsResponse.error : null;

  const studentRankings = useMemo(() =>
      studentRankingsResponse?.success ? studentRankingsResponse.data : [],
    [studentRankingsResponse]
  );
  const studentError = studentRankingsResponse?.success === false ? studentRankingsResponse.error : null;

  const volunteerRankings = useMemo(() =>
      volunteerRankingsResponse?.success ? volunteerRankingsResponse.data : [],
    [volunteerRankingsResponse]
  );
  const volunteerError = volunteerRankingsResponse?.success === false ? volunteerRankingsResponse.error : null;

  console.log('Query Results:', {
    teamRankingsResponse,
    schoolRankingsResponse,
    studentRankingsResponse,
    volunteerRankingsResponse
  });

  console.log('Computed Values:', {
    teamRankings,
    teamError,
    schoolRankings,
    schoolError,
    studentRankings,
    studentError,
    volunteerRankings,
    volunteerError
  });

  const [releaseSettings, setReleaseSettings] = useState({
    prelims: {
      teams: false,
      schools: false,
      students: false,
      volunteers: false,
    },
    full_tournament: {
      teams: false,
      schools: false,
      students: false,
      volunteers: false,
    },
    visible_to_roles: ['school_admin', 'student', 'volunteer']
  });

  useEffect(() => {
    if (tournament.ranking_released && canManageReleaseSettings) {
      setReleaseSettings(tournament.ranking_released);
    }
  }, [tournament, canManageReleaseSettings]);

  const filteredAndSortedRankings = useMemo(() => {
    let rankings: any[] = [];

    switch (activeTab) {
      case 'teams':
        rankings = teamRankings || [];
        break;
      case 'schools':
        rankings = schoolRankings || [];
        break;
      case 'students':
        rankings = studentRankings || [];
        break;
      case 'volunteers':
        rankings = volunteerRankings || [];
        break;
    }

    if (searchQuery) {
      rankings = rankings.filter(item => {
        const searchFields = [
          item.team_name,
          item.school_name,
          item.speaker_name,
          item.volunteer_name
        ].filter(Boolean).join(' ').toLowerCase();

        return searchFields.includes(searchQuery.toLowerCase());
      });
    }

    if (filterSchool !== 'all') {
      rankings = rankings.filter(item =>
        item.school_id === filterSchool || item.school_name === filterSchool
      );
    }

    rankings.sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case 'name':
          aValue = a.team_name || a.school_name || a.speaker_name || a.volunteer_name || '';
          bValue = b.team_name || b.school_name || b.speaker_name || b.volunteer_name || '';
          break;
        case 'performance':
          aValue = a.total_points || a.total_speaker_points || a.total_debates_judged || 0;
          bValue = b.total_points || b.total_speaker_points || b.total_debates_judged || 0;
          break;
        default:
          aValue = a.rank;
          bValue = b.rank;
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return rankings;
  }, [activeTab, teamRankings, schoolRankings, studentRankings, volunteerRankings, searchQuery, filterSchool, sortBy, sortDirection]);

  const availableSchools = useMemo(() => {
    const schools = new Set<{id: string, name: string}>();

    [teamRankings, schoolRankings, studentRankings, volunteerRankings].forEach(rankings => {
      rankings?.forEach((item: any) => {
        if (item.school_id && item.school_name) {
          schools.add({id: item.school_id, name: item.school_name});
        }
      });
    });

    return Array.from(schools);
  }, [teamRankings, schoolRankings, studentRankings, volunteerRankings]);

  const updateReleaseSettings = async (newSettings: typeof releaseSettings) => {
    if (!canManageReleaseSettings || !updateRankingReleaseMutation) {
      toast.error("You don't have permission to update ranking settings");
      return;
    }

    try {
      await updateRankingReleaseMutation({
        token,
        tournament_id: tournament._id,
        ranking_settings: newSettings,
      });
      setReleaseSettings(newSettings);
      toast.success("Ranking visibility updated");
    } catch (error: any) {
      toast.error(error.message || "Failed to update settings");
    }
  };

  const exportRankings = () => {
    if (!canExportRankings) {
      toast.error("You don't have permission to export rankings");
      return;
    }

    const currentData = filteredAndSortedRankings;
    if (!currentData || currentData.length === 0) {
      toast.error("No data to export");
      return;
    }

    const headers = Object.keys(currentData[0] || {});

    if (exportFormat === 'csv') {
      const csv = [
        headers.join(','),
        ...currentData.map((row: any) => headers.map(header => {
          const value = row[header];
          return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
        }).join(','))
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${tournament.name}-${activeTab}-rankings${includeElimination ? '-full' : '-prelims'}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast.success("Rankings exported successfully");
    } else {
      toast.info("PDF export coming soon");
    }
  };

  const toggleDetails = (id: string) => {
    setShowDetails(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const RankingBadge = ({ rank }: { rank: number }) => {
    if (rank === 1) {
      return <Crown className="h-6 w-6 text-yellow-500" />;
    } else if (rank === 2) {
      return <Medal className="h-6 w-6 text-gray-400" />;
    } else if (rank === 3) {
      return <Award className="h-6 w-6 text-amber-600" />;
    }
    return (
      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground">
        {rank}
      </div>
    );
  };

  const PerformanceIndicator = ({ value, max, label }: { value: number; max: number; label: string }) => {
    const percentage = Math.min((value / max) * 100, 100);
    const getColor = () => {
      if (percentage >= 80) return 'bg-green-500';
      if (percentage >= 60) return 'bg-yellow-500';
      return 'bg-red-500';
    };

    return (
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span>{label}</span>
          <span>{value}/{max}</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${getColor()}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  };

  const NotAvailableCard = ({ response, title, icon: Icon }: {
    response: RankingResponse<any>;
    title: string;
    icon: any;
  }) => (
    <Card>
      <CardContent className="text-center py-12">
        <Icon className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
        <h3 className="font-medium mb-2">{title}</h3>
        <p className="text-muted-foreground text-xs max-w-md mx-auto">
          {response.error}
        </p>
        {canRecalculateRankings && response.type === 'data_insufficient' && (
          <div className="mt-4">
            <Alert className="text-left max-w-md mx-auto">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Admin Note</AlertTitle>
              <AlertDescription className="text-xs">
                Rankings become available once preliminary rounds are completed and results are scored.
              </AlertDescription>
            </Alert>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const TeamRankingCard = ({ team }: { team: TeamRanking }) => (
    <Card className="hover:shadow-md transition-all duration-200">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <RankingBadge rank={team.rank} />
            <div>
              <h3 className="font-semibold text-lg">{team.team_name}</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {team.school_name && <span>{team.school_name}</span>}
                {team.school_type && <Badge variant="outline">{team.school_type}</Badge>}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">{team.total_wins}</div>
            <div className="text-sm text-muted-foreground">wins</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <div className="text-xl font-bold">{team.total_points}</div>
            <div className="text-xs text-muted-foreground">Total Points</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold">{team.total_losses}</div>
            <div className="text-xs text-muted-foreground">Losses</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold">{team.opponents_total_wins}</div>
            <div className="text-xs text-muted-foreground">Opp Wins</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-center text-sm">
          <div>
            <div className="font-medium">{team.opponents_total_points}</div>
            <div className="text-xs text-muted-foreground">Opponent Points</div>
          </div>
          <div>
            <div className="font-medium">{team.head_to_head_wins}</div>
            <div className="text-xs text-muted-foreground">H2H Wins</div>
          </div>
        </div>

        {team.eliminated_in_round && (
          <div className="mt-3 pt-3 border-t">
            <Badge variant="secondary" className="w-full justify-center">
              Eliminated in Round {team.eliminated_in_round}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const SchoolRankingCard = ({ school }: { school: SchoolRanking }) => (
    <Card className="hover:shadow-md transition-all duration-200">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <RankingBadge rank={school.rank} />
            <div>
              <h3 className="font-semibold text-lg">{school.school_name}</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline">{school.school_type}</Badge>
                <span>{school.total_teams} teams</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">{school.total_wins}</div>
            <div className="text-sm text-muted-foreground">wins</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <div className="text-xl font-bold">{school.total_points}</div>
            <div className="text-xs text-muted-foreground">Total Points</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold">#{school.best_team_rank}</div>
            <div className="text-xs text-muted-foreground">Best Team</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold">{school.avg_team_rank.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">Avg Rank</div>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => toggleDetails(school.school_id)}
          className="w-full"
        >
          {showDetails[school.school_id] ? (
            <>
              <ChevronUp className="h-4 w-4 mr-1" />
              Hide Teams
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4 mr-1" />
              Show Teams ({school.teams.length})
            </>
          )}
        </Button>

        {showDetails[school.school_id] && (
          <>
            <Separator className="my-3" />
            <div className="space-y-2">
              {school.teams.map((team) => (
                <div key={team.team_id} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">#{team.rank}</Badge>
                    <span className="font-medium">{team.team_name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{team.wins} wins</span>
                    <span>{team.total_points} pts</span>
                    {team.eliminated_in_round && (
                      <Badge variant="secondary">
                        Elim R{team.eliminated_in_round}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );

  const StudentRankingCard = ({ student }: { student: StudentRanking }) => (
    <Card className="hover:shadow-md transition-all duration-200">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <RankingBadge rank={student.rank} />
            <div>
              <h3 className="font-semibold text-lg">{student.speaker_name}</h3>
              <div className="text-sm text-muted-foreground">
                {student.team_name && <div>{student.team_name}</div>}
                {student.school_name && <div>{student.school_name}</div>}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">{student.total_speaker_points}</div>
            <div className="text-sm text-muted-foreground">total points</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <PerformanceIndicator
            value={student.total_speaker_points}
            max={Math.max(100, student.total_speaker_points)}
            label="Speaker Points"
          />
          <PerformanceIndicator
            value={student.team_wins}
            max={tournament.prelim_rounds + (includeElimination ? tournament.elimination_rounds : 0)}
            label="Team Wins"
          />
        </div>

        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <div className="text-lg font-bold">{student.average_speaker_score.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">Avg Score</div>
          </div>
          <div>
            <div className="text-lg font-bold">#{student.team_rank}</div>
            <div className="text-xs text-muted-foreground">Team Rank</div>
          </div>
          <div>
            <div className="text-lg font-bold">{student.debates_count}</div>
            <div className="text-xs text-muted-foreground">Debates</div>
          </div>
          <div>
            <div className="text-lg font-bold">{student.highest_individual_score}</div>
            <div className="text-xs text-muted-foreground">Best Score</div>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t text-center text-sm">
          <div className="font-medium">{student.points_deviation.toFixed(2)}</div>
          <div className="text-xs text-muted-foreground">Points Deviation</div>
        </div>

        {student.cross_tournament_performance.tournaments_participated > 0 && (
          <div className="mt-4 pt-3 border-t">
            <div className="text-sm font-medium mb-2">Cross-Tournament Performance</div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <div className="font-medium">{student.cross_tournament_performance.tournaments_participated}</div>
                <div className="text-muted-foreground">Tournaments</div>
              </div>
              <div>
                <div className="font-medium">{student.cross_tournament_performance.avg_points_per_tournament.toFixed(1)}</div>
                <div className="text-muted-foreground">Avg Points</div>
              </div>
              <div>
                <div className="font-medium">
                  {student.cross_tournament_performance.best_tournament_rank ?
                    `#${student.cross_tournament_performance.best_tournament_rank}` : 'N/A'
                  }
                </div>
                <div className="text-muted-foreground">Best Rank</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const VolunteerRankingCard = ({ volunteer }: { volunteer: VolunteerRanking }) => (
    <Card className="hover:shadow-md transition-all duration-200">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <RankingBadge rank={volunteer.rank} />
            <div>
              <h3 className="font-semibold text-lg">{volunteer.volunteer_name}</h3>
              {volunteer.school_name && (
                <div className="text-sm text-muted-foreground">{volunteer.school_name}</div>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">{volunteer.total_debates_judged}</div>
            <div className="text-sm text-muted-foreground">debates judged</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <PerformanceIndicator
            value={volunteer.elimination_debates_judged}
            max={volunteer.total_debates_judged}
            label="Elimination Debates"
          />
          <PerformanceIndicator
            value={Math.round(volunteer.avg_feedback_score)}
            max={5}
            label="Feedback Rating"
          />
        </div>

        <div className="grid grid-cols-4 gap-2 text-center mb-4">
          <div>
            <div className="text-lg font-bold">{volunteer.head_judge_assignments}</div>
            <div className="text-xs text-muted-foreground">Head Judge</div>
          </div>
          <div>
            <div className="text-lg font-bold">{volunteer.attendance_score.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">Attendance</div>
          </div>
          <div>
            <div className="text-lg font-bold">{volunteer.consistency_score.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">Consistency</div>
          </div>
          <div>
            <div className="text-lg font-bold">{volunteer.total_feedback_count}</div>
            <div className="text-xs text-muted-foreground">Reviews</div>
          </div>
        </div>

        {volunteer.cross_tournament_stats.tournaments_judged > 0 && (
          <div className="pt-3 border-t">
            <div className="text-sm font-medium mb-2">Cross-Tournament Stats</div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <div className="font-medium">{volunteer.cross_tournament_stats.tournaments_judged}</div>
                <div className="text-muted-foreground">Tournaments</div>
              </div>
              <div>
                <div className="font-medium">{volunteer.cross_tournament_stats.total_debates_across_tournaments}</div>
                <div className="text-muted-foreground">Total Debates</div>
              </div>
              <div>
                <div className="font-medium">{volunteer.cross_tournament_stats.avg_feedback_across_tournaments.toFixed(1)}</div>
                <div className="text-muted-foreground">Avg Rating</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const isLoading = !teamRankingsResponse || !schoolRankingsResponse || !studentRankingsResponse || !volunteerRankingsResponse;

  const currentRankings = filteredAndSortedRankings;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <RankingSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex bg-brown rounded-t-md flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-3">
          <div>
            <h2 className="text-xl text-white font-bold">Tournament Rankings</h2>
            <div className="flex items-center gap-4 text-xs text-gray-300">
            <span>
              {includeElimination ? 'Full Tournament' : 'Preliminary Rounds'} Results
            </span>
              {currentRankings.length > 0 && (
                <span>{currentRankings.length} entries</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {canToggleElimination && (
              <div className="flex items-center space-x-1">
                <Switch
                  id="include-elims"
                  checked={includeElimination}
                  onCheckedChange={setIncludeElimination}
                />
                <Label htmlFor="include-elims" className="text-xs text-white">
                  Include Eliminations
                </Label>
              </div>
            )}

            {canExportRankings && (
              <>
                <Select value={exportFormat} onValueChange={(value: 'csv' | 'pdf') => setExportFormat(value)}>
                  <SelectTrigger className="w-18 h-8 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  onClick={exportRankings}
                  disabled={!currentRankings || currentRankings.length === 0}
                  size="sm"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden custom:block">Export</span>
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="p-4 space-y-2">

          {canManageReleaseSettings && (
            <Alert>
              <Settings className="h-4 w-4" />
              <AlertTitle>Ranking Visibility Controls</AlertTitle>
              <AlertDescription>
                <div className="space-y-4 mt-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h5 className="text-sm font-medium mb-2">Preliminary Rankings</h5>
                      <div className="space-y-2">
                        {(['teams', 'schools', 'students', 'volunteers'] as const).map(type => (
                          <div key={type} className="flex items-center space-x-2">
                            <Checkbox
                              id={`prelims-${type}`}
                              checked={releaseSettings.prelims[type]}
                              onCheckedChange={(checked) => {
                                const newSettings = {
                                  ...releaseSettings,
                                  prelims: {
                                    ...releaseSettings.prelims,
                                    [type]: checked
                                  }
                                };
                                updateReleaseSettings(newSettings);
                              }}
                            />
                            <Label htmlFor={`prelims-${type}`} className="text-xs capitalize">
                              {type}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h5 className="text-sm font-medium mb-2">Full Tournament Rankings</h5>
                      <div className="space-y-2">
                        {(['teams', 'schools', 'students', 'volunteers'] as const).map(type => (
                          <div key={type} className="flex items-center space-x-2">
                            <Checkbox
                              id={`full-${type}`}
                              checked={releaseSettings.full_tournament[type]}
                              onCheckedChange={(checked) => {
                                const newSettings = {
                                  ...releaseSettings,
                                  full_tournament: {
                                    ...releaseSettings.full_tournament,
                                    [type]: checked
                                  }
                                };
                                updateReleaseSettings(newSettings);
                              }}
                            />
                            <Label htmlFor={`full-${type}`} className="text-xs capitalize">
                              {type}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}



          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search rankings..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-8"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Select value={sortBy} onValueChange={(value: 'rank' | 'name' | 'performance') => setSortBy(value)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rank">Rank</SelectItem>
                      <SelectItem value="name">Name</SelectItem>
                      <SelectItem value="performance">Performance</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
                  >
                    {sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>

                  {availableSchools.length > 0 && (
                    <Select value={filterSchool} onValueChange={setFilterSchool}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Filter by school" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Schools</SelectItem>
                        {availableSchools.map(school => (
                          <SelectItem key={school.id} value={school.id}>
                            {school.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>


          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="teams" className="flex items-center gap-2">
                <UsersRound className="h-4 w-4" />
                <span className="hidden custom:inline">Teams</span>
                {teamRankings && (
                  <Badge variant="secondary" className="ml-1 hidden custom:inline-flex">
                    {teamRankings.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="schools" className="flex items-center gap-2">
                <School className="h-4 w-4" />
                <span className="hidden custom:inline">Schools</span>
                {schoolRankings && (
                  <Badge variant="secondary" className="ml-1 hidden custom:inline-flex">
                    {schoolRankings.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="students" className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                <span className="hidden custom:inline">Students</span>
                {studentRankings && (
                  <Badge variant="secondary" className="ml-1 hidden custom:inline-flex">
                    {studentRankings.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="volunteers" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="hidden custom:inline">Volunteers</span>
                {volunteerRankings && (
                  <Badge variant="secondary" className="ml-1 hidden custom:inline-flex">
                    {volunteerRankings.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-2">Loading rankings...</span>
              </div>
            )}

            <TabsContent value="teams" className="space-y-4">
              {teamError ? (
                <NotAvailableCard
                  response={teamRankingsResponse!}
                  title="Team Rankings Not Available"
                  icon={UsersRound}
                />
              ) : currentRankings.length > 0 ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {currentRankings.map((team: TeamRanking) => (
                    <TeamRankingCard key={team.team_id} team={team} />
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="text-center py-12">
                    <UsersRound className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Team Rankings</h3>
                    <p className="text-muted-foreground">
                      {searchQuery || filterSchool !== 'all'
                        ? 'No teams match your search criteria.'
                        : 'Team rankings will appear here once calculated.'
                      }
                    </p>
                    {(searchQuery || filterSchool !== 'all') && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSearchQuery('');
                          setFilterSchool('all');
                        }}
                        className="mt-3"
                      >
                        Clear Filters
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="schools" className="space-y-4">
              {schoolError ? (
                <NotAvailableCard
                  response={schoolRankingsResponse!}
                  title="School Rankings Not Available"
                  icon={Building}
                />
              ) : currentRankings.length > 0 ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {currentRankings.map((school: SchoolRanking) => (
                    <SchoolRankingCard key={school.school_id} school={school} />
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="text-center py-12">
                    <Building className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No School Rankings</h3>
                    <p className="text-muted-foreground">
                      {searchQuery || filterSchool !== 'all'
                        ? 'No schools match your search criteria.'
                        : 'School rankings will appear here once calculated.'
                      }
                    </p>
                    {(searchQuery || filterSchool !== 'all') && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSearchQuery('');
                          setFilterSchool('all');
                        }}
                        className="mt-3"
                      >
                        Clear Filters
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="students" className="space-y-4">
              {studentError ? (
                <NotAvailableCard
                  response={studentRankingsResponse!}
                  title="Student Rankings Not Available"
                  icon={Users}
                />
              ) : currentRankings.length > 0 ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {currentRankings.map((student: StudentRanking) => (
                    <StudentRankingCard key={student.speaker_id} student={student} />
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="text-center py-12">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Student Rankings</h3>
                    <p className="text-muted-foreground">
                      {searchQuery || filterSchool !== 'all'
                        ? 'No students match your search criteria.'
                        : 'Student rankings will appear here once calculated.'
                      }
                    </p>
                    {(searchQuery || filterSchool !== 'all') && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSearchQuery('');
                          setFilterSchool('all');
                        }}
                        className="mt-3"
                      >
                        Clear Filters
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="volunteers" className="space-y-4">
              {volunteerError ? (
                <NotAvailableCard
                  response={volunteerRankingsResponse!}
                  title="Volunteer Rankings Not Available"
                  icon={Star}
                />
              ) : currentRankings.length > 0 ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {currentRankings.map((volunteer: VolunteerRanking) => (
                    <VolunteerRankingCard key={volunteer.volunteer_id} volunteer={volunteer} />
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="text-center py-12">
                    <Star className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Volunteer Rankings</h3>
                    <p className="text-muted-foreground">
                      {searchQuery || filterSchool !== 'all'
                        ? 'No volunteers match your search criteria.'
                        : 'Volunteer rankings will appear here once calculated.'
                      }
                    </p>
                    {(searchQuery || filterSchool !== 'all') && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSearchQuery('');
                          setFilterSchool('all');
                        }}
                        className="mt-3"
                      >
                        Clear Filters
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </Card>
    </div>
  );
}