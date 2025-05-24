"use client"

import UserRoleSelector from "@/components/auth/user-role-selector"

export default function Home() {
  return (
    <div className="flex items-center justify-center min-h-screen w-full p-4 bg-gradient-to-bl from-orange-400 via-orange-50 to-orange-50">
      <UserRoleSelector />
    </div>
  )
}