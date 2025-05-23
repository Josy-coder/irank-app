"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Undo2 } from "lucide-react"
import Image from "next/image"
import { Inter } from "next/font/google"
import { cn } from "@/lib/utils"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"

const inter = Inter({ subsets: ['latin'] })

export default function NotFound() {
  const router = useRouter()
  const currentUser = useQuery(api.functions.users.getCurrentUser)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleNavigateBack = () => {
    if (currentUser) {
      const dashboardPath = `/dashboard/${currentUser.role === 'school_admin' ? 'school' : currentUser.role}`
      router.push(dashboardPath)
    } else {
      router.push("/")
    }
  }

  if (!mounted) {
    return null
  }

  return (
    <div className="bg-background min-h-screen grid place-content-center">
      <h1 className={cn("text-lg sm:text-2xl md:text-4xl text-center font-bold mb-2 text-foreground ", inter.className)}>Oops!</h1>
      <h2 className={cn("text-base sm:text-xl md:text-3xl mb-8 text-center font-semibold text-foreground ", inter.className)}>Welcome to 70&apos;s</h2>
      <div className="w-[600px] h-[400px] relative">
        <div className="w-full h-full z-0 relative">
          <Image
            src="/images/dots-and-stars.png"
            alt="Background pattern"
            layout="fill"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="absolute h-full inset-1 grid place-content-center">
          <div className="w-80 h-80 relative">
            <Image
              src="/images/peeps.png"
              alt="70's themed people"
              layout="fill"
              objectFit="contain"
            />
          </div>
        </div>
      </div>
      <div className="mx-auto mt-4 flex items-center">
        <Button
          onClick={handleNavigateBack}
          className="flex items-center justify-center"
        >
          <Undo2 size={20} className="mr-2" />
          Back 2020s
        </Button>
      </div>
    </div>
  )
}