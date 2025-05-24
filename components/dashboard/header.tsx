import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import Image from "next/image";

export function DashboardHeader() {
  const { user } = useAuth()
  const [isOffline] = useState(false)

  if (!user) return null

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 lg:ml-0">
      <div className="px-4 lg:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3 lg:hidden">
          <Image
            src="/images/logo.png"
            alt="iRankHub Logo"
            width={28}
            height={28}
          />
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              Dashboard
            </h1>
          </div>
        </div>

        <div className="hidden lg:block">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            Dashboard
          </h1>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            {isOffline ? (
              <div className="flex items-center space-x-1 text-xs text-amber-600 dark:text-amber-400">
                <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                <span className="hidden sm:inline">Offline</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1 text-xs text-green-600 dark:text-green-400">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="hidden sm:inline">Online</span>
              </div>
            )}
          </div>

          <div className="hidden lg:flex items-center space-x-2">
            <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="hidden xl:block">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 capitalize">
                {user.role.replace('_', ' ')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}