"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import {
  Download,
  Users,
  AlertCircle,
} from "lucide-react"
import { toast } from "sonner"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useAuth } from "@/hooks/use-auth"
import { formatDistanceToNow } from "date-fns"

interface ExportUsersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userType?: "admin" | "school"
}

export function ExportUsersDialog({ open, onOpenChange, userType = "admin" }: ExportUsersDialogProps) {
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [exportFormat, setExportFormat] = useState<"csv" | "json">("csv")
  const [includeFields, setIncludeFields] = useState({
    basic: true,
    contact: true,
    school: userType === "admin",
    security: false,
    timestamps: true,
    status: true
  })
  const [filters, setFilters] = useState({
    roles: [] as string[],
    status: [] as string[],
    verified: "all" as "all" | "verified" | "pending",
    grade: "all" as string
  })

  const { token } = useAuth()

  const exportAdminUsers = useMutation(api.functions.admin.users.exportUsers)
  const exportSchoolStudents = useMutation(api.functions.school.students.exportStudents)

  const adminUsersPreview = useQuery(
    api.functions.admin.users.getUsers,
    userType === "admin" && token ? {
      admin_token: token,
      search: "",
      role: filters.roles.length === 1 ? filters.roles[0] as any : undefined,
      status: filters.status.length === 1 ? filters.status[0] as any : undefined,
      verified: filters.verified !== "all" ? filters.verified as any : undefined,
      page: 1,
      limit: 5,
    } : "skip"
  )

  const schoolStudentsPreview = useQuery(
    api.functions.school.students.getStudents,
    userType === "school" && token ? {
      school_admin_token: token,
      search: "",
      grade: filters.grade !== "all" ? filters.grade : undefined,
      status: filters.status.length === 1 ? filters.status[0] as any : undefined,
      verified: filters.verified !== "all" ? filters.verified as any : undefined,
      page: 1,
      limit: 5,
    } : "skip"
  )

  const usersPreview = userType === "admin" ? adminUsersPreview : schoolStudentsPreview

  const handleFieldToggle = (field: keyof typeof includeFields) => {
    setIncludeFields(prev => ({
      ...prev,
      [field]: !prev[field]
    }))
  }

  const handleRoleToggle = (role: string) => {
    setFilters(prev => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter(r => r !== role)
        : [...prev.roles, role]
    }))
  }

  const handleStatusToggle = (status: string) => {
    setFilters(prev => ({
      ...prev,
      status: prev.status.includes(status)
        ? prev.status.filter(s => s !== status)
        : [...prev.status, status]
    }))
  }

  const getAllUsers = async () => {
    if (!token) return []

    let allUsers: any[] = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      try {
        const response = userType === "admin"
          ? await exportAdminUsers({
            admin_token: token,
            page,
            limit: 100,
            role: filters.roles.length === 1 ? filters.roles[0] as any : undefined,
            status: filters.status.length === 1 ? filters.status[0] as any : undefined,
            verified: filters.verified !== "all" ? filters.verified as any : undefined,
          })
          : await exportSchoolStudents({
            school_admin_token: token,
            page,
            limit: 100,
            grade: filters.grade !== "all" ? filters.grade : undefined,
            status: filters.status.length === 1 ? filters.status[0] as any : undefined,
            verified: filters.verified !== "all" ? filters.verified as any : undefined,
          })

        const responseUsers = userType === "admin"
          ? (response as { users: any[] }).users
          : (response as { students: any[] }).students;

        allUsers = [...allUsers, ...responseUsers];
        hasMore = response.hasMore;
        page++;

        setProgress(Math.min((allUsers.length / (response.totalCount || allUsers.length)) * 100, 100))

        await new Promise(resolve => setTimeout(resolve, 100))

      } catch (error) {
        console.error('Error fetching users:', error)
        break
      }
    }

    return allUsers
  }

  const formatUserData = (users: any[]) => {
    return users.map(user => {
      const formattedUser: any = {}

      if (includeFields.basic) {
        formattedUser.name = user.name
        formattedUser.gender = user.gender || ''
        if (userType === "admin") {
          formattedUser.role = user.role
        }
        formattedUser.grade = user.grade || ''
        if (userType === "admin") {
          formattedUser.position = user.position || ''
          formattedUser.national_id = user.national_id || ''
          formattedUser.high_school_attended = user.high_school_attended || ''
        }
      }

      if (includeFields.contact) {
        formattedUser.email = user.email
        formattedUser.phone = user.phone || ''
      }

      if (includeFields.school && user.school && userType === "admin") {
        formattedUser.school_name = user.school.name
        formattedUser.school_type = user.school.type
      }

      if (includeFields.status) {
        formattedUser.status = user.status
        formattedUser.verified = user.verified ? 'Yes' : 'No'
        if (userType === "school") {
          formattedUser.has_debated = user.has_debated ? 'Yes' : 'No'
        }
      }

      if (includeFields.timestamps) {
        formattedUser.created_at = user.created_at ? new Date(user.created_at).toISOString() : ''
        formattedUser.last_login = user.last_login_at
          ? formatDistanceToNow(new Date(user.last_login_at), { addSuffix: true })
          : 'Never'
      }

      return formattedUser
    })
  }

  const exportToCSV = (data: any[]) => {
    if (data.length === 0) {
      toast.error("No data to export")
      return
    }

    const headers = Object.keys(data[0])
    const csvContent = [
      headers.join(','),
      ...data.map(row =>
        headers.map(header => {
          const value = row[header]
          return typeof value === 'string' && (value.includes(',') || value.includes('"'))
            ? `"${value.replace(/"/g, '""')}"`
            : value
        }).join(',')
      )
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `${userType === "school" ? "students" : "users"}_export_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const exportToJSON = (data: any[]) => {
    const jsonContent = JSON.stringify({
      exported_at: new Date().toISOString(),
      total_users: data.length,
      filters: filters,
      included_fields: includeFields,
      [userType === "school" ? "students" : "users"]: data
    }, null, 2)

    const blob = new Blob([jsonContent], { type: 'application/json' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `${userType === "school" ? "students" : "users"}_export_${new Date().toISOString().split('T')[0]}.json`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleExport = async () => {
    setLoading(true)
    setProgress(0)

    try {
      const users = await getAllUsers()
      const formattedData = formatUserData(users)

      if (exportFormat === 'csv') {
        exportToCSV(formattedData)
      } else {
        exportToJSON(formattedData)
      }

      toast.success(`Exported ${formattedData.length} ${userType === "school" ? "students" : "users"} successfully`)
      onOpenChange(false)

    } catch (error: any) {
      toast.error(error.message?.split("Uncaught Error:")[1]?.split(/\.|Called by client/)[0]?.trim() || `Failed to export ${userType === "school" ? "students" : "users"}`)
    } finally {
      setLoading(false)
      setProgress(0)
    }
  }

  const previewCount = usersPreview?.totalCount || 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export {userType === "school" ? "Students" : "Users"}</DialogTitle>
          <DialogDescription>
            Export {userType === "school" ? "student" : "user"} data in CSV or JSON format. Choose which fields to
            include and apply filters.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-3">
            <Label className="text-base font-medium">Export Format</Label>
            <RadioGroup value={exportFormat} onValueChange={(value) => setExportFormat(value as any)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="csv" id="csv" />
                <Label htmlFor="csv">CSV (Excel compatible)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="json" id="json" />
                <Label htmlFor="json">JSON (with metadata)</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-3">
            <Label className="text-base font-medium">Fields to Include</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="basic"
                  checked={includeFields.basic}
                  onCheckedChange={() => handleFieldToggle('basic')}
                />
                <Label htmlFor="basic">
                  Basic Info (Name, {userType === "school" ? "Grade" : "Role"}, etc.)
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="contact"
                  checked={includeFields.contact}
                  onCheckedChange={() => handleFieldToggle('contact')}
                />
                <Label htmlFor="contact">Contact Info (Email, Phone)</Label>
              </div>

              {userType === "admin" && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="school"
                    checked={includeFields.school}
                    onCheckedChange={() => handleFieldToggle('school')}
                  />
                  <Label htmlFor="school">School Information</Label>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="status"
                  checked={includeFields.status}
                  onCheckedChange={() => handleFieldToggle('status')}
                />
                <Label htmlFor="status">
                  Status & {userType === "school" ? "Debate Activity" : "Verification"}
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="timestamps"
                  checked={includeFields.timestamps}
                  onCheckedChange={() => handleFieldToggle('timestamps')}
                />
                <Label htmlFor="timestamps">Timestamps</Label>
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Security information (passwords, security questions) is never included in exports for security reasons.
              </AlertDescription>
            </Alert>
          </div>

          <div className="space-y-4">
            <Label className="text-base font-medium">Filters</Label>

            <div className="space-y-3">
              {userType === "admin" && (
                <div>
                  <Label className="text-sm font-medium">User Roles</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {['student', 'school_admin', 'volunteer', 'admin'].map(role => (
                      <div key={role} className="flex items-center space-x-2">
                        <Checkbox
                          id={`role-${role}`}
                          checked={filters.roles.includes(role)}
                          onCheckedChange={() => handleRoleToggle(role)}
                        />
                        <Label htmlFor={`role-${role}`} className="capitalize">
                          {role.replace('_', ' ')}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label className="text-sm font-medium">User Status</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {['active', 'inactive', 'banned'].map(status => (
                    <div key={status} className="flex items-center space-x-2">
                      <Checkbox
                        id={`status-${status}`}
                        checked={filters.status.includes(status)}
                        onCheckedChange={() => handleStatusToggle(status)}
                      />
                      <Label htmlFor={`status-${status}`} className="capitalize">
                        {status}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Verification Status</Label>
                <RadioGroup
                  value={filters.verified}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, verified: value as any }))}
                  className="flex gap-4 mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="all" id="all-verification" />
                    <Label htmlFor="all-verification">All</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="verified" id="verified-only" />
                    <Label htmlFor="verified-only">Verified Only</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="pending" id="pending-only" />
                    <Label htmlFor="pending-only">Pending Only</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          </div>

          <Alert>
            <Users className="h-4 w-4" />
            <AlertDescription>
              {previewCount > 0 ? (
                `Ready to export ${previewCount} ${userType === "school" ? "students" : "users"} with current filters.`
              ) : (
                `No ${userType === "school" ? "students" : "users"} match the current filters.`
              )}
            </AlertDescription>
          </Alert>

          {loading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Exporting {userType === "school" ? "students" : "users"}...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={loading || previewCount === 0}
          >
            {loading ? (
              <>
                <Download className="mr-2 h-4 w-4 animate-pulse" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export {previewCount} {userType === "school" ? "Students" : "Users"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}