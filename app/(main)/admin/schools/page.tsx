"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Checkbox } from "@/components/ui/checkbox"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Search,
  Plus,
  Download,
  Upload,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Building,
  Mail,
  Phone,
  MapPin,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Shield,
} from "lucide-react"
import { motion } from "framer-motion"
import { useAuth } from "@/hooks/useAuth"
import { useDebounce } from "@/hooks/use-debounce"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { Id } from "@/convex/_generated/dataModel"

const SCHOOL_TYPES = [
  { value: "all", label: "All Types" },
  { value: "Private", label: "Private" },
  { value: "Public", label: "Public" },
  { value: "Government Aided", label: "Government Aided" },
  { value: "International", label: "International" },
]

const SCHOOL_STATUSES = [
  { value: "all", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "banned", label: "Banned" },
]

const VERIFICATION_STATUSES = [
  { value: "all", label: "All" },
  { value: "verified", label: "Verified" },
  { value: "pending", label: "Pending" },
]

function SchoolTableSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-4 p-4">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-4 w-20 ml-auto" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-8 w-8" />
        </div>
      ))}
    </div>
  )
}

interface School {
  _id: Id<"schools">
  name: string
  type: "Private" | "Public" | "Government Aided" | "International"
  country: string
  province?: string
  district?: string
  sector?: string
  contact_name: string
  contact_email: string
  contact_phone?: string
  logo_url?: Id<"_storage">
  status: "active" | "inactive" | "banned"
  verified: boolean
  created_at: number
  creator?: {
    id: Id<"users">
    name: string
    email: string
  }
  student_count?: number
  team_count?: number
}

function getSchoolTypeColor(type: string) {
  switch (type) {
    case "Private":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100"
    case "Public":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
    case "Government Aided":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100"
    case "International":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100"
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100"
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
    case "inactive":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100"
    case "banned":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100"
  }
}

export default function SchoolsManagementPage() {
  const { token } = useAuth()
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [verificationFilter, setVerificationFilter] = useState("all")
  const [selectedSchools, setSelectedSchools] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [schoolToDelete, setSchoolToDelete] = useState<string | null>(null)

  const debouncedSearch = useDebounce(searchTerm, 300)

  const schoolsData = useQuery(
    api.functions.schools.getSchoolsForAdmin,
    token ? {
      admin_token: token,
      search: debouncedSearch,
      type: typeFilter as any,
      status: statusFilter as any,
      verified: verificationFilter === "all" ? undefined : verificationFilter === "verified",
      page,
      limit: 20,
    } : "skip"
  )

  const updateSchool = useMutation(api.functions.schools.updateSchool)
  const deleteSchool = useMutation(api.functions.schools.deleteSchool)
  const approveSchool = useMutation(api.functions.schools.approveSchool)

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, typeFilter, statusFilter, verificationFilter])

  const handleSelectSchool = (schoolId: string, checked: boolean) => {
    const newSelected = new Set(selectedSchools)
    if (checked) {
      newSelected.add(schoolId)
    } else {
      newSelected.delete(schoolId)
    }
    setSelectedSchools(newSelected)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked && schoolsData?.schools) {
      setSelectedSchools(new Set(schoolsData.schools.map(s => s._id)))
    } else {
      setSelectedSchools(new Set())
    }
  }

  const handleStatusChange = async (schoolId: Id<"schools">, status: "active" | "inactive" | "banned") => {
    try {
      await updateSchool({
        token: token!,
        id: schoolId,
        status,
      })
      toast.success("School status updated successfully")
    } catch (error: any) {
      toast.error(error.message || "Failed to update school status")
    }
  }

  const handleApproveSchool = async (schoolId: Id<"schools">) => {
    try {
      await approveSchool({
        admin_token: token!,
        id: schoolId,
      })
      toast.success("School approved successfully")
    } catch (error: any) {
      toast.error(error.message || "Failed to approve school")
    }
  }

  const handleDeleteSchool = async () => {
    if (!schoolToDelete) return

    try {
      await deleteSchool({
        admin_token: token!,
        id: schoolToDelete as Id<"schools">,
      })
      toast.success("School deleted successfully")
      setShowDeleteDialog(false)
      setSchoolToDelete(null)
    } catch (error: any) {
      toast.error(error.message || "Failed to delete school")
    }
  }

  const isLoading = schoolsData === undefined
  const schools = schoolsData?.schools || []
  const totalCount = schoolsData?.totalCount || 0
  const hasMore = schoolsData?.hasMore || false

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Schools Management</h1>
            <p className="text-muted-foreground">
              Manage schools and their information
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button size="sm">
              <Building className="h-4 w-4 mr-2" />
              Add School
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-1 items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search schools..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {SCHOOL_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {SCHOOL_STATUSES.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={verificationFilter} onValueChange={setVerificationFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Verification" />
                  </SelectTrigger>
                  <SelectContent>
                    {VERIFICATION_STATUSES.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {isLoading ? "Loading..." : `${totalCount} schools total`}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1 || isLoading}
                >
                  Previous
                </Button>
                <span>Page {page}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={!hasMore || isLoading}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Schools Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <SchoolTableSkeleton />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedSchools.size === schools.length && schools.length > 0}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>School</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Stats</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Verified</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schools.map((school) => (
                      <TableRow key={school._id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedSchools.has(school._id)}
                            onCheckedChange={(checked) =>
                              handleSelectSchool(school._id, checked as boolean)
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={undefined} alt={school.name} />
                              <AvatarFallback className="text-xs">
                                {school.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{school.name}</div>
                              {school.creator && (
                                <div className="text-sm text-muted-foreground flex items-center gap-1">
                                  <Shield className="h-3 w-3" />
                                  {school.creator.name}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={getSchoolTypeColor(school.type)}>
                            {school.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">
                              {[school.district, school.province, school.country]
                                .filter(Boolean)
                                .join(", ")
                              }
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="text-sm font-medium">{school.contact_name}</div>
                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {school.contact_email}
                            </div>
                            {school.contact_phone && (
                              <div className="text-sm text-muted-foreground flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {school.contact_phone}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm space-y-1">
                            <div className="flex items-center gap-1">
                              <Users className="h-3 w-3 text-muted-foreground" />
                              <span>{school.student_count || 0} students</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Building className="h-3 w-3 text-muted-foreground" />
                              <span>{school.team_count || 0} teams</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={school.status}
                            onValueChange={(value: "active" | "inactive" | "banned") =>
                              handleStatusChange(school._id, value)
                            }
                          >
                            <SelectTrigger className="w-28 h-8">
                              <SelectValue>
                                <Badge variant="secondary" className={getStatusColor(school.status)}>
                                  {school.status}
                                </Badge>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="inactive">Inactive</SelectItem>
                              <SelectItem value="banned">Banned</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {school.verified ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleApproveSchool(school._id)}
                              className="h-8 px-2 text-orange-600 hover:text-orange-700"
                            >
                              <Clock className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit School
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Users className="h-4 w-4 mr-2" />
                                View Students
                              </DropdownMenuItem>
                              {!school.verified && (
                                <DropdownMenuItem
                                  onClick={() => handleApproveSchool(school._id)}
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Approve School
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => {
                                  setSchoolToDelete(school._id)
                                  setShowDeleteDialog(true)
                                }}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete School
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {schools.length === 0 && !isLoading && (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Building className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No schools found</h3>
                    <p className="text-muted-foreground text-center max-w-sm">
                      {searchTerm || typeFilter !== "all" || statusFilter !== "all" || verificationFilter !== "all"
                        ? "Try adjusting your search criteria or filters"
                        : "Get started by adding your first school to the platform"
                      }
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Delete School Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete School</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this school? This action cannot be undone and will permanently remove the
              school and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSchool}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete School
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}