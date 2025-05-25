"use client"

import { useRequireAuth } from "@/hooks/useAuth"

export default function StudentDashboardLayout({
                                                 children,
                                               }: {
  children: React.ReactNode
}) {
  const auth = useRequireAuth("student")

  if (!auth.isAuthenticated) {
    return <div>Unauthorized</div>;
  }


  return <>{children}</>
}