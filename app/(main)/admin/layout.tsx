"use client"

import { useRequireAuth } from "@/hooks/useAuth"
import AppLoader from "@/components/app-loader"

export default function AdminDashboardLayout({
                                               children,
                                             }: {
  children: React.ReactNode
}) {
  const auth = useRequireAuth("admin")

  if (auth.isLoading) {
    return <AppLoader />
  }

  return <>{children}</>
}