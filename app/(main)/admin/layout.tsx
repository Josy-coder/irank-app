"use client"

import { useRequireAuth } from "@/hooks/useAuth"

export default function AdminDashboardLayout({
                                               children,
                                             }: {
  children: React.ReactNode
}) {
  const auth = useRequireAuth("admin")

  if (!auth.isAuthenticated) {
    return <div>Unauthorized</div>;
  }


  return <>{children}</>
}