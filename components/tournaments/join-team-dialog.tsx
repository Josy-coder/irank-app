"use client"

import React, { useState } from "react"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { QrCode, Users, AlertCircle } from "lucide-react"

interface JoinTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournament: any;
  token?: string | null;
}

export function JoinTeamDialog({
                                 open,
                                 onOpenChange,
                                 tournament,
                                 token,
                               }: JoinTeamDialogProps) {
  const [invitationCode, setInvitationCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const joinTeam = useMutation(api.functions.student.teams.joinTeamByCode);

  const handleSubmit = async () => {
    if (!token) return;

    if (!invitationCode.trim()) {
      toast.error("Please enter an invitation code");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await joinTeam({
        token,
        invitation_code: invitationCode.trim().toUpperCase(),
      });

      if (result.success) {
        toast.success(`Successfully joined team: ${result.team_name}`);
        setInvitationCode("");
        onOpenChange(false);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to join team");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setInvitationCode("");
    onOpenChange(false);
  };

  const isDreamsMode = tournament.league?.type === "Dreams Mode";

  if (!isDreamsMode) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Join Team
          </DialogTitle>
          <DialogDescription>
            Enter the invitation code shared by a team to join them in {tournament.name}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <Users className="h-5 w-5 text-blue-600" />
            <div className="text-sm text-blue-800">
              <div className="font-medium">Dreams Mode Tournament</div>
              <div>Students can join teams using invitation codes shared by team creators.</div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invitationCode">Invitation Code</Label>
            <Input
              id="invitationCode"
              value={invitationCode}
              onChange={(e) => setInvitationCode(e.target.value.toUpperCase())}
              placeholder="Enter team invitation code"
              disabled={isSubmitting}
              className="font-mono"
              maxLength={8}
            />
            <p className="text-xs text-muted-foreground">
              Team invitation codes are usually 8 characters long (e.g., ABC12345)
            </p>
          </div>

          {invitationCode.length > 0 && invitationCode.length < 8 && (
            <div className="flex items-center gap-2 text-sm text-amber-600">
              <AlertCircle className="h-4 w-4" />
              Invitation codes are typically 8 characters long
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !invitationCode.trim()}
          >
            {isSubmitting ? "Joining..." : "Join Team"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}