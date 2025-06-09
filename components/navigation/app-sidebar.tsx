"use client"

import * as React from "react"
import { useAuth } from "@/hooks/useAuth"
import Image from "next/image"
import {
  Users,
  School,
  Calendar,
  BarChart3,
  LayoutDashboard,
  FileBadge2Icon,
  FilePieChart, X
} from "lucide-react";

import { NavMain } from "@/components/navigation/nav-main"
import { NavUser } from "@/components/navigation/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem,
  SidebarRail, useSidebar
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

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
    { icon: FileBadge2Icon, label: "Tournaments", href: "/admin/tournaments" },
    { icon: Users, label: "Users", href: "/admin/users" },
    { icon: FilePieChart, label: "Analytics", href: "/admin/analytics" },
  ],
}

function AppHeader() {
  const { setOpenMobile, isMobile } = useSidebar()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          className="cursor-default hover:bg-transparent data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
        >
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-white text-sidebar-primary-foreground">
            <Image
              src="/images/logo.png"
              alt="iRankHub Logo"
              width={20}
              height={20}
            />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold text-white">
              iRankHub
            </span>
          </div>
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-white hover:bg-white/10"
              onClick={(e) => {
                e.preventDefault()
                setOpenMobile(false)
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, signOut } = useAuth()

  if (!user) return null

  const items = sidebarItems[user.role as keyof typeof sidebarItems] || []

  const navItems = items.map(item => ({
    title: item.label,
    url: item.href,
    icon: item.icon,
    isActive: false,
  }))

  return (
    <Sidebar
      collapsible="icon"
      variant="sidebar"
      className="bg-primary border-r-0"
      {...props}
    >
      <SidebarHeader className="bg-primary">
        <AppHeader />
      </SidebarHeader>

      <SidebarContent className="bg-primary">
        <NavMain items={navItems} />
      </SidebarContent>

      <SidebarFooter className="bg-primary">
        <NavUser onSignOut={signOut} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}