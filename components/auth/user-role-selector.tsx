"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { School, User, Award } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

type UserRole = "student" | "school_admin" | "volunteer"

const UserRoleSelector = () => {
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null)
  const router = useRouter()

  const handleContinue = () => {
    if (selectedRole) {
      router.push(`/signin/${selectedRole}`)
    }
  }

  const roles = [
    {
      id: "student",
      title: "Student",
      description: "For debate team members",
      icon: <User className="h-4 w-4 md:h-8 md:w-8" />,
    },
    {
      id: "school_admin",
      title: "School",
      description: "For school administrators",
      icon: <School className="h-4 w-4 md:h-8 md:w-8" />,
    },
    {
      id: "volunteer",
      title: "Volunteer",
      description: "For judges and other volunteers",
      icon: <Award className="h-4 w-4 md:h-8 md:w-8" />,
    },
  ]

  return (
    <div className="flex flex-col items-center justify-center space-y-6 sm:space-y-4 w-full max-w-lg bg-transparent">
      <div>
        <Image
          src="/images/logo.png"
          alt="iRankHub Logo"
          width={80}
          height={80}
          priority
        />
      </div>

      <div className="text-center">
        <h1 className="text-lg sm:text-xl font-bold dark:text-foreground">Welcome to iRankHub</h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">Select your role to continue</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full">
        {roles.map((role) => (
          <motion.div
            key={role.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setSelectedRole(role.id as UserRole)}
            className="w-full"
          >
            <Card
              className={`cursor-pointer transition-all h-full dark:bg-gray-500/10 ${
                selectedRole === role.id
                  ? "border-primary bg-primary/5"
                  : "hover:border-primary/50"
              }`}
            >
              <CardContent className="flex flex-col items-center justify-center p-2 text-center h-full">
                <div
                  className={`p-1 rounded-full mb-1 ${
                    selectedRole === role.id
                      ? "bg-primary text-white"
                      : "bg-secondary"
                  }`}
                >
                  {role.icon}
                </div>
                <h3 className="font-medium text-sm mb-1 dark:text-foreground">{role.title}</h3>
                <p className="hidden md:block text-xs sm:text-sm text-muted-foreground">{role.description}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="flex flex-col w-full space-y-3 mt-2 ">
        <Button
          onClick={handleContinue}
          disabled={!selectedRole}
          size="default"
          className="w-full bg-primary"
        >
          Continue
        </Button>

        <div className="text-center text-xs sm:text-sm">
          <Link href="/signin/admin" className="text-primary hover:underline">
            Sign in as Admin
          </Link>
        </div>
      </div>
    </div>
  )
}

export default UserRoleSelector