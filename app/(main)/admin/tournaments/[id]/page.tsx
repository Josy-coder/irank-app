"use client"

import React, { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useAuth } from "@/hooks/use-auth"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import {
  FileText,
  Mail,
  Users,
  GitBranch,
  Trophy, SquareLibrary
} from "lucide-react";
import { TournamentOverview } from "@/components/tournaments/tournament-overview"
import { TournamentInvitations } from "@/components/tournaments/tournament-invitations";
import { TournamentTeams } from "@/components/tournaments/tournament-teams";
import TournamentPairings from "@/components/tournaments/tournament-pairing";
import TournamentRankings from "@/components/tournaments/tournament-ranking";
import TournamentBallots from "@/components/tournaments/tournament-ballot";

const navigationItems = [
  {
    id: "overview",
    label: "Tournament Info",
    icon: FileText,
  },
  {
    id: "invitations",
    label: "Invitations",
    icon: Mail,
  },
  {
    id: "teams",
    label: "Teams",
    icon: Users,
  },
  {
    id: "pairings",
    label: "Pairings",
    icon: GitBranch,
  },

  {
    id: "ballots",
    label: "Ballots",
    icon: SquareLibrary,
  },
  {
    id: "ranking",
    label: "Ranking",
    icon: Trophy,
  }
]

function TournamentSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-18" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  )
}

function TournamentSidebar({
                             activeSection,
                             onSectionChange,
                             className
                           }: {
  activeSection: string
  onSectionChange: (section: string) => void
  className?: string
}) {
  return (
    <div className={cn("bg-transparent", className)}>

      <nav>
        <ul className="space-y-1">
          {navigationItems.map((item) => {
            const Icon = item.icon
            const isActive = activeSection === item.id

            return (
              <li key={item.id}>
                <button
                  onClick={() => onSectionChange(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-2 text-sm rounded-md transition-colors",
                    "hover:bg-input hover:text-accent-foreground",
                    isActive && "bg-input text-primary font-medium"
                  )}
                >
                  <Icon className={cn(
                    "h-4 w-4 shrink-0",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )} />
                  <span className="truncate">{item.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}

function MobileNavigation({
                            activeSection,
                            onSectionChange
                          }: {
  activeSection: string
  onSectionChange: (section: string) => void
}) {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t z-50">
      <div className="flex overflow-x-auto">
        {navigationItems.map((item) => {
          const Icon = item.icon
          const isActive = activeSection === item.id

          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={cn(
                "flex-1 min-w-0 flex flex-col items-center gap-1 py-2 px-1",
                "text-xs transition-colors",
                isActive
                  ? "text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate text-[10px]">{item.label.split(" ")[0]}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function TournamentPage() {
  const { user, token } = useAuth()
  const router = useRouter()

  const [activeSection, setActiveSection] = useState("overview")

  const { id } = useParams();
  const paramSlug = Array.isArray(id) ? id[0] : id;
  const [slug, setSlug] = useState(paramSlug);

  const tournament = useQuery(
    api.functions.tournaments.getTournamentBySlug,
    slug ? { slug } : "skip"
  );

  useEffect(() => {
    const hash = window.location.hash.replace('#', '')
    if (hash && navigationItems.some(item => item.id === hash)) {
      setActiveSection(hash)
    }
  }, [])

  const handleSectionChange = (section: string) => {
    setActiveSection(section)

    const url = new URL(window.location.href)
    url.hash = section
    window.history.replaceState({}, '', url.toString())
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-6">
          <TournamentSkeleton />
        </div>
      </div>
    )
  }

  if (!user || !token) {
    return <div>Please sign in to view tournament details</div>
  }

  const userRole = user.role as "admin" | "school_admin" | "volunteer" | "student"

  const renderSection = () => {
    switch (activeSection) {
      case "overview":
        return (
          <TournamentOverview
            tournament={tournament}
            userRole={userRole}
            token={token}
            onSlugChange={(newSlug) => {
              setSlug(newSlug);
              router.replace(`/admin/tournaments/${newSlug}${window.location.hash}`);
            }}
          />
        )
      case "invitations":
        return (
          <TournamentInvitations
            tournament={tournament}
            userRole={userRole}
            token={token}
            userId={user?.id}
            schoolId={user?.school?.id}
          />
        )
      case "teams":
        return (
          <TournamentTeams
            tournament={tournament}
            userRole={userRole}
            token={token}
            userId={user?.id}
            schoolId={user?.school?.id}
          />
        )
      case "pairings":
        return (
          <TournamentPairings
            tournament={tournament}
            userRole={userRole}
            token={token}
            userId={user?.id}
            schoolId={user?.school?.id}
          />
        )
      case "ballots":
        return (
          <TournamentBallots
            tournament={tournament}
            userRole={userRole}
            token={token}
            userId={user.id}
          />
        )
      case "ranking":
        return (
          <TournamentRankings
            tournament={tournament}
            userRole={userRole}
            token={token}
            userId={user?.id}
            schoolId={user?.school?.id}
          />
        )
      default:
        return (
          <TournamentOverview
            tournament={tournament}
            userRole={userRole}
            token={token}
            onSlugChange={(newSlug) => {
              setSlug(newSlug);
              router.replace(`/admin/tournaments/${newSlug}${window.location.hash}`);
            }}
          />
        )
    }
  }

  return (
    <div>

      <div className="flex min-h-screen gap-6">
        <div className="hidden md:block w-42 shrink-0 mt-6">
          <div className="h-full">
            <TournamentSidebar
              activeSection={activeSection}
              onSectionChange={handleSectionChange}
              className="h-full"
            />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="py-6 lg:pb-6">
            {renderSection()}
          </div>
        </div>
      </div>

      <MobileNavigation
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
      />

    </div>
  )
}