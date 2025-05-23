"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import StudentOnboardingForm from "@/components/onboarding/student-onboarding-form"
import AppLoader from "@/components/app-loader"

export default function StudentOnboarding() {
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

    if (currentUser.role !== "student") {
      router.push(`/onboarding/${currentUser.role}`)
      return
    }

    if (currentUser.status === "active") {
      router.push("/dashboard/student")
      return
    }

    setIsLoading(false)
  }, [currentUser, router])

  if (isLoading) {
    return <AppLoader />
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
      <StudentOnboardingForm userId={currentUser?._id} />
    </div>
  )
}