"use client"

import { useRequireAuth } from "@/hooks/use-auth";

export default function VolunteerDashboardLayout({
                                                   children,
                                                 }: {
  children: React.ReactNode
}) {
  const auth = useRequireAuth("volunteer")

  if (!auth.isAuthenticated) {
    return <div>Unauthorized</div>;
  }

  return <>{children}</>
}