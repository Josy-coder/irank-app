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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, Upload } from "lucide-react"
import { toast } from "sonner"
import { motion } from "framer-motion"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import Rwanda from "rwanda"

const formSchema = z.object({
  name: z.string().min(2, { message: "School name is required" }),
  type: z.enum(["Private", "Public", "Government Aided", "International"], {
    required_error: "School type is required"
  }),
  country: z.string().min(2, { message: "Country is required" }),
  province: z.string().optional(),
  district: z.string().optional(),
  sector: z.string().optional(),
  contactEmail: z.string().email({ message: "Valid contact email is required" }),
  logo: z.any().optional(),
})

type FormValues = z.infer<typeof formSchema>

const SchoolOnboardingForm = ({ userId }: { userId: string }) => {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [provinces, setProvinces] = useState<string[]>([])
  const [districts, setDistricts] = useState<string[]>([])
  const [sectors, setSectors] = useState<string[]>([])
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  const router = useRouter()

  const createSchool = useMutation(api.functions.schools.createSchool)
  const updateUser = useMutation(api.functions.users.updateUser)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      type: undefined,
      country: "Rwanda",
      province: "",
      district: "",
      sector: "",
      contactEmail: "",
      logo: undefined,
    },
  })

  useState(() => {
    try {
      const rwandaProvinces = Rwanda.Provinces()
      setProvinces(rwandaProvinces)
    } catch (error) {
      console.error("Error loading provinces:", error)
      setProvinces([])
    }
  })

  const handleProvinceChange = (province: string) => {
    form.setValue("province", province)
    form.setValue("district", "")
    form.setValue("sector", "")

    try {
      const provinceDistricts = Rwanda.Districts(province)
      setDistricts(provinceDistricts)
      setSectors([])
    } catch (error) {
      console.error("Error loading districts:", error)
      setDistricts([])
    }
  }

  const handleDistrictChange = (district: string) => {
    form.setValue("district", district)
    form.setValue("sector", "")

    try {
      const districtSectors = Rwanda.Sectors(form.getValues("province"), district)
      setSectors(districtSectors)
    } catch (error) {
      console.error("Error loading sectors:", error)
      setSectors([])
    }
  }

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      form.setValue("logo", file)

      const reader = new FileReader()
      reader.onload = (e) => {
        setLogoPreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const nextStep = async () => {
    let fieldsToValidate: ("name" | "type" | "country" | "province" | "district" | "sector" | "contactEmail")[] = [];

    switch(step) {
      case 1:
        fieldsToValidate = ["name", "type"];
        break;
      case 2:
        fieldsToValidate = ["country", "province", "district", "sector"];
        break;
    }

    const result = await form.trigger(fieldsToValidate);
    if (result) {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    setStep(step - 1);
  };

  const handleOnboarding = async (values: FormValues) => {
    setLoading(true)
    setError(null)

    try {
      // Create the new school
      const schoolId = await createSchool({
        name: values.name,
        type: values.type,
        country: values.country,
        province: values.province || undefined,
        district: values.district || undefined,
        sector: values.sector || undefined,
        contact_email: values.contactEmail,
        logo_url: undefined, // For now, we'll handle file upload in a follow-up step
        status: "active",
      })

      // Update the user's schoolId and status
      await updateUser({
        id: userId,
        school_id: schoolId,
        status: "active",
      })

      // Show success message
      toast.success("School onboarding completed successfully!")

      // Redirect to school dashboard
      router.push("/dashboard/school")
    } catch (error: any) {
      console.error("Onboarding error:", error)
      setError(error.message || "Failed to complete onboarding. Please try again.")
      toast.error(error.message || "Failed to complete onboarding")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">School Onboarding</h2>
        <p className="text-muted-foreground">Set up your school profile to get started</p>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center justify-between mb-8">
        <div className="w-full flex items-center">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'}`}>
            1
          </div>
          <div className={`flex-1 h-1 ${step >= 2 ? 'bg-primary' : 'bg-gray-200'}`}></div>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'}`}>
            2
          </div>
          <div className={`flex-1 h-1 ${step >= 3 ? 'bg-primary' : 'bg-gray-200'}`}></div>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 3 ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'}`}>
            3
          </div>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleOnboarding)} className="space-y-6">
          {step === 1 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <h3 className="text-lg font-medium">School Details</h3>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>School Name</FormLabel>
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
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>School Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={loading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select school type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Private">Private</SelectItem>
                        <SelectItem value="Public">Public</SelectItem>
                        <SelectItem value="Government Aided">Government Aided</SelectItem>
                        <SelectItem value="International">International</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="pt-4">
                <Button
                  type="button"
                  className="w-full"
                  onClick={nextStep}
                  disabled={loading}
                >
                  Next Step
                </Button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <h3 className="text-lg font-medium">Location Details</h3>
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        disabled={true}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="province"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Province</FormLabel>
                    <Select
                      onValueChange={(value) => handleProvinceChange(value)}
                      value={field.value || ""}
                      disabled={loading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select province" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {provinces.map(province => (
                          <SelectItem key={province} value={province}>{province}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="district"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>District</FormLabel>
                    <Select
                      onValueChange={(value) => handleDistrictChange(value)}
                      value={field.value || ""}
                      disabled={loading || districts.length === 0}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select district" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {districts.map(district => (
                          <SelectItem key={district} value={district}>{district}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sector"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sector</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || ""}
                      disabled={loading || sectors.length === 0}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select sector" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {sectors.map(sector => (
                          <SelectItem key={sector} value={sector}>{sector}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={prevStep}
                  disabled={loading}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  onClick={nextStep}
                  disabled={loading}
                >
                  Next Step
                </Button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <h3 className="text-lg font-medium">Contact Information</h3>
              <FormField
                control={form.control}
                name="contactEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>School Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="school@example.com"
                        {...field}
                        disabled={loading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <FormLabel>School Logo (Optional)</FormLabel>
                <div className="flex items-center gap-4">
                  {logoPreview && (
                    <div className="w-16 h-16 rounded-md overflow-hidden">
                      <img src={logoPreview} alt="Logo preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <label className="cursor-pointer flex-1">
                    <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-md p-4 text-center hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <Upload className="mx-auto h-6 w-6 text-gray-400" />
                      <span className="mt-2 block text-sm font-medium text-gray-500 dark:text-gray-400">
                        Click to upload logo
                      </span>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoUpload}
                      disabled={loading}
                    />
                  </label>
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300 p-3 rounded-md text-sm">
                  {error}
                </div>
              )}

              <div className="flex space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={prevStep}
                  disabled={loading}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
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
              </div>
            </motion.div>
          )}
        </form>
      </Form>
    </div>
  );
};

export default SchoolOnboardingForm;