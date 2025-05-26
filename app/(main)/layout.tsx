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
      <div className={`hidden md:flex flex-1 flex-col overflow-hidden transition-all duration-300 ${
        isCollapsed ? 'ml-16' : 'ml-64'
      } h-screen`}>
        <div className="h-32" />
        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          {children}
        </main>
      </div>
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