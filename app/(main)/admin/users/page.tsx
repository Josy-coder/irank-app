"use client"

import React, { useState, useEffect, useMemo } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Download,
  Upload,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  UserPlus,
  Mail,
  Phone,
  Building,
  CheckCircle,
  XCircle,
  Users,
  ChevronLeft, ChevronRight
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth"
import { useDebounce } from "@/hooks/use-debounce"
import { DataToolbar } from "@/components/shared/data-toolbar"
import { MultiSelectFilter } from "@/components/ui/multi-select-filter"
import {
  USER_ROLE_OPTIONS,
  USER_STATUS_OPTIONS,
  USER_VERIFICATION_OPTIONS,
  getRoleIcon,
  getRoleColor,
  getStatusColor
} from "@/lib/constants"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { Id } from "@/convex/_generated/dataModel"
import { CardLayoutWithToolbar } from "@/components/shared/card-layout-with-toolbar";

function UserTableSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-4 p-4">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-8" />
        </div>
      ))}
    </div>
  )
}

export default function UsersPage() {
  const { token, user } = useAuth()
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [verificationFilter, setVerificationFilter] = useState<string[]>([])
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [userToDelete, setUserToDelete] = useState<string | null>(null)
  const [showBulkDialog, setShowBulkDialog] = useState(false)
  const [bulkAction, setBulkAction] = useState<string>("")

  const debouncedSearch = useDebounce(searchTerm, 300)

  // Query users data
  const usersData = useQuery(
    api.functions.admin.users.getUsers,
    token ? {
      admin_token: token,
      search: debouncedSearch,
      role: roleFilter.length === 1 ? roleFilter[0] as any : undefined,
      status: statusFilter.length === 1 ? statusFilter[0] as any : undefined,
      verified: verificationFilter.length === 1 ? verificationFilter[0] as any : undefined,
      page,
      limit: 20,
    } : "skip"
  )

  // Mutations
  const updateUserStatus = useMutation(api.functions.admin.users.updateUserStatus)
  const verifyUser = useMutation(api.functions.admin.users.verifyUser)
  const deleteUser = useMutation(api.functions.admin.users.deleteUser)
  const bulkUpdateUsers = useMutation(api.functions.admin.users.bulkUpdateUsers)

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, roleFilter, statusFilter, verificationFilter])

  // Filter users based on multi-select filters
  const filteredUsers = useMemo(() => {
    if (!usersData?.users) return []

    return usersData.users.filter(user => {
      // Role filter
      if (roleFilter.length > 0 && !roleFilter.includes(user.role)) {
        return false
      }

      // Status filter
      if (statusFilter.length > 0 && !statusFilter.includes(user.status)) {
        return false
      }

      // Verification filter
      if (verificationFilter.length > 0) {
        const userVerificationStatus = user.verified ? "verified" : "pending"
        if (!verificationFilter.includes(userVerificationStatus)) {
          return false
        }
      }

      return true
    })
  }, [usersData?.users, roleFilter, statusFilter, verificationFilter])

  // Handler functions
  const handleSearchChange = (value: string) => {
    setSearchTerm(value)
  }

  const handleReset = () => {
    setSearchTerm("")
    setRoleFilter([])
    setStatusFilter([])
    setVerificationFilter([])
    setPage(1)
  }

  const handleSelectUser = (userId: string, checked: boolean) => {
    const newSelected = new Set(selectedUsers)
    if (checked) {
      newSelected.add(userId)
    } else {
      newSelected.delete(userId)
    }
    setSelectedUsers(newSelected)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked && filteredUsers) {
      setSelectedUsers(new Set(filteredUsers.map(u => u._id)))
    } else {
      setSelectedUsers(new Set())
    }
  }

  const handleStatusChange = async (userId: Id<"users">, status: "active" | "inactive" | "banned") => {
    // Prevent user from changing their own status
    if (user?.id === userId) {
      toast.error("You cannot change your own status")
      return
    }

    try {
      await updateUserStatus({
        admin_token: token!,
        user_id: userId,
        status,
      })
      toast.success("User status updated successfully")
    } catch (error: any) {
      toast.error(error.message || "Failed to update user status")
    }
  }

  const handleVerifyUser = async (userId: Id<"users">, verified: boolean) => {
    try {
      await verifyUser({
        admin_token: token!,
        user_id: userId,
        verified,
      })
      toast.success(`User ${verified ? 'verified' : 'unverified'} successfully`)
    } catch (error: any) {
      toast.error(error.message || "Failed to update user verification")
    }
  }

  const handleDeleteUser = async () => {
    if (!userToDelete) return

    try {
      await deleteUser({
        admin_token: token!,
        user_id: userToDelete as Id<"users">,
      })
      toast.success("User deleted successfully")
      setShowDeleteDialog(false)
      setUserToDelete(null)
    } catch (error: any) {
      toast.error(error.message || "Failed to delete user")
    }
  }

  const handleBulkAction = async () => {
    if (selectedUsers.size === 0 || !bulkAction) return

    try {
      const result = await bulkUpdateUsers({
        admin_token: token!,
        user_ids: Array.from(selectedUsers) as Id<"users">[],
        action: bulkAction as any,
      })

      const successCount = result.results.filter(r => r.success).length
      const failureCount = result.results.filter(r => !r.success).length

      if (successCount > 0) {
        toast.success(`${successCount} users updated successfully`)
      }
      if (failureCount > 0) {
        toast.error(`${failureCount} users failed to update`)
      }

      setSelectedUsers(new Set())
      setShowBulkDialog(false)
      setBulkAction("")
    } catch (error: any) {
      toast.error(error.message || "Failed to perform bulk action")
    }
  }

  const isLoading = usersData === undefined
  const users = filteredUsers || []
  const totalCount = usersData?.totalCount || 0
  const hasMore = usersData?.hasMore || false

  // Toolbar configuration
  const filters = [
    <MultiSelectFilter
      key="role"
      title="Role"
      options={USER_ROLE_OPTIONS.map(option => ({
        ...option,
        icon: React.createElement(option.icon, { className: "h-4 w-4" })
      }))}
      selected={roleFilter}
      onSelectionChange={setRoleFilter}
    />,
    <MultiSelectFilter
      key="status"
      title="Status"
      options={USER_STATUS_OPTIONS}
      selected={statusFilter}
      onSelectionChange={setStatusFilter}
    />,
    <MultiSelectFilter
      key="verification"
      title="Verification"
      options={USER_VERIFICATION_OPTIONS}
      selected={verificationFilter}
      onSelectionChange={setVerificationFilter}
    />
  ]

  const actions = [
    <Button key="import" variant="outline" size="sm" className="h-8 border-white/20">
      <Upload className="h-4 w-4" />
      Import
    </Button>,
    <Button key="export" variant="outline" size="sm" className="h-8 border-white/20">
      <Download className="h-4 w-4" />
      Export
    </Button>,
    <Button key="add" size="sm" className="h-8 hover:bg-white hover:text-foreground">
      <UserPlus className="h-4 w-4" />
      Add User
    </Button>
  ]

  const bulkActions = [
    {
      label: "Verify Users",
      icon: <CheckCircle className="h-4 w-4" />,
      onClick: () => {
        setBulkAction("verify")
        setShowBulkDialog(true)
      }
    },
    {
      label: "Unverify Users",
      icon: <XCircle className="h-4 w-4" />,
      onClick: () => {
        setBulkAction("unverify")
        setShowBulkDialog(true)
      }
    },
    {
      label: "Activate Users",
      icon: <CheckCircle className="h-4 w-4" />,
      onClick: () => {
        setBulkAction("activate")
        setShowBulkDialog(true)
      }
    },
    {
      label: "Deactivate Users",
      icon: <XCircle className="h-4 w-4" />,
      onClick: () => {
        setBulkAction("deactivate")
        setShowBulkDialog(true)
      }
    },
    {
      label: "Ban Users",
      icon: <Trash2 className="h-4 w-4" />,
      onClick: () => {
        setBulkAction("ban")
        setShowBulkDialog(true)
      },
      variant: "destructive" as const
    }
  ]

  const toolbar = (
    <DataToolbar
      searchTerm={searchTerm}
      onSearchChange={handleSearchChange}
      onReset={handleReset}
      filters={filters}
      actions={actions}
      isLoading={isLoading}
      selectedCount={selectedUsers.size}
      bulkActions={bulkActions}
      searchPlaceholder="Search users..."
    />
  )

  return (
    <CardLayoutWithToolbar toolbar={toolbar} description="Manage platform users and their permissions">
        <div className="w-full bg-background">
          {isLoading ? (
            <UserTableSkeleton />
          ) : (
            <>
              {/* Header with selection and pagination */}
              <div className="p-4 border-b">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <Checkbox
                      checked={selectedUsers.size === users.length && users.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                    <span className="text-sm text-muted-foreground">
                      {isLoading ? "Loading..." : `${users.length} of ${totalCount} users`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Users List */}
              <div className="p-4">
                {users.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Users className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No users found</h3>
                    <p className="text-muted-foreground text-center max-w-sm">
                      {searchTerm || roleFilter.length > 0 || statusFilter.length > 0 || verificationFilter.length > 0
                        ? "Try adjusting your search criteria or filters"
                        : "Get started by adding your first user to the platform"
                      }
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {users.map((user) => {
                      const RoleIcon = getRoleIcon(user.role)
                      return (
                        <Card key={user._id} className="p-4">
                          <div className="flex items-center gap-4">
                            <Checkbox
                              checked={selectedUsers.has(user._id)}
                              onCheckedChange={(checked) =>
                                handleSelectUser(user._id, checked as boolean)
                              }
                            />

                            <Avatar className="h-10 w-10">
                              <AvatarImage src={user.profile_image || undefined} alt={user.name} />
                              <AvatarFallback className="text-sm">
                                {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                              </AvatarFallback>
                            </Avatar>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-medium truncate">{user.name}</h3>
                                <Badge variant="secondary" className={getRoleColor(user.role)}>
                                  <div className="flex items-center gap-1">
                                    <RoleIcon className="h-4 w-4" />
                                    <span className="capitalize">
                                      {user.role.replace('_', ' ')}
                                    </span>
                                  </div>
                                </Badge>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  {user.email}
                                </div>
                                {user.phone && (
                                  <div className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {user.phone}
                                  </div>
                                )}
                                {user.school && (
                                  <div className="flex items-center gap-1">
                                    <Building className="h-3 w-3" />
                                    {user.school.name}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className={getStatusColor(user.status)}>
                                {user.status}
                              </Badge>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleVerifyUser(user._id, !user.verified)}
                                className={cn(
                                  "h-8 px-2",
                                  user.verified
                                    ? "text-green-600 hover:text-green-700"
                                    : "text-orange-600 hover:text-orange-700"
                                )}
                              >
                                {user.verified ? (
                                  <>
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    <span className="text-xs">Verified</span>
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="h-4 w-4 mr-1" />
                                    <span className="text-xs">Pending</span>
                                  </>
                                )}
                              </Button>
                            </div>

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
                                  Edit User
                                </DropdownMenuItem>
                                {user._id !== user?._id && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handleStatusChange(user._id, "active")}
                                      disabled={user.status === "active"}
                                    >
                                      <CheckCircle className="h-4 w-4 mr-2" />
                                      Activate
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleStatusChange(user._id, "inactive")}
                                      disabled={user.status === "inactive"}
                                    >
                                      <XCircle className="h-4 w-4 mr-2" />
                                      Deactivate
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleStatusChange(user._id, "banned")}
                                      disabled={user.status === "banned"}
                                      className="text-red-600"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Ban User
                                    </DropdownMenuItem>
                                  </>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => {
                                    setUserToDelete(user._id)
                                    setShowDeleteDialog(true)
                                  }}
                                  className="text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete User
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                )}
                <div className="flex items-center justify-center gap-4 space-x-4 mt-6">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1 || isLoading}
                    className="h-8 w-24"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Previous</span>
                  </Button>

                  <span className="text-sm text-foreground space-x-2">
                    <span>Page </span>
                    <span className="font-medium text-foreground">{page}</span>
                  </span>

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setPage(page + 1)}
                    disabled={!hasMore || isLoading}
                    className="h-8 w-24"
                  >
                    <span>Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this user? This action cannot be undone and will permanently remove the user and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bulk Action</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {bulkAction} {selectedUsers.size} selected user{selectedUsers.size > 1 ? 's' : ''}?
              This action will be applied to all selected users.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkAction}>
              {bulkAction === "ban" ? "Ban Users" : `${bulkAction.charAt(0).toUpperCase() + bulkAction.slice(1)} Users`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CardLayoutWithToolbar>
  )
}