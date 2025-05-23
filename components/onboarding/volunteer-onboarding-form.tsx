"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Loader2, Upload } from "lucide-react"
import { toast } from "sonner"
import { motion } from "framer-motion"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"

// Define the form schema for volunteer onboarding
const formSchema = z.object({
  highSchoolAttended: z.string().min(2, { message: "High school name is required" }),
  safeguardingCertificate: z.any().refine(val => val,
    { message: "Safeguarding certificate is required" }
  ),
})

type FormValues = z.infer<typeof formSchema>

const VolunteerOnboardingForm = ({ userId }: { userId: string }) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [certificateFile, setCertificateFile] = useState<File | null>(null)
  const [certificatePreview, setCertificatePreview] = useState<string | null>(null)

  const router = useRouter()

  // Convex mutations
  const updateUser = useMutation(api.users.updateUser)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      highSchoolAttended: "",
      safeguardingCertificate: undefined,
    },
  })

  // Handle file upload for safeguarding certificate
  const handleCertificateUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      form.setValue("safeguardingCertificate", file)
      setCertificateFile(file)

      // Create a preview (only for image files)
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (e) => {
          setCertificatePreview(e.target?.result as string)
        }
        reader.readAsDataURL(file)
      } else {
        // For non-image files (like PDFs), just show filename
        setCertificatePreview(null)
      }
    }
  }

  const handleOnboarding = async (values: FormValues) => {
    setLoading(true)
    setError(null)

    try {
      // In a real implementation, you'd first upload the certificate file to storage
      // and get a file ID. For now, we'll skip that part.

      // For example:
      // const certificateFileId = await uploadFile(values.safeguardingCertificate)
      const certificateFileId = "temp_file_id"

      // Update the user's information and status
      await updateUser({
        id: userId,
        high_school_attended: values.highSchoolAttended,
        safeguarding_certificate: certificateFileId,
        status: "active",
      })

      toast.success("Volunteer profile completed successfully!")

      router.push("/dashboard/volunteer")
    } catch (error: any) {
      console.error("Onboarding error:", error)
      setError(error.message || "Failed to complete onboarding. Please try again.")
      toast.error(error.message || "Failed to complete onboarding")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">Volunteer Information</h2>
        <p className="text-muted-foreground">Complete your profile to get started</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleOnboarding)} className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <FormField
              control={form.control}
              name="highSchoolAttended"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>High School Attended</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Green Hills Academy"
                      {...field}
                      disabled={loading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="safeguardingCertificate"
              render={({ field: { onChange, value, ...field } }) => (
                <FormItem>
                  <FormLabel>Safeguarding Certificate</FormLabel>
                  <div className="space-y-2">
                    <FormControl>
                      <div className="flex items-center gap-4">
                        {certificatePreview && (
                          <div className="w-16 h-16 rounded-md overflow-hidden">
                            <img src={certificatePreview} alt="Certificate preview" className="w-full h-full object-cover" />
                          </div>
                        )}
                        {certificateFile && !certificatePreview && (
                          <div className="flex items-center justify-center h-16 w-16 rounded-md bg-gray-100 dark:bg-gray-800">
                            <span className="text-xs text-gray-500 dark:text-gray-400 text-center overflow-hidden">
                              {certificateFile.name.length > 10
                                ? `${certificateFile.name.substring(0, 10)}...`
                                : certificateFile.name}
                            </span>
                          </div>
                        )}
                        <label className="cursor-pointer flex-1">
                          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-md p-4 text-center hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                            <Upload className="mx-auto h-6 w-6 text-gray-400" />
                            <span className="mt-2 block text-sm font-medium text-gray-500 dark:text-gray-400">
                              {certificateFile ? "Replace certificate" : "Upload safeguarding certificate"}
                            </span>
                            <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                              PDF, PNG, or JPG up to 5MB
                            </span>
                          </div>
                          <input
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg"
                            className="hidden"
                            onChange={handleCertificateUpload}
                            disabled={loading}
                            {...field}
                          />
                        </label>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300 p-3 rounded-md text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Completing...
                </span>
              ) : (
                "Complete Setup"
              )}
            </Button>
          </motion.div>
        </form>
      </Form>
    </div>
  );
};

export default VolunteerOnboardingForm;