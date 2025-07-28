"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Building } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { Id } from "@/convex/_generated/dataModel"
import dynamic from "next/dynamic"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

import { ViewLeagueDetailsDialog } from "@/components/tournaments/view-league-details-dialog"

interface League {
  _id: Id<"leagues">
  name: string
  type: "Local" | "International" | "Dreams Mode"
  description?: string
  geographic_scope?: any
  status: "active" | "inactive" | "banned"
  created_at: number
  _creationTime: number
  hasTournaments?: boolean
}

export default function AdminTournamentsPage() {
  const { token, user } = useAuth()
  const [selectedLeagueId, setSelectedLeagueId] = useState<Id<"leagues"> | undefined>(undefined)
  const [mobileLeaguesOpen, setMobileLeaguesOpen] = useState(false)

  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null)
  const [leagueToDelete, setLeagueToDelete] = useState<League | null>(null)
  const isAdmin = user?.role === "admin"

  const deleteLeague = useMutation(api.functions.admin.leagues.deleteLeague)

  const handleLeagueSelect = (leagueId: Id<"leagues"> | undefined) => {
    setSelectedLeagueId(leagueId)
    setMobileLeaguesOpen(false)
  }

  const handleViewDetails = (league: League) => {
    setSelectedLeague(league)
    setShowDetailsDialog(true)
  }

  const handleDeleteLeague = (league: League) => {
    setLeagueToDelete(league)
    setShowDeleteDialog(true)
  }

  const handleDeleteConfirm = async () => {
    if (!leagueToDelete || !token) return

    try {
      await deleteLeague({
        admin_token: token,
        league_id: leagueToDelete._id,
      })
      toast.success("League deleted successfully")
      setShowDeleteDialog(false)
      setLeagueToDelete(null)

    } catch (error: any) {
      toast.error(error.message?.split("Uncaught Error:")[1]?.split(/\.|Called by client/)[0]?.trim() || "Failed to delete league")
    }
  }

  const LeagueList = dynamic(() =>
      import("@/components/tournaments/league-list").then(mod => mod.LeagueList),
    {
      loading: () => null,
      ssr: false,
    }
  )

  const TournamentList = dynamic(() =>
      import("@/components/tournaments/tournament-list").then(mod => mod.TournamentList),
    {
      loading: () => null,
      ssr: false,
    }
  )

  return (
    <div className="space-y-6">
      <div>
        <p className="text-muted-foreground">
          Manage tournaments and leagues across the platform
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:hidden">
          <Sheet open={mobileLeaguesOpen} onOpenChange={setMobileLeaguesOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="fixed bottom-6 right-6 z-50 shadow-lg rounded-full h-14 w-14 p-0"
              >
                <Building className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="w-full bg-background">
              <LeagueList
                userRole="admin"
                token={token}
                selectedLeagueId={selectedLeagueId}
                onLeagueSelect={handleLeagueSelect}
                onViewDetails={handleViewDetails}
                onDeleteLeague={handleDeleteLeague}
                className="h-full"
              />
            </SheetContent>
          </Sheet>
        </div>

        <div className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-2">
            <div className="h-[calc(100vh-8rem)] overflow-hidden">
              <LeagueList
                userRole="admin"
                token={token}
                selectedLeagueId={selectedLeagueId}
                onLeagueSelect={handleLeagueSelect}
                onViewDetails={handleViewDetails}
                onDeleteLeague={handleDeleteLeague}
                className="h-full"
              />
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <TournamentList
            userRole="admin"
            token={token}
            selectedLeagueId={selectedLeagueId}
          />
        </div>
      </div>

      {selectedLeagueId && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-40 lg:hidden">
          <div className="bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
            <Building className="h-4 w-4" />
            <span className="text-sm font-medium">League filter active</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 text-primary-foreground hover:bg-primary-foreground/20"
              onClick={() => setSelectedLeagueId(undefined)}
            >
              ✕
            </Button>
          </div>
        </div>
      )}

      
      {selectedLeague && (
        <ViewLeagueDetailsDialog
          open={showDetailsDialog}
          onOpenChange={setShowDetailsDialog}
          league={selectedLeague}
          token={token}
          userRole="admin"
        />
      )}
      {isAdmin && (

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete League</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &#34;{leagueToDelete?.name}&#34;? This action cannot be undone.
              {leagueToDelete?.hasTournaments && (
                <span className="block mt-2 text-destructive font-medium">
                  This league has tournaments and cannot be deleted.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
              disabled={leagueToDelete?.hasTournaments}
            >
              Delete League
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
        )}
    </div>
  )
}