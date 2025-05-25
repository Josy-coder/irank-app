"use client"

import { useAuth } from "@/hooks/useAuth"

export default function VolunteerDashboard() {
  const { user } = useAuth()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Judge Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Welcome, {user?.name}
        </p>
      </div>

      {/* Volunteer dashboard content will go here */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Upcoming Assignments</h2>
          <p className="text-gray-600 dark:text-gray-400">No upcoming judging assignments</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Judging History</h2>
          <p className="text-gray-600 dark:text-gray-400">No judging history</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Available Tournaments</h2>
          <p className="text-gray-600 dark:text-gray-400">No tournaments available</p>
        </div>
      </div>
    </div>
  )
}