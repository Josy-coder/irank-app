"use client"

import { useRequireAuth } from "@/hooks/useAuth"
import AppLoader from "@/components/app-loader"

export default function SchoolDashboardLayout({
                                                children,
                                              }: {
  children: React.ReactNode
}) {
  const auth = useRequireAuth("school_admin")

  if (auth.isLoading) {
    return <AppLoader />
  }

  return <>{children}</>
}