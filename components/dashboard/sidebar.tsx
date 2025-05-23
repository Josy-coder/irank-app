"use client"

import { useAuth, useRoleAccess } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"
import {
  Home,
  Users,
  School,
  Trophy,
  Calendar,
  BarChart3,
  UserCheck,
  LogOut
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"

const sidebarItems = {
  student: [
    { icon: Home, label: "Dashboard", href: "/dashboard/student" },
    { icon: Trophy, label: "Tournaments", href: "/dashboard/student/tournaments" },
    { icon: Calendar, label: "Schedule", href: "/dashboard/student/schedule" },
    { icon: BarChart3, label: "Performance", href: "/dashboard/student/performance" },
  ],
  school_admin: [
    { icon: Home, label: "Dashboard", href: "/dashboard/school" },
    { icon: Users, label: "Students", href: "/dashboard/school/students" },
    { icon: Users, label: "Teams", href: "/dashboard/school/teams" },
    { icon: Trophy, label: "Tournaments", href: "/dashboard/school/tournaments" },
    { icon: BarChart3, label: "Analytics", href: "/dashboard/school/analytics" },
  ],
  volunteer: [
    { icon: Home, label: "Dashboard", href: "/dashboard/volunteer" },
    { icon: Calendar, label: "Assignments", href: "/dashboard/volunteer/assignments" },
    { icon: Trophy, label: "Tournaments", href: "/dashboard/volunteer/tournaments" },
    { icon: BarChart3, label: "History", href: "/dashboard/volunteer/history" },
  ],
  admin: [
    { icon: Home, label: "Dashboard", href: "/dashboard/admin" },
    { icon: Users, label: "Users", href: "/dashboard/admin/users" },
    { icon: School, label: "Schools", href: "/dashboard/admin/schools" },
    { icon: Trophy, label: "Tournaments", href: "/dashboard/admin/tournaments" },
    { icon: UserCheck, label: "Approvals", href: "/dashboard/admin/approvals" },
    { icon: BarChart3, label: "Analytics", href: "/dashboard/admin/analytics" },
  ],
}

export function DashboardSidebar() {
  const { user, signOut } = useAuth()
  const { isVerified } = useRoleAccess()
  const pathname = usePathname()

  if (!user) return null

  const items = sidebarItems[user.role as keyof typeof sidebarItems] || []

  return (
    <div className="bg-primary w-64 min-h-screen shadow-lg">
      <div className="p-6">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white">
          iRankHub
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {user.role.replace('_', ' ')} Dashboard
        </p>
      </div>

      {!isVerified() && (
        <div className="mx-4 mb-4 p-3 bg-amber-100 dark:bg-amber-900 rounded-lg">
          <p className="text-xs text-amber-800 dark:text-amber-200">
            Account pending approval
          </p>
        </div>
      )}

      <nav className="mt-6">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center px-6 py-3 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-colors",
              pathname === item.href && "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white border-r-2 border-blue-500"
            )}
          >
            <item.icon className="h-5 w-5 mr-3" />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="absolute bottom-4 left-4 right-4 text-destructive">
        <Button
          onClick={signOut}
          variant="outline"
          className="w-full"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  )
}