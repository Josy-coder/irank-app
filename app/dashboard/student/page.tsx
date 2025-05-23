"use client"

import { useAuth } from "@/hooks/useAuth"

export default function StudentDashboard() {
  const { user } = useAuth()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Welcome back, {user?.name}!
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Your student dashboard
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Upcoming Tournaments</h2>
          <p className="text-gray-600 dark:text-gray-400">No upcoming tournaments</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Recent Performance</h2>
          <p className="text-gray-600 dark:text-gray-400">No recent debates</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Team Status</h2>
          <p className="text-gray-600 dark:text-gray-400">Not assigned to a team</p>
        </div>
      </div>
    </div>
  )
}