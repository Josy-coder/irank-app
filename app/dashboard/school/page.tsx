"use client"

import { useAuth } from "@/hooks/useAuth"

export default function SchoolDashboard() {
  const { user } = useAuth()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          School Administration
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Welcome, {user?.name} from {user?.school?.name}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Students</h2>
          <p className="text-gray-600 dark:text-gray-400">Manage your students</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Teams</h2>
          <p className="text-gray-600 dark:text-gray-400">Manage debate teams</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Tournaments</h2>
          <p className="text-gray-600 dark:text-gray-400">Tournament registrations</p>
        </div>
      </div>
    </div>
  )
}