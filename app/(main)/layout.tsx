"use client"

import { useRequireAuth, useOfflineSync } from "@/hooks/useAuth"
import AppLoader from "@/components/app-loader"
import { DashboardSidebar, MobileBottomNavigation} from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/header"
import { useEffect, useState } from "react"

export default function DashboardLayout({
                                          children,
                                        }: {
  children: React.ReactNode
}) {
  const auth = useRequireAuth()
  const { isOfflineValid } = useOfflineSync()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 500)

    return () => clearTimeout(timer)
  }, [])

  if (auth.isLoading || isLoading) {
    return <AppLoader />
  }

  if (!auth.isAuthenticated && !isOfflineValid) {
    return <AppLoader />
  }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 dark:bg-gray-900 p-4 lg:p-6 pb-20 lg:pb-6">
          {children}
        </main>
      </div>
      <MobileBottomNavigation />
    </div>
  )
}