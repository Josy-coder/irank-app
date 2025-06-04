"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  Upload,
  AlertCircle,
  User,
  Mail,
  Phone,
  Building,
  FileText,
  Shield,
  Loader2
} from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { toast } from "sonner"
import { FileUpload } from "@/components/file-upload"
import { Id } from "@/convex/_generated/dataModel"
import DatePicker from "@/components/date-picker";
import { format } from "date-fns";

const baseProfileSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  email: z.string().email({ message: "Invalid email address" }),
  phone: z.string().optional(),
  gender: z.enum(["male", "female", "non_binary"]).optional(),
  date_of_birth: z.string().optional(),
})

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

export default function ProfileForm() {
  const { user, token } = useAuth()
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateProfile = useMutation(api.functions.users.updateProfile)
  const updateProfileImage = useMutation(api.functions.users.updateProfileImage)
  const updateSchoolLogo = useMutation(api.functions.users.updateSchoolLogo)
  const updateSafeguardingCertificate = useMutation(api.functions.users.updateSafeguardingCertificate)

  const profileImageUrl = useQuery(
    api.functions.users.getProfileImageUrl,
    user?.profile_image ? { storage_id: user.profile_image as Id<"_storage"> } : "skip"
  )

  const schoolLogoUrl = useQuery(
    api.functions.users.getSchoolLogoUrl,
    user?.school?.id ? { school_id: user.school.id as Id<"schools"> } : "skip"
  )

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
    if (!token) {
      toast.error("Authentication required")
      return
    }

    setLoading(true)
    setError(null)

    try {
      await updateProfile({
        token,
        name: values.name,
        email: values.email,
        phone: values.phone,
        gender: values.gender,
        date_of_birth: values.date_of_birth,
        ...(user?.role === "student" && {
          grade: (values as StudentProfileFormValues).grade
        }),
        ...(user?.role === "school_admin" && {
          position: (values as SchoolAdminProfileFormValues).position
        }),
        ...(user?.role === "volunteer" && {
          high_school_attended: (values as VolunteerProfileFormValues).high_school_attended,
          national_id: (values as VolunteerProfileFormValues).national_id,
        }),
      })

      toast.success("Profile updated successfully!")
    } catch (error: any) {
      console.error("Profile update error:", error)
      setError(error.message?.split("Uncaught Error:")[1]?.split(/\.|Called by client/)[0]?.trim())
      toast.error("Failed to update profile")
    } finally {
      setLoading(false)
    }
  }

  const handleProfileImageUpload = async (storageId: Id<"_storage">) => {
    if (!token) {
      toast.error("Authentication required")
      return
    }

    setUploading(true)
    try {
      await updateProfileImage({
        token,
        profile_image: storageId,
      })
    } catch (error: any) {
      console.error("Profile image upload error:", error)
      toast.error("Failed to update profile image")
    } finally {
      setUploading(false)
    }
  }

  const handleSchoolLogoUpload = async (storageId: Id<"_storage">) => {
    if (user?.role !== "school_admin" || !token) return

    setUploading(true)
    try {
      await updateSchoolLogo({
        token,
        logo_url: storageId,
      })
      toast.success("School logo updated successfully!")
    } catch (error: any) {
      console.error("School logo upload error:", error)
      toast.error("Failed to update school logo")
    } finally {
      setUploading(false)
    }
  }

  const handleSafeguardingCertificateUpload = async (storageId: Id<"_storage">) => {
    if (user?.role !== "volunteer" || !token) return

    setUploading(true)
    try {
      await updateSafeguardingCertificate({
        token,
        safeguarding_certificate: storageId,
      })
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
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground">
              Manage your personal information and preferences
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1">
                <User className="h-4 w-4"/>Profile Picture
              </CardTitle>
              <CardDescription className="text-xs">
                Upload a profile picture to personalize your account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-col items-center space-y-4">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={profileImageUrl || undefined} alt={user.name} />
                  <AvatarFallback className="text-lg">
                    {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <FileUpload
                  onUpload={handleProfileImageUpload}
                  accept={["image/jpeg", "image/jpg", "image/png"]}
                  maxSize={5 * 1024 * 1024}
                  disabled={uploading}

                />
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
        </div>

        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription className="text-xs">
                Update your personal details and contact information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-1.5">
                  <div className="grid gap-2 md:grid-cols-2">
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
                          <DatePicker
                            date={field.value ? new Date(field.value) : undefined}
                            onDateChange={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                            disabled={loading}
                            placeholder="Select your birth date"
                            maxDate={new Date()}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      <>
                        Save Changes
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>

      {(user.role === "school_admin" || user.role === "volunteer") && (
        <div className="grid gap-6 md:grid-cols-2">
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
              <CardContent className="space-y-4">
                {schoolLogoUrl && (
                  <div className="flex justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={schoolLogoUrl}
                      alt="School Logo"
                      className="h-16 w-16 object-contain rounded-lg border"
                    />
                  </div>
                )}

                <FileUpload
                  onUpload={handleSchoolLogoUpload}
                  accept={["image/jpeg", "image/jpg", "image/png"]}
                  maxSize={5 * 1024 * 1024}
                  disabled={uploading}
                >
                  <Button variant="outline" disabled={uploading} className="w-full">
                    {uploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
                  accept={["application/pdf"]}
                  maxSize={10 * 1024 * 1024}
                  disabled={uploading}
                >
                  <Button variant="outline" disabled={uploading} className="w-full">
                    {uploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
        </div>
      )}
    </div>
  )
}