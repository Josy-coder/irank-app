"use client"

import { useRequireAuth } from "@/hooks/useAuth"
import AppLoader from "@/components/app-loader"

export default function VolunteerDashboardLayout({
                                                   children,
                                                 }: {
  children: React.ReactNode
}) {
  const auth = useRequireAuth("volunteer")

  if (auth.isLoading) {
    return <AppLoader />
  }

  return <>{children}</>
}