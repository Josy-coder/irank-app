"use client"

import { useRequireAuth, useOfflineSync } from "@/hooks/useAuth"
import AppLoader from "@/components/app-loader"
import { DashboardNavigation, useNavigation } from "@/components/dashboard/navigation"
import { useAuth } from "@/hooks/useAuth"
import { usePathname } from "next/navigation"
import Link from "next/link"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { AdvancedOfflineBanner } from "@/components/offline-banner";

function generateBreadcrumbs(pathname: string, userRole: string) {
  // Remove query parameters if any
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
      // Smart label generation
      let label = segment.charAt(0).toUpperCase() + segment.slice(1)

      // Handle special cases and IDs
      if (segment.match(/^[a-f\d]{24}$/i) || segment.match(/^[0-9]+$/)) {
        // This looks like an ID (MongoDB ObjectId or numeric ID)
        // Get the previous segment to determine context
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

  // Limit breadcrumbs to prevent breaking - show only last 3 plus role
  if (breadcrumbs.length > 4) {
    return [
      breadcrumbs[0], // Keep role
      {
        label: "...",
        href: "#",
        isRole: false
      },
      ...breadcrumbs.slice(-2) // Keep last 2
    ]
  }

  return breadcrumbs
}

function getPageTitle(pathname: string) {
  // Remove query parameters if any
  const cleanPathname = pathname.split('?')[0]
  const segments = cleanPathname.split('/').filter(Boolean)
  const lastSegment = segments[segments.length - 1]

  if (!lastSegment) return 'Dashboard'

  // Check if last segment is an ID
  if (lastSegment.match(/^[a-f\d]{24}$/i) || lastSegment.match(/^[0-9]+$/)) {
    // Use the second-to-last segment for title
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

  if (auth.isLoading) {
    return <AppLoader />
  }

  if (!auth.isAuthenticated && !isOfflineValid) {
    return <AppLoader />
  }

  return (
    <>
      <AdvancedOfflineBanner />
      <DashboardNavigation />
      <DashboardContent>{children}</DashboardContent>
    </>
  )
}

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { isCollapsed, contextualNav } = useNavigation()
  const { user } = useAuth()
  const pathname = usePathname()

  const breadcrumbs = user ? generateBreadcrumbs(pathname, user.role) : []
  const pageTitle = getPageTitle(pathname)

  return (
    <>
      {/* Desktop Layout - Fixed margin with proper CSS */}
      <div
        className={`hidden md:flex flex-1 bg-primary-foreground flex-col overflow-hidden transition-all duration-300 h-screen ${
          isCollapsed ? 'ml-16' : 'ml-64'
        }`}
      >
        <div className="h-32 flex-shrink-0" />
        <main className="flex-1 overflow-x-hidden overflow-y-auto px-6 pb-6">
          {children}
        </main>
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden fixed inset-0 flex flex-col">
        <div className={`flex-shrink-0 ${contextualNav ? 'h-24' : 'h-16'}`} />

        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          <div className="px-4 py-3 bg-white">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-semibold text-primary">
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
                          <BreadcrumbPage className="text-primary font-medium text-sm">
                            {crumb.label}
                          </BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink asChild>
                            <Link href={crumb.href} className="text-gray-600 hover:text-primary text-sm">
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

          <div className="p-4">
            {children}
          </div>
        </main>

        {!contextualNav && <div className="flex-shrink-0 h-16" />}
      </div>
    </>
  )
}