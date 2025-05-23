"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import SchoolOnboardingForm from "@/components/onboarding/school-onboarding-form"
import AppLoader from "@/components/app-loader"

export default function SchoolOnboarding() {
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  const currentUser = useQuery(api.functions.users.getCurrentUser)

  useEffect(() => {
    if (currentUser === undefined) {
      return
    }

    if (currentUser === null) {
      router.push("/")
      return
    }

    if (currentUser.role !== "school_admin") {
      router.push(`/onboarding/${currentUser.role}`)
      return
    }

    if (currentUser.status === "active") {
      router.push("/dashboard/school")
      return
    }

    setIsLoading(false)
  }, [currentUser, router])

  if (isLoading) {
    return <AppLoader />
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
      <SchoolOnboardingForm userId={currentUser?._id} />
    </div>
  )
}