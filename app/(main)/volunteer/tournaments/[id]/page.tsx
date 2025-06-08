"use client"

import React, { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useAuth } from "@/hooks/useAuth"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import {
  FileText,
  Mail,
  Users,
  GitBranch,
  Building,
  Gavel,
  Trophy
} from "lucide-react"
import { TournamentOverview } from "@/components/tournaments/tournament-overview"

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
    icon: FileText,
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

  if (!user) {
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
          <div className="text-center py-12">
            <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Invitations</h3>
            <p className="text-muted-foreground">Coming soon...</p>
          </div>
        )
      case "teams":
        return (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Teams</h3>
            <p className="text-muted-foreground">Coming soon...</p>
          </div>
        )
      case "pairings":
        return (
          <div className="text-center py-12">
            <GitBranch className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Pairings</h3>
            <p className="text-muted-foreground">Coming soon...</p>
          </div>
        )
      case "rooms":
        return (
          <div className="text-center py-12">
            <Building className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Rooms</h3>
            <p className="text-muted-foreground">Coming soon...</p>
          </div>
        )
      case "judges":
        return (
          <div className="text-center py-12">
            <Gavel className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Judges</h3>
            <p className="text-muted-foreground">Coming soon...</p>
          </div>
        )
      case "ballots":
        return (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Ballots</h3>
            <p className="text-muted-foreground">Coming soon...</p>
          </div>
        )
      case "ranking":
        return (
          <div className="text-center py-12">
            <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Ranking</h3>
            <p className="text-muted-foreground">Coming soon...</p>
          </div>
        )
      default:
        return (
          <TournamentOverview
            tournament={tournament}
            userRole={userRole}
            token={token}
          />
        )
    }
  }

  return (
    <div className="">

      <div className="flex gap-6">
        <div className="hidden md:block w-42 shrink-0">
          <div className="sticky top-6 h-screen">
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