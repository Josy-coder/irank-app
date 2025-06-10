"use client"

import React, { useState } from "react"
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
import { Share, Copy, Check, Users, MessageCircle } from "lucide-react"

interface ShareTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team?: any;
  tournament?: any;
}

export function ShareTeamDialog({
                                  open,
                                  onOpenChange,
                                  team,
                                  tournament
                                }: ShareTeamDialogProps) {
  const [copied, setCopied] = useState(false);

  if (!team || !tournament) return null;

  const invitationCode = team.invitation_code;
  const shareMessage = `Join my team "${team.name}" in ${tournament.name}!\n\nInvitation Code: ${invitationCode}\n\nEnter this code in the tournament teams section to join our team.`;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(invitationCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Invitation code copied!");
    } catch (error) {
      toast.error("Failed to copy invitation code");
    }
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(shareMessage);
      toast.success("Share message copied!");
    } catch (error) {
      toast.error("Failed to copy share message");
    }
  };

  const handleWhatsAppShare = () => {
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleSMSShare = () => {
    const smsUrl = `sms:?body=${encodeURIComponent(shareMessage)}`;
    window.open(smsUrl, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share className="h-5 w-5" />
            Share Team Invitation
          </DialogTitle>
          <DialogDescription>
            Share this invitation code with students so they can join your team.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <Users className="h-5 w-5 text-blue-600" />
            <div className="text-sm text-blue-800">
              <div className="font-medium">{team.name}</div>
              <div>{team.memberCount}/{tournament.team_size} members</div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Invitation Code</Label>
              <div className="flex gap-2">
                <Input
                  value={invitationCode}
                  readOnly
                  className="font-mono text-center text-lg font-bold tracking-wider"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyCode}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Share Message</Label>
              <div className="p-3 bg-muted rounded-lg border text-sm">
                {shareMessage}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyMessage}
                className="w-full"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Share Message
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Quick Share</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={handleWhatsAppShare}
                className="flex items-center gap-2"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </Button>
              <Button
                variant="outline"
                onClick={handleSMSShare}
                className="flex items-center gap-2"
              >
                <MessageCircle className="h-4 w-4" />
                SMS
              </Button>
            </div>
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <div>• Students need to enter this code in the &#34;Join Team&#34; section</div>
            <div>• Only students can join teams in Dreams Mode tournaments</div>
            <div>• Team will be locked once it reaches {tournament.team_size} members</div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} className="w-full">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}