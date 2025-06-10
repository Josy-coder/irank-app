"use client"

import React, { useState, useEffect, useMemo } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SchoolSelector } from "@/components/school-selector"
import { useDebounce } from "@/hooks/use-debounce"
import { toast } from "sonner"
import { Id } from "@/convex/_generated/dataModel"
import {
  X,
  Search,
  Plus,
  School,
  AlertCircle,
  Ticket
} from "lucide-react"

interface TeamManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournament: any;
  team?: any;
  mode: "create" | "edit";
  userRole: "admin" | "school_admin" | "volunteer" | "student";
  token?: string | null;
  userId?: string;
  schoolId?: string;
}

export function TeamManagementDialog({
                                       open,
                                       onOpenChange,
                                       tournament,
                                       team,
                                       mode,
                                       userRole,
                                       token,
                                       userId,
                                       schoolId
                                     }: TeamManagementDialogProps) {
  const [teamName, setTeamName] = useState("");
  const [selectedSchool, setSelectedSchool] = useState<string | undefined>();
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [paymentStatus, setPaymentStatus] = useState<"pending" | "paid" | "waived">("pending");
  const [teamStatus, setTeamStatus] = useState<"active" | "withdrawn" | "disqualified">("active");
  const [waiverCode, setWaiverCode] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [showMemberSelector, setShowMemberSelector] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const debouncedMemberSearch = useDebounce(memberSearch, 300);
  const isAdmin = userRole === "admin";
  const isSchoolAdmin = userRole === "school_admin";
  const isStudent = userRole === "student";
  const isDreamsMode = tournament.league?.type === "Dreams Mode";

  const potentialMembers = useQuery(
    api.functions.teams.getPotentialTeamMembers,
    token ? {
      token,
      tournament_id: tournament._id,
      search: debouncedMemberSearch,
      school_id: isAdmin ? selectedSchool as Id<"schools"> : undefined,
      exclude_team_id: mode === "edit" && team ? team._id : undefined,
    } : "skip"
  );

  const createTeam = useMutation(
    isAdmin
      ? api.functions.admin.teams.createTeam
      : api.functions.teams.createUserTeam
  );

  const updateTeam = useMutation(
    isAdmin
      ? api.functions.admin.teams.updateTeam
      : api.functions.teams.updateUserTeam
  );

  useEffect(() => {
    if (mode === "edit" && team) {
      setTeamName(team.name);
      setSelectedSchool(team.school?._id);
      setSelectedMembers(team.members.map((m: any) => m._id));
      setPaymentStatus(team.payment_status);
      setTeamStatus(team.status);
    } else {
      setTeamName("");
      setSelectedSchool(isSchoolAdmin ? schoolId : undefined);
      setSelectedMembers(isStudent && userId ? [userId] : []);
      setPaymentStatus(isDreamsMode ? "paid" : "pending");
      setTeamStatus("active");
      setWaiverCode("");
    }
  }, [mode, team, isSchoolAdmin, isStudent, schoolId, userId, isDreamsMode]);

  const selectedMemberObjects = useMemo(() => {
    if (!potentialMembers) return [];
    return potentialMembers.filter(potentialMember =>
      selectedMembers.includes(potentialMember._id)
    );
  }, [potentialMembers, selectedMembers]);

  const availableMembers = useMemo(() => {
    if (!potentialMembers) return [];
    return potentialMembers.filter(potentialMember =>
      !selectedMembers.includes(potentialMember._id)
    );
  }, [potentialMembers, selectedMembers]);

  const handleAddMember = (memberId: string) => {
    if (selectedMembers.length >= tournament.team_size) {
      toast.error(`Maximum ${tournament.team_size} members allowed`);
      return;
    }
    setSelectedMembers([...selectedMembers, memberId]);
    setMemberSearch("");
  };

  const handleRemoveMember = (memberId: string) => {
    if (isStudent && memberId === userId) {
      toast.error("You cannot remove yourself from the team");
      return;
    }
    setSelectedMembers(selectedMembers.filter(id => id !== memberId));
  };

  const handleSubmit = async () => {
    if (!token) return;

    if (!teamName.trim()) {
      toast.error("Team name is required");
      return;
    }

    if (selectedMembers.length === 0) {
      toast.error("At least one team member is required");
      return;
    }

    if (selectedMembers.length > tournament.team_size) {
      toast.error(`Maximum ${tournament.team_size} members allowed`);
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === "create") {
        if (isAdmin) {
          await createTeam({
            admin_token: token,
            tournament_id: tournament._id,
            name: teamName.trim(),
            school_id: selectedSchool as Id<"schools">,
            members: selectedMembers as Id<"users">[],
            payment_status: paymentStatus,
          });
        } else {
          await createTeam({
            token,
            tournament_id: tournament._id,
            name: teamName.trim(),
            members: selectedMembers as Id<"users">[],
            waiver_code: waiverCode || undefined,
          });
        }
        toast.success("Team created successfully");
      } else {
        if (isAdmin) {
          await updateTeam({
            admin_token: token,
            team_id: team._id,
            name: teamName.trim(),
            school_id: selectedSchool as Id<"schools">,
            members: selectedMembers as Id<"users">[],
            payment_status: paymentStatus,
            status: teamStatus,
          });
        } else {
          await updateTeam({
            token,
            team_id: team._id,
            name: teamName.trim(),
            members: selectedMembers as Id<"users">[],
          });
        }
        toast.success("Team updated successfully");
      }
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || `Failed to ${mode} team`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canUseWaiverCode = isSchoolAdmin && !isDreamsMode && mode === "create";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Create Team" : "Edit Team"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? `Create a new team for ${tournament.name}`
              : `Edit team details for ${tournament.name}`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="teamName">Team Name</Label>
            <Input
              id="teamName"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Enter team name"
              disabled={isSubmitting}
            />
          </div>

          {isAdmin && (
            <div className="space-y-2">
              <Label>School (Optional)</Label>
              <SchoolSelector
                value={selectedSchool}
                onValueChange={setSelectedSchool}
                placeholder="Select school (optional)"
                disabled={isSubmitting}
              />
            </div>
          )}

          {isAdmin && mode === "edit" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Payment Status</Label>
                <Select value={paymentStatus} onValueChange={(value: any) => setPaymentStatus(value)} disabled={isSubmitting}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="waived">Waived</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Team Status</Label>
                <Select value={teamStatus} onValueChange={(value: any) => setTeamStatus(value)} disabled={isSubmitting}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="withdrawn">Withdrawn</SelectItem>
                    <SelectItem value="disqualified">Disqualified</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {canUseWaiverCode && (
            <div className="space-y-2">
              <Label htmlFor="waiverCode">Waiver Code (Optional)</Label>
              <div className="flex gap-2">
                <Ticket className="h-4 w-4 mt-3 text-muted-foreground" />
                <div className="flex-1">
                  <Input
                    id="waiverCode"
                    value={waiverCode}
                    onChange={(e) => setWaiverCode(e.target.value)}
                    placeholder="Enter waiver code to waive fees"
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter a valid waiver code to mark this team&#39;s fees as waived
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Team Members ({selectedMembers.length}/{tournament.team_size})</Label>

            {selectedMemberObjects.length > 0 && (
              <div className="space-y-2 p-3 border rounded-lg bg-muted/50">
                <div className="text-sm font-medium">Selected Members:</div>
                <div className="space-y-2">
                  {selectedMemberObjects.map((member) => (
                    <div key={member._id} className="flex items-center justify-between p-2 bg-background rounded border">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {member.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-sm">{member.name}</div>
                          <div className="text-xs text-muted-foreground">{member.email}</div>
                          {member.school && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <School className="h-3 w-3" />
                              {member.school.name}
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveMember(member._id)}
                        disabled={isSubmitting || (isStudent && member._id === userId)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Popover open={showMemberSelector} onOpenChange={setShowMemberSelector}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  disabled={selectedMembers.length >= tournament.team_size || isSubmitting}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Team Member
                  {selectedMembers.length >= tournament.team_size && (
                    <span className="ml-2 text-xs text-muted-foreground">(Maximum reached)</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder="Search students..."
                    value={memberSearch}
                    onValueChange={setMemberSearch}
                  />
                  <CommandList className="max-h-64">
                    <CommandEmpty>
                      <div className="flex flex-col items-center gap-2 py-6">
                        <Search className="h-6 w-6 text-muted-foreground" />
                        <div className="text-xs text-muted-foreground">
                          {debouncedMemberSearch.length > 0
                            ? `No students found for "${debouncedMemberSearch}"`
                            : "Search for students to add to the team"
                          }
                        </div>
                      </div>
                    </CommandEmpty>
                    <CommandGroup>
                      {availableMembers.map((student) => (
                        <CommandItem
                          key={student._id}
                          value={student._id}
                          onSelect={() => {
                            handleAddMember(student._id);
                            setShowMemberSelector(false);
                          }}
                          className="flex items-center gap-3 p-3"
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              {student.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{student.name}</div>
                            <div className="text-xs text-muted-foreground truncate">{student.email}</div>
                            {student.school && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <School className="h-3 w-3" />
                                {student.school.name}
                              </div>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {selectedMembers.length > tournament.team_size && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                Too many members selected. Maximum {tournament.team_size} allowed.
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || selectedMembers.length === 0}>
            {isSubmitting ? "Saving..." : mode === "create" ? "Create Team" : "Update Team"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}