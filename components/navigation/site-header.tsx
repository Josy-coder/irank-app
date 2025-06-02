"use client"

import { useAuth } from "@/hooks/useAuth"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { Bell, User, Settings, LogOut, ChevronDown } from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function SiteHeader() {
  const { user, signOut } = useAuth()
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const getUrl = useMutation(api.files.getUrl)

  useEffect(() => {
    async function fetchImageUrl() {
      if (user?.profile_image) {
        try {
          const url = await getUrl({ storageId: user.profile_image as Id<"_storage"> })
          setImageUrl(url)
        } catch (error) {
          console.error("Failed to fetch profile image URL:", error)
        }
      }
    }

    fetchImageUrl()
  }, [user?.profile_image, getUrl])

  if (!user) return null

  return (
    <header className="sticky top-0 z-50 h-16 border-b border-gray-200 dark:border-gray-700 backdrop-blur-md bg-white/50 dark:bg-gray-900/60 supports-[backdrop-filter]:bg-white/50">
      <div className="flex h-full items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="hidden md:block mr-2 h-4" />
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-8 h-8 bg-white border border-gray-200 dark:border-gray-700 rounded-full flex items-center justify-center">
              <Bell className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="absolute -top-1 -right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
              <span className="text-xs text-white">9+</span>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex items-center gap-2 hover:bg-gray-200 dark:hover:bg-gray-700 px-2 py-6 rounded-md"
              >
                <div className="hidden lg:flex lg:flex-col lg:items-end">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {user.role === 'school_admin' ? 'School Admin' : user.role}
                  </p>
                </div>
                <Avatar className="w-8 h-8">
                  {user.profile_image ? (
                    <AvatarImage src={imageUrl || ""} alt={user.name} />
                  ) : (
                    <AvatarFallback className="bg-primary text-white">
                      {user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  )}
                </Avatar>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div>
                  <p className="font-medium">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={user.role === "school_admin" ? "/school/profile" : `/${user.role}/profile`}>
                  <div className="flex items-center">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </div>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={user.role === "school_admin" ? "/school/settings" : `/${user.role}/settings`}>
                  <div className="flex items-center">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </div>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>

  )
}