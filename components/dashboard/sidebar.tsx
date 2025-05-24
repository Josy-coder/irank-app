"use client"

import { useState } from "react"
import { useAuth, useRoleAccess } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"
import {
  Home,
  Users,
  School,
  Trophy,
  Calendar,
  BarChart3,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import Image from "next/image"

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
    { icon: BarChart3, label: "Analytics", href: "/dashboard/admin/analytics" },
  ],
}

export function DashboardSidebar() {
  const { user, signOut } = useAuth()
  const { isVerified } = useRoleAccess()
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)

  if (!user) return null

  const items = sidebarItems[user.role as keyof typeof sidebarItems] || []

  return (
    <TooltipProvider>
      <div className={cn(
        "hidden lg:flex flex-col bg-white dark:bg-gray-800 shadow-lg border-r border-gray-200 dark:border-gray-700 transition-all duration-300",
        isCollapsed ? "w-16" : "w-64"
      )}>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            {!isCollapsed ? (
              <div className="flex items-center space-x-3">
                <Image
                  src="/images/logo.png"
                  alt="iRankHub Logo"
                  width={32}
                  height={32}
                />
                <div>
                  <h2 className="text-lg font-bold text-gray-800 dark:text-white">
                    iRankHub
                  </h2>
                  <p className="text-xs text-gray-600 dark:text-gray-400 capitalize">
                    {user.role.replace('_', ' ')} Dashboard
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex justify-center">
                <Image
                  src="/images/logo.png"
                  alt="iRankHub Logo"
                  width={32}
                  height={32}
                />
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1"
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {!isVerified() && !isCollapsed && (
          <div className="mx-4 my-3 p-3 bg-amber-100 dark:bg-amber-900 rounded-lg">
            <p className="text-xs text-amber-800 dark:text-amber-200">
              Account pending approval
            </p>
          </div>
        )}
        <nav className="flex-1 py-4">
          {items.map((item) => {
            const isActive = pathname === item.href

            const navItem = (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-colors",
                  isCollapsed ? "mx-2 p-3 rounded-lg justify-center" : "px-6 py-3",
                  isActive && "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white border-r-2 border-blue-500"
                )}
              >
                <item.icon className={cn("h-5 w-5", !isCollapsed && "mr-3")} />
                {!isCollapsed && item.label}
              </Link>
            )

            return isCollapsed ? (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  {navItem}
                </TooltipTrigger>
                <TooltipContent side="right">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            ) : navItem
          })}
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          {isCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={signOut}
                  variant="ghost"
                  className="w-full p-3 flex justify-center text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <LogOut className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                Sign Out
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button
              onClick={signOut}
              variant="outline"
              className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}

export function MobileBottomNavigation() {
  const { user, signOut } = useAuth()
  const pathname = usePathname()
  const [showMenu, setShowMenu] = useState(false)

  if (!user) return null

  const items = sidebarItems[user.role as keyof typeof sidebarItems] || []
  const mainItems = items.slice(0, 3)
  const menuItems = items.slice(3)

  return (
    <>
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-40">
        <div className="grid grid-cols-4 h-16">
          {mainItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center text-xs font-medium transition-colors",
                  isActive
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                )}
              >
                <item.icon className={cn(
                  "h-5 w-5 mb-1",
                  isActive && "text-blue-600 dark:text-blue-400"
                )} />
                <span className="truncate">{item.label}</span>
              </Link>
            )
          })}

          <button
            onClick={() => setShowMenu(true)}
            className="flex flex-col items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <Menu className="h-5 w-5 mb-1" />
            <span>Menu</span>
          </button>
        </div>
      </div>
      {showMenu && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-50" onClick={() => setShowMenu(false)}>
          <div
            className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-xl max-h-[60vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3">
                <Image
                  src="/images/logo.png"
                  alt="iRankHub Logo"
                  width={24}
                  height={24}
                />
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Menu</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 capitalize">
                    {user.role.replace('_', ' ')}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMenu(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Menu Items */}
            <div className="p-2">
              {menuItems.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setShowMenu(false)}
                    className={cn(
                      "flex items-center px-4 py-3 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-colors",
                      isActive && "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white"
                    )}
                  >
                    <item.icon className="h-5 w-5 mr-3" />
                    {item.label}
                  </Link>
                )
              })}

              {/* Divider */}
              <div className="my-2 border-t border-gray-200 dark:border-gray-700" />

              <div className="px-4 py-2">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">{user.email}</p>
              </div>
              <button
                onClick={() => {
                  setShowMenu(false)
                  signOut()
                }}
                className="w-full flex items-center px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <LogOut className="h-5 w-5 mr-3" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="lg:hidden h-16" />
    </>
  )
}