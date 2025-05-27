"use client"

import { useState, useEffect, createContext, useContext, ReactNode } from "react"
import { useAuth, useRoleAccess } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"
import {
  Users,
  School,
  Calendar,
  BarChart3,
  LogOut,
  Menu,
  Bell,
  Settings,
  User,
  Search,
  ChevronLeft,
  ChevronDown, LayoutDashboard, FileBadge2Icon, FilePieChart
} from "lucide-react";
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import Image from "next/image"
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Id } from "@/convex/_generated/dataModel";

const sidebarItems = {
  student: [
    { icon: LayoutDashboard, label: "Dashboard", href: "/student/dashboard" },
    { icon: FileBadge2Icon, label: "Tournaments", href: "/student/tournaments" },
    { icon: Calendar, label: "Schedule", href: "/student/schedule" },
    { icon: BarChart3, label: "Performance", href: "/student/performance" },
  ],
  school_admin: [
    { icon: LayoutDashboard, label: "Dashboard", href: "/school/dashboard" },
    { icon: Users, label: "Students", href: "/school/students" },
    { icon: Users, label: "Teams", href: "/school/teams" },
    { icon: FileBadge2Icon, label: "Tournaments", href: "/school/tournaments" },
    { icon: FilePieChart, label: "Analytics", href: "/school/analytics" },
  ],
  volunteer: [
    { icon: LayoutDashboard, label: "Dashboard", href: "/volunteer/dashboard" },
    { icon: Calendar, label: "Assignments", href: "/volunteer/assignments" },
    { icon: FileBadge2Icon, label: "Tournaments", href: "/volunteer/tournaments" },
    { icon: BarChart3, label: "History", href: "/volunteer/history" },
  ],
  admin: [
    { icon: LayoutDashboard, label: "Dashboard", href: "/admin/dashboard" },
    { icon: Users, label: "Users", href: "/admin/users" },
    { icon: School, label: "Schools", href: "/admin/schools" },
    { icon: FileBadge2Icon, label: "Tournaments", href: "/admin/tournaments" },
    { icon: FilePieChart, label: "Analytics", href: "/admin/analytics" },
  ],
}

interface TabItem {
  label: string
  href: string
  badge?: number
}

interface ContextualNavConfig {
  tabs: TabItem[]
  backHref?: string
  backLabel?: string
  showMainBottomNav?: boolean
}

interface NavigationContextType {
  isCollapsed: boolean
  setIsCollapsed: (collapsed: boolean) => void
  contextualNav: ContextualNavConfig | null
  setContextualNav: (config: ContextualNavConfig | null) => void
  hideMainBottomNav: () => void
  showMainBottomNav: () => void
}

const NavigationContext = createContext<NavigationContextType>({
  isCollapsed: false,
  setIsCollapsed: () => {},
  contextualNav: null,
  setContextualNav: () => {},
  hideMainBottomNav: () => {},
  showMainBottomNav: () => {},
})

export const useNavigation = () => useContext(NavigationContext)

export const useSidebar = () => {
  const { isCollapsed, setIsCollapsed } = useNavigation()
  return { isCollapsed, setIsCollapsed }
}

export const useContextualNavigation = () => {
  const { contextualNav, setContextualNav, hideMainBottomNav, showMainBottomNav } = useNavigation()

  const setTabs = (config: ContextualNavConfig) => {
    setContextualNav(config)
    if (!config.showMainBottomNav) {
      hideMainBottomNav()
    }
  }

  const clearTabs = () => {
    setContextualNav(null)
    showMainBottomNav()
  }

  return {
    contextualNav,
    setTabs,
    clearTabs
  }
}

export const useFeatureNavigation = (config: ContextualNavConfig) => {
  const { setTabs, clearTabs } = useContextualNavigation()

  useEffect(() => {
    setTabs(config)

    return () => {
      clearTabs()
    }
  }, [config.tabs.length, config.backHref])

  return { setTabs, clearTabs }
}

function generateBreadcrumbs(pathname: string, userRole: string) {
  const segments = pathname.split('/').filter(Boolean)
  const breadcrumbs = []

  const roleLabel = userRole === 'school_admin' ? 'School Admin' :
    userRole.charAt(0).toUpperCase() + userRole.slice(1)

  breadcrumbs.push({
    label: roleLabel,
    href: `/${segments[0]}/dashboard`,
    isRole: true
  })

  let currentPath = ''
  segments.forEach((segment, index) => {
    currentPath += `/${segment}`

    if (index > 0) {
      const label = segment.charAt(0).toUpperCase() + segment.slice(1)
      breadcrumbs.push({
        label,
        href: currentPath,
        isRole: false
      })
    }
  })

  return breadcrumbs
}

function getPageTitle(pathname: string) {
  const segments = pathname.split('/').filter(Boolean)
  const lastSegment = segments[segments.length - 1]

  if (!lastSegment) return 'Dashboard'

  const titleMap: Record<string, string> = {
    'dashboard': 'Dashboard',
    'tournaments': 'Tournaments',
    'students': 'Students',
    'teams': 'Teams',
    'analytics': 'Analytics',
    'schedule': 'Schedule',
    'performance': 'Performance',
    'assignments': 'Assignments',
    'history': 'History',
    'users': 'Users',
    'schools': 'Schools'
  }

  return titleMap[lastSegment] || lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1)
}

function ContextualTabNavigation() {
  const { contextualNav } = useNavigation()
  const { user } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [isSheetOpen, setIsSheetOpen] = useState(false)

  if (!contextualNav || !user) return null

  const mainItems = sidebarItems[user.role as keyof typeof sidebarItems] || []

  return (
    <div className="md:hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200">
        <div className="flex items-center space-x-2">
          {contextualNav.backHref && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(contextualNav.backHref!)}
              className="p-2"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}
        </div>

        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" className="p-2">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80">
            <SheetHeader>
              <SheetTitle className="text-left">Navigation</SheetTitle>
            </SheetHeader>
            <nav className="mt-6 space-y-2">
              {mainItems.map((item) => {
                const isActive = pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsSheetOpen(false)}
                    className={cn(
                      "flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-white"
                        : "text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    <item.icon className="h-5 w-5 mr-3" />
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </SheetContent>
        </Sheet>
      </div>

      <div className="bg-white border-b border-gray-200 overflow-x-auto">
        <div className="flex min-w-max px-4">
          {contextualNav.tabs.map((tab) => {
            const isActive = pathname === tab.href
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "relative flex items-center px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                  isActive
                    ? "text-primary border-primary"
                    : "text-gray-600 border-transparent hover:text-gray-900 hover:border-gray-300"
                )}
              >
                {tab.label}
                {tab.badge && tab.badge > 0 && (
                  <span className="ml-2 bg-primary text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {tab.badge}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function DashboardNavigation() {
  const { user, signOut } = useAuth()
  const { isVerified } = useRoleAccess()
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [, setIsMediumScreen] = useState(false)
  const [contextualNav, setContextualNav] = useState<ContextualNavConfig | null>(null)
  const [mainBottomNavVisible, setMainBottomNavVisible] = useState(true)
  const router = useRouter()

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const getUrl = useMutation(api.files.getUrl);

  useEffect(() => {
    async function fetchImageUrl() {
      if (user?.profile_image) {
        try {
          const url = await getUrl({ storageId: user.profile_image as Id<"_storage"> });
          setImageUrl(url);
        } catch (error) {
          console.error("Failed to fetch profile image URL:", error);
        }
      }
    }

    fetchImageUrl();
  }, [user?.profile_image, getUrl]);

  useEffect(() => {
    const checkScreenSize = () => {
      const isMd = window.innerWidth >= 768 && window.innerWidth < 1024
      setIsMediumScreen(isMd)
      if (isMd) {
        setIsCollapsed(true)
      }
    }

    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  const hideMainBottomNav = () => setMainBottomNavVisible(false)
  const showMainBottomNav = () => setMainBottomNavVisible(true)

  if (!user) return null

  const items = sidebarItems[user.role as keyof typeof sidebarItems] || []
  const breadcrumbs = generateBreadcrumbs(pathname, user.role)
  const pageTitle = getPageTitle(pathname)

  const navigationContextValue: NavigationContextType = {
    isCollapsed,
    setIsCollapsed,
    contextualNav,
    setContextualNav,
    hideMainBottomNav,
    showMainBottomNav,
  }

  return (
    <NavigationContext.Provider value={navigationContextValue}>
      <TooltipProvider>
        <div className={cn(
          "hidden md:flex flex-col bg-primary shadow-lg transition-all duration-300 fixed left-0 top-0 h-full z-50",
          isCollapsed ? "w-16" : "w-64"
        )}>
          <div className="p-4">
            <div className="flex items-center space-x-3">
              <div className="bg-white rounded-lg p-2 flex items-center justify-center">
                <Image
                  src="/images/logo.png"
                  alt="iRankHub Logo"
                  width={isCollapsed ? 52 : 36}
                  height={isCollapsed ? 52 : 36}
                />
              </div>
              {!isCollapsed && (
                <div>
                  <h2 className="text-lg font-bold text-white">
                    iRankHub
                  </h2>
                </div>
              )}
            </div>
          </div>
          <div className="mx-4 mb-3 min-h-[60px] flex items-center">
            {!isVerified() && (
              <div className={cn(
                "w-full p-3 bg-white/20 backdrop-blur-sm rounded-lg transition-opacity duration-300",
                isCollapsed ? "opacity-0" : "opacity-100"
              )}>
                <p className="text-xs text-white/90">
                  Account pending approval
                </p>
              </div>
            )}
          </div>

          <nav className="flex-1 px-3">
            {items.map((item) => {
              const isActive = pathname === item.href

              const navItem = (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center transition-all duration-200 rounded-md mb-1",
                    isCollapsed ? "p-3 justify-center" : "px-3 py-3",
                    isActive
                      ? "bg-white text-primary shadow-sm"
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <item.icon className={cn("h-5 w-5", !isCollapsed && "mr-3")} />
                  {!isCollapsed && (
                    <span className="font-medium text-sm">{item.label}</span>
                  )}
                </Link>
              )

              return isCollapsed ? (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    {navItem}
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-white text-primary border border-gray-200">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              ) : navItem
            })}
          </nav>

          <div className="p-4">
            {isCollapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={signOut}
                    variant="ghost"
                    className="w-full p-3 flex justify-center text-white/80 hover:text-white hover:bg-white/10 rounded-lg"
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
                variant="ghost"
                className="w-full text-white/80 hover:text-white hover:bg-white/10 border border-white/20 rounded-lg"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            )}
          </div>
        </div>
      </TooltipProvider>

      <div className={cn(
        "hidden md:block fixed top-0 right-0 z-40 transition-all duration-300",
        isCollapsed ? "left-16" : "left-64"
      )}>
        <div className="px-2 py-4 flex items-center justify-between backdrop-blur-md border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="text-gray-600 hover:text-gray-900"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="relative w-96">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Type to search"
                className="pl-10 bg-white/50 border-gray-200"
              />
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="relative">
              <div className="w-8 h-8 bg-white border border-[#E2E8F0] rounded-full flex items-center justify-center">
                <Bell className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                <span className="text-xs font-medium text-white">3</span>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 py-6 hover:bg-gray-200 rounded-md"
                >
                  <div className="hidden xl:flex xl:flex-col xl:items-start">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</p>
                    <p className="text-xs text-muted-foreground w-full text-right">
                      {user.role === 'school_admin'
                        ? 'School Admin'
                        : user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </p>
                  </div>
                  <Avatar className="w-8 h-8">
                    {user.profile_image ? (
                      <AvatarImage src={imageUrl || ""} alt={user.name} />
                    ) : null}
                    <AvatarFallback className="bg-primary text-white">
                      {user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <ChevronDown className="h-4 w-4 text-gray-400 ml-1" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div>
                    <p className="font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={user.role === "school_admin" ? "/school/profile" : `/${user.role}/profile`} prefetch>
                    <div className="flex items-center">
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </div>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={user.role === "school_admin" ? "/school/settings" : `/${user.role}/settings`} prefetch>
                    <div className="flex items-center">
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </div>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-primary">
              {pageTitle}
            </h1>

            <Breadcrumb>
              <BreadcrumbList>
                {breadcrumbs.map((crumb, index) => (
                  <div key={crumb.href} className="flex items-center">
                    {index > 0 && (
                      <BreadcrumbSeparator className="mx-2">
                        <span className="text-gray-400">/</span>
                      </BreadcrumbSeparator>
                    )}
                    <BreadcrumbItem>
                      {index === breadcrumbs.length - 1 ? (
                        <BreadcrumbPage className="text-primary font-medium">
                          {crumb.label}
                        </BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          <Link href={crumb.href} className="text-gray-600 hover:text-primary">
                            {crumb.label}
                          </Link>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </div>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </div>
      </div>

      <div className="md:hidden fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 z-50">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-white rounded-lg p-1">
              <Image
                src="/images/logo.png"
                alt="iRankHub Logo"
                width={36}
                height={36}
              />
            </div>
            <div>
              <h1 className="text-base font-semibold text-gray-900 dark:text-white">
                iRankHub
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="w-8 h-8 bg-white border border-[#E2E8F0] rounded-full flex items-center justify-center">
                <Bell className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                <span className="text-xs font-medium text-white">3</span>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-white">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div>
                    <p className="font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={user.role === "school_admin" ? "/school/profile" : `/${user.role}/profile`} prefetch>
                    <div className="flex items-center">
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </div>
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <Link href={user.role === "school_admin" ? "/school/settings" : `/${user.role}/settings`} prefetch>
                    <div className="flex items-center">
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </div>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <ContextualTabNavigation />

      {mainBottomNavVisible && !contextualNav && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-40">
          <div className={cn(
            "grid h-16",
            items.length <= 5 ? `grid-cols-${items.length}` : "grid-cols-5"
          )}>
            {items.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center justify-center text-xs font-medium transition-all duration-200",
                    isActive
                      ? "bg-primary text-white"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  )}
                >
                  <item.icon className={cn(
                    "h-5 w-5 mb-1",
                    isActive && "text-white"
                  )} />
                  <span className={cn(
                    "truncate px-1",
                    isActive && "text-white"
                  )}>{item.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      <div className="md:hidden h-16" />
      {mainBottomNavVisible && !contextualNav && <div className="md:hidden h-16" />}
    </NavigationContext.Provider>
  )
}

export const createTournamentTabs = (tournamentId: string, userRole: string) => ({
  tabs: [
    { label: "Overview", href: `/tournaments/${tournamentId}` },
    { label: "Bracket", href: `/tournaments/${tournamentId}/bracket` },
    { label: "Participants", href: `/tournaments/${tournamentId}/participants` },
    { label: "Results", href: `/tournaments/${tournamentId}/results` },
    { label: "Settings", href: `/tournaments/${tournamentId}/settings` },
  ],
  backHref: userRole === 'admin' ? '/admin/tournaments' :
    userRole === 'school_admin' ? '/school/tournaments' :
      userRole === 'volunteer' ? '/volunteer/tournaments' :
        '/student/tournaments',
  backLabel: "Tournaments"
})

export const createUserManagementTabs = () => ({
  tabs: [
    { label: "All Users", href: "/admin/users" },
    { label: "Students", href: "/admin/users/students" },
    { label: "Schools", href: "/admin/users/schools" },
    { label: "Volunteers", href: "/admin/users/volunteers" },
    { label: "Pending", href: "/admin/users/pending" },
  ],
  backHref: "/admin/dashboard",
  backLabel: "Dashboard"
})

export const createSchoolTabs = (schoolId: string) => ({
  tabs: [
    { label: "Overview", href: `/admin/schools/${schoolId}` },
    { label: "Students", href: `/admin/schools/${schoolId}/students` },
    { label: "Teams", href: `/admin/schools/${schoolId}/teams` },
    { label: "Performance", href: `/admin/schools/${schoolId}/performance` },
    { label: "Settings", href: `/admin/schools/${schoolId}/settings` },
  ],
  backHref: "/admin/schools",
  backLabel: "Schools"
})