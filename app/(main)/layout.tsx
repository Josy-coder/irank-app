"use client"

import { useRequireAuth, useOfflineSync } from "@/hooks/use-auth"
import { useAuth } from "@/hooks/use-auth"
import { usePathname } from "next/navigation"
import Link from "next/link"
import AppLoader from "@/components/app-loader"
import { AppSidebar } from "@/components/navigation/app-sidebar"
import { SiteHeader } from "@/components/navigation/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AdvancedOfflineSheet} from "@/components/offline-banner"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import React from "react";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { NotificationPermissionBanner } from "@/components/notifications/permission-banner";

function generateBreadcrumbs(pathname: string, userRole: string) {
  const cleanPathname = pathname.split('?')[0]
  const segments = cleanPathname.split('/').filter(Boolean)
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
      let label = segment.charAt(0).toUpperCase() + segment.slice(1)

      if (segment.match(/^[a-f\d]{24}$/i) || segment.match(/^[0-9]+$/)) {
        const previousSegment = segments[index - 1]
        if (previousSegment) {
          label = `${previousSegment.charAt(0).toUpperCase() + previousSegment.slice(1)} Details`
        } else {
          label = 'Details'
        }
      }

      breadcrumbs.push({
        label,
        href: currentPath,
        isRole: false
      })
    }
  })

  if (breadcrumbs.length > 4) {
    return [
      breadcrumbs[0],
      {
        label: "...",
        href: "#",
        isRole: false
      },
      ...breadcrumbs.slice(-2)
    ]
  }

  return breadcrumbs
}

function getPageTitle(pathname: string) {
  const cleanPathname = pathname.split('?')[0]
  const segments = cleanPathname.split('/').filter(Boolean)
  const lastSegment = segments[segments.length - 1]

  if (!lastSegment) return 'Dashboard'

  if (lastSegment.match(/^[a-f\d]{24}$/i) || lastSegment.match(/^[0-9]+$/)) {
    const previousSegment = segments[segments.length - 2]
    if (previousSegment) {
      const titleMap: Record<string, string> = {
        'tournaments': 'Tournament Details',
        'users': 'User Details',
        'schools': 'School Details',
        'teams': 'Team Details',
        'students': 'Student Details',
      }
      return titleMap[previousSegment] || `${previousSegment.charAt(0).toUpperCase() + previousSegment.slice(1)} Details`
    }
  }

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
    'schools': 'Schools',
    'profile': 'Profile',
    'settings': 'Settings'
  }

  return titleMap[lastSegment] || lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1)
}

export default function DashboardLayout({
                                          children,
                                        }: {
  children: React.ReactNode
}) {
  const auth = useRequireAuth()
  const { isOfflineValid } = useOfflineSync()
  const { user } = useAuth()
  const pathname = usePathname()

  if (auth.isLoading) {
    return <AppLoader />
  }

  if (!auth.isAuthenticated && !isOfflineValid) {
    return <AppLoader />
  }

  const breadcrumbs = user ? generateBreadcrumbs(pathname, user.role) : []
  const pageTitle = getPageTitle(pathname)

  return (
    <>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col bg-muted max-w-full overflow-x-hidden">
            <div className="px-4 md:px-6 pt-2 pb-1">
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold text-primary">
                  {pageTitle}
                </h1>

                <Breadcrumb className="hidden md:flex">
                  <BreadcrumbList>
                    {breadcrumbs.map((crumb, index) => (
                      <div key={`${crumb.href}-${index}`} className="flex items-center">
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
            <main className="flex-1 overflow-y-auto px-4 md:px-6 ">
              <NotificationPermissionBanner />
              <AdvancedOfflineSheet />
              {children}
            </main>
          </div>
        </SidebarInset>
      </SidebarProvider>
      <InstallPrompt />
    </>
  )
}