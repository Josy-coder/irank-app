"use client"

import { useRequireAuth } from "@/hooks/use-auth"

export default function SchoolDashboardLayout({
                                                children,
                                              }: {
  children: React.ReactNode
}) {
  const auth = useRequireAuth("school_admin")

  if (!auth.isAuthenticated) {
    return <div>Unauthorized</div>;
  }


  return <>{children}</>
}