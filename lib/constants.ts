import { Shield, GraduationCap, Building, UserCheck, Users } from "lucide-react"

export const USER_ROLE_OPTIONS = [
  { value: "student", label: "Students", icon: GraduationCap },
  { value: "school_admin", label: "School Admins", icon: Building },
  { value: "volunteer", label: "Volunteers", icon: UserCheck },
  { value: "admin", label: "Admins", icon: Shield },
]

export const USER_STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "banned", label: "Banned" },
]

export const USER_VERIFICATION_OPTIONS = [
  { value: "verified", label: "Verified" },
  { value: "pending", label: "Pending" },
]

export function getRoleIcon(role: string) {
  switch (role) {
    case "admin": return Shield
    case "student": return GraduationCap
    case "school_admin": return Building
    case "volunteer": return UserCheck
    default: return Users
  }
}

export function getRoleColor(role: string) {
  switch (role) {
    case "admin": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
    case "student": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100"
    case "school_admin": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100"
    case "volunteer": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
    default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100"
  }
}

export function getStatusColor(status: string) {
  switch (status) {
    case "active": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
    case "inactive": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100"
    case "banned": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
    default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100"
  }
}