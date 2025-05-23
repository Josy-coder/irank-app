"use client"

import { useRequireAuth } from "@/hooks/useAuth"
import AppLoader from "@/components/app-loader"

export default function StudentDashboardLayout({
                                                 children,
                                               }: {
  children: React.ReactNode
}) {
  const auth = useRequireAuth("student")

  if (auth.isLoading) {
    return <AppLoader />
  }

  return <>{children}</>
}