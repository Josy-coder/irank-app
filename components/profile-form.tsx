"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Camera,
  Upload,
  Save,
  AlertCircle,
  User,
  Mail,
  Phone,
  Calendar,
  MapPin,
  Building,
  GraduationCap,
  FileText,
  Shield
} from "lucide-react"
import { motion } from "framer-motion"
import { useAuth } from "@/hooks/useAuth"
import { toast } from "sonner"
import { FileUpload } from "@/components/file-upload"

// Base profile schema
const baseProfileSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  email: z.string().email({ message: "Invalid email address" }),
  phone: z.string().optional(),
  gender: z.enum(["male", "female", "non_binary"]).optional(),
  date_of_birth: z.string().optional(),
})

// Extended schemas for different roles
const studentProfileSchema = baseProfileSchema.extend({
  grade: z.string().optional(),
})

const schoolAdminProfileSchema = baseProfileSchema.extend({
  position: z.string().optional(),
})

const volunteerProfileSchema = baseProfileSchema.extend({
  high_school_attended: z.string().optional(),
  national_id: z.string().optional(),
})

type BaseProfileFormValues = z.infer<typeof baseProfileSchema>
type StudentProfileFormValues = z.infer<typeof studentProfileSchema>
type SchoolAdminProfileFormValues = z.infer<typeof schoolAdminProfileSchema>
type VolunteerProfileFormValues = z.infer<typeof volunteerProfileSchema>

type ProfileFormValues = BaseProfileFormValues | StudentProfileFormValues | SchoolAdminProfileFormValues | VolunteerProfileFormValues

export default function ProfilePage() {
  const { user, token } = useAuth()
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Determine schema based on user role
  const getSchema = () => {
    switch (user?.role) {
      case "student":
        return studentProfileSchema
      case "school_admin":
        return schoolAdminProfileSchema
      case "volunteer":
        return volunteerProfileSchema
      default:
        return baseProfileSchema
    }
  }

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(getSchema()),
    defaultValues: {
      name: user?.name || "",
      email: user?.email || "",
      phone: user?.phone || "",
      gender: user?.gender as "male" | "female" | "non_binary" | undefined || undefined,
      date_of_birth: user?.date_of_birth || "",
      ...(user?.role === "student" && { grade: user.grade || "" }),
      ...(user?.role === "school_admin" && { position: user.position || "" }),
      ...(user?.role === "volunteer" && {
        high_school_attended: user.high_school_attended || "",
        national_id: user.national_id || "",
      }),
    },
  })

  const handleSubmit = async (values: ProfileFormValues) => {
    setLoading(true)
    setError(null)

    try {

      console.log("Profile update values:", values)
      toast.success("Profile updated successfully!")
    } catch (error: any) {
      console.error("Profile update error:", error)
      setError(error.message)
      toast.error("Failed to update profile")
    } finally {
      setLoading(false)
    }
  }

  const handleProfileImageUpload = async (fileId: string) => {
    setUploading(true)
    try {

      console.log("Profile image uploaded:", fileId)
      toast.success("Profile image updated successfully!")
    } catch (error: any) {
      console.error("Profile image upload error:", error)
      toast.error("Failed to update profile image")
    } finally {
      setUploading(false)
    }
  }

  const handleSchoolLogoUpload = async (fileId: string) => {
    if (user?.role !== "school_admin") return

    setUploading(true)
    try {

      console.log("School logo uploaded:", fileId)
      toast.success("School logo updated successfully!")
    } catch (error: any) {
      console.error("School logo upload error:", error)
      toast.error("Failed to update school logo")
    } finally {
      setUploading(false)
    }
  }

  const handleSafeguardingCertificateUpload = async (fileId: string) => {
    if (user?.role !== "volunteer") return

    setUploading(true)
    try {
      // Here you would call your update safeguarding certificate mutation
      // await updateSafeguardingCertificate(fileId)
      console.log("Safeguarding certificate uploaded:", fileId)
      toast.success("Safeguarding certificate updated successfully!")
    } catch (error: any) {
      console.error("Safeguarding certificate upload error:", error)
      toast.error("Failed to update safeguarding certificate")
    } finally {
      setUploading(false)
    }
  }

  if (!user) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-64" />
          <div className="md:col-span-2">
            <Skeleton className="h-64" />
          </div>
        </div>
      </div>
    )
  }

  const getRoleDisplayName = () => {
    switch (user.role) {
      case "school_admin":
        return "School Administrator"
      case "volunteer":
        return "Volunteer Judge"
      case "admin":
        return "System Administrator"
      case "student":
        return "Student"
      default:
        return "User"
    }
  }

  const getRoleBadgeColor = () => {
    switch (user.role) {
      case "admin":
        return "bg-red-100 text-red-800"
      case "school_admin":
        return "bg-blue-100 text-blue-800"
      case "volunteer":
        return "bg-green-100 text-green-800"
      case "student":
        return "bg-purple-100 text-purple-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
            <p className="text-muted-foreground">
              Manage your personal information and preferences
            </p>
          </div>
          <Badge className={getRoleBadgeColor()}>
            {getRoleDisplayName()}
          </Badge>
        </div>
      </motion.div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Profile Picture and Basic Info */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Picture
              </CardTitle>
              <CardDescription>
                Upload a profile picture to personalize your account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col items-center space-y-4">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={user.profile_image} alt={user.name} />
                  <AvatarFallback className="text-lg">
                    {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <FileUpload
                  onUpload={handleProfileImageUpload}
                  accept="image/*"
                  maxSize={5 * 1024 * 1024} // 5MB
                  disabled={uploading}
                >
                  <Button variant="outline" disabled={uploading} className="w-full">
                    {uploading ? (
                      <>
                        <Upload className="mr-2 h-4 w-4 animate-pulse" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Camera className="mr-2 h-4 w-4" />
                        Change Picture
                      </>
                    )}
                  </Button>
                </FileUpload>
              </div>

              <div className="space-y-3 pt-4 border-t">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-medium">{user.email}</span>
                </div>

                {user.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Phone:</span>
                    <span className="font-medium">{user.phone}</span>
                  </div>
                )}

                {user.school && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">School:</span>
                    <span className="font-medium">{user.school.name}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant={user.verified ? "default" : "secondary"}>
                    {user.verified ? "Verified" : "Pending"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Profile Form */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="md:col-span-2"
        >
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>
                Update your personal details and contact information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter your full name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="your@email.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl>
                            <Input placeholder="+250 7XXXXXXXX" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="gender"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gender</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select gender" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="male">Male</SelectItem>
                              <SelectItem value="female">Female</SelectItem>
                              <SelectItem value="non_binary">Non-binary</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="date_of_birth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of Birth</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Role-specific fields */}
                  {user.role === "student" && (
                    <FormField
                      control={form.control}
                      name="grade"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Grade/Class</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., S6, Year 12" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {user.role === "school_admin" && (
                    <FormField
                      control={form.control}
                      name="position"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Position at School</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Principal, Vice Principal" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {user.role === "volunteer" && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="high_school_attended"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>High School Attended</FormLabel>
                            <FormControl>
                              <Input placeholder="Name of your high school" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="national_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>National ID</FormLabel>
                            <FormControl>
                              <Input placeholder="Your national ID number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? (
                      <>
                        <Upload className="mr-2 h-4 w-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Additional uploads for specific roles */}
      {(user.role === "school_admin" || user.role === "volunteer") && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="grid gap-6 md:grid-cols-2"
        >
          {user.role === "school_admin" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  School Logo
                </CardTitle>
                <CardDescription>
                  Upload your school&#39;s official logo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FileUpload
                  onUpload={handleSchoolLogoUpload}
                  accept="image/*"
                  maxSize={5 * 1024 * 1024} // 5MB
                  disabled={uploading}
                >
                  <Button variant="outline" disabled={uploading} className="w-full">
                    {uploading ? (
                      <>
                        <Upload className="mr-2 h-4 w-4 animate-pulse" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload School Logo
                      </>
                    )}
                  </Button>
                </FileUpload>
              </CardContent>
            </Card>
          )}

          {user.role === "volunteer" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Safeguarding Certificate
                </CardTitle>
                <CardDescription>
                  Upload your safeguarding certificate (PDF only)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FileUpload
                  onUpload={handleSafeguardingCertificateUpload}
                  accept=".pdf"
                  maxSize={10 * 1024 * 1024} // 10MB
                  disabled={uploading}
                >
                  <Button variant="outline" disabled={uploading} className="w-full">
                    {uploading ? (
                      <>
                        <Upload className="mr-2 h-4 w-4 animate-pulse" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Certificate
                      </>
                    )}
                  </Button>
                </FileUpload>
              </CardContent>
            </Card>
          )}
        </motion.div>
      )}
    </div>
  )
}