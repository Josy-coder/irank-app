"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import AppLoader from "@/components/app-loader"
import Image from "next/image"

export default function OnboardingLayout({
                                           children,
                                         }: {
  children: React.ReactNode
}) {
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  const currentUser = useQuery(api.functions.users.getCurrentUser)

  useEffect(() => {
    if (currentUser === undefined) {

      return
    }

    // If no user is found or not logged in, redirect to home
    if (currentUser === null) {
      router.push("/")
      return
    }

    if (currentUser.status === "active") {
      router.push(`/dashboard/${currentUser.role === 'school_admin' ? 'school' : currentUser.role}`)
      return
    }

    setIsLoading(false)
  }, [currentUser, router])

  if (isLoading) {
    return <AppLoader />
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">

      <header className="py-4 px-6 border-b bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto">
          <Image
            src="/images/logo.png"
            alt="iRankHub Logo"
            width={100}
            height={40}
            className="h-10 w-auto"
          />
        </div>
      </header>

      <main className="flex-1 py-12 px-6">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      <footer className="py-4 px-6 border-t bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto text-center text-sm text-gray-500 dark:text-gray-400">
          © {new Date().getFullYear()} iRankHub. All rights reserved.
        </div>
      </footer>
    </div>
  )
}