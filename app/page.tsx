"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import UserRoleSelector from "@/components/auth/user-role-selector"

export default function Home() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && user) {
      const dashboardPaths = {
        student: "/student/dashboard",
        school_admin: "school/dashboard",
        volunteer: "volunteer/dashboard",
        admin: "admin/dashboard"
      }

      const dashboardPath = dashboardPaths[user.role as keyof typeof dashboardPaths]
      if (dashboardPath) {
        router.push(dashboardPath)
      }
    }
  }, [user, isLoading, router])

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen w-full p-4 bg-gradient-to-bl from-orange-400 via-orange-50 to-orange-50">
        <UserRoleSelector />
      </div>
    )
  }
}