"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
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
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { motion } from "framer-motion"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"

const formSchema = z.object({
  schoolId: z.string({
    required_error: "School is required"
  }),
})

type FormValues = z.infer<typeof formSchema>

interface School {
  _id: string;
  name: string;
  status: string;
}

const StudentOnboardingForm = ({ userId }: { userId: string }) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [filteredSchools, setFilteredSchools] = useState<School[]>([])

  const router = useRouter()

  const updateUser = useMutation(api.users.updateUser)
  const schoolsQuery = useQuery(api.schools.getSchools, {
    search: "",
    status: "active",
    page: 1,
    limit: 100
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      schoolId: "",
    },
  })

  useEffect(() => {
    if (schoolsQuery?.schools) {
      if (!searchTerm) {
        setFilteredSchools(schoolsQuery.schools)
      } else {
        const filtered = schoolsQuery.schools.filter(school =>
          school.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
        setFilteredSchools(filtered)
      }
    }
  }, [searchTerm, schoolsQuery])

  const handleOnboarding = async (values: FormValues) => {
    setLoading(true)
    setError(null)

    try {
      await updateUser({
        id: userId,
        school_id: values.schoolId,
        status: "active",
      })

      toast.success("School affiliation completed successfully!")

      router.push("/dashboard/student")
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
        <h2 className="text-2xl font-bold mb-2">School Affiliation</h2>
        <p className="text-muted-foreground">Select your school to complete your profile</p>
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
              name="schoolId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your School</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    disabled={loading || !schoolsQuery?.schools}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your school" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <div className="px-2 pb-2">
                        <input
                          className="w-full p-2 border rounded-md mb-2"
                          placeholder="Search schools..."
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </div>
                      {schoolsQuery?.isLoading ? (
                        <div className="flex items-center justify-center p-4">
                          <Loader2 className="h-5 w-5 animate-spin" />
                        </div>
                      ) : filteredSchools.length > 0 ? (
                        filteredSchools.map(school => (
                          <SelectItem key={school._id} value={school._id}>
                            {school.name}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="text-center p-2 text-sm text-muted-foreground">
                          No schools found
                        </div>
                      )}
                      <div className="p-2 text-xs text-muted-foreground border-t">
                        Can't find your school? Contact your school administrator.
                      </div>
                    </SelectContent>
                  </Select>
                  <FormMessage />
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

export default StudentOnboardingForm;