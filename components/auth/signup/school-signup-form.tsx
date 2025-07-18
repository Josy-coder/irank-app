"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { motion } from "framer-motion"
import Image from "next/image"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/hooks/use-auth"
import { LocationSelector } from "@/components/location-selector"

const formSchema = z.object({
  name: z.string().min(2, { message: "Full name is required" }),
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(8, { message: "Password must be at least 8 characters" }),
  phone: z.string().min(10, { message: "Valid phone number is required" }),
  position: z.string().min(2, { message: "Position is required" }),
  // School fields
  schoolName: z.string().min(2, { message: "School name is required" }),
  schoolType: z.enum(["Private", "Public", "Government Aided", "International"]),
  country: z.string().min(1, { message: "Country is required" }),
  province: z.string().min(1, { message: "Province is required" }),
  district: z.string().min(1, { message: "District is required" }),
  sector: z.string().optional(),
  cell: z.string().optional(),
  village: z.string().optional(),
  contactName: z.string().min(2, { message: "Contact name is required" }),
  contactEmail: z.string().email({ message: "Valid contact email is required" }),
  contactPhone: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

export function SchoolAdminSignUpForm () {
  const [step, setStep] = useState(1)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [agreeTerms, setAgreeTerms] = useState(false)

  const { signUp } = useAuth()
  const router = useRouter()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      phone: "",
      position: "",
      schoolName: "",
      schoolType: undefined,
      country: "",
      province: "",
      district: "",
      sector: "",
      cell: "",
      village: "",
      contactName: "",
      contactEmail: "",
      contactPhone: "",
    },
  })

  const nextStep = async () => {
    let fieldsToValidate: (keyof FormValues)[] = [];

    switch(step) {
      case 1:
        fieldsToValidate = ["name", "email", "password"];
        break;
      case 2:
        fieldsToValidate = ["phone", "position"];
        break;
      case 3:
        fieldsToValidate = ["schoolName", "schoolType", "country", "province", "district"];
        break;
      case 4:
        fieldsToValidate = ["contactName", "contactEmail"];
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

  const handleSignUp = async (values: FormValues) => {
    if (!agreeTerms) {
      toast.error("Please agree to the terms and conditions")
      return
    }

    setLoading(true)
    setError(null)

    try {
      await signUp({
        name: values.name,
        email: values.email,
        password: values.password,
        role: "school_admin",
        phone: values.phone,
        position: values.position,
        school_data: {
          name: values.schoolName,
          type: values.schoolType,
          country: values.country,
          province: values.province,
          district: values.district,
          sector: values.sector,
          cell: values.cell,
          village: values.village,
          contact_name: values.contactName,
          contact_email: values.contactEmail,
          contact_phone: values.contactPhone,
        },
      })

      router.push("/")
    } catch (error: any) {
      console.error("Signup error:", error)
      setError(error.message || "Failed to create account. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md space-y-4">
      <Image
        src="/images/logo.png"
        alt="iRankHub Logo"
        width={80}
        height={80}
        className="mx-auto md:hidden"
      />
      <div className="text-center">
        <h2 className="text-lg font-bold dark:text-primary-foreground">School Admin Sign Up</h2>
        <p className="text-sm text-muted-foreground mt-2">Register your school for debate tournaments</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSignUp)} className="mt-6 space-y-4">
          {step === 1 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="John Doe"
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
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email address</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="name@example.com"
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
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          {...field}
                          disabled={loading}
                          className="pr-10"
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 py-2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex={-1}
                        disabled={loading}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="button"
                className="w-full mt-6"
                onClick={nextStep}
                disabled={loading}
              >
                Next Step
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
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
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="+250 7XXXXXXXX"
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
                name="position"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Position at School</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Principal, Debate Coach"
                        {...field}
                        disabled={loading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex space-x-2 pt-2">
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
                  onClick={nextStep}
                  disabled={loading}
                  className="flex-1"
                >
                  Next Step
                  <ArrowRight className="ml-2 h-4 w-4" />
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
              <FormField
                control={form.control}
                name="schoolName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>School Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter school name"
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
                name="schoolType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>School Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={loading}>
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

              <div className="space-y-2">
                <Label className="text-sm font-medium">School Location</Label>
                <LocationSelector
                  country={form.watch("country")}
                  province={form.watch("province")}
                  district={form.watch("district")}
                  sector={form.watch("sector")}
                  cell={form.watch("cell")}
                  village={form.watch("village")}
                  onCountryChange={(country) => {
                    form.setValue("country", country)
                    form.setValue("province", "")
                    form.setValue("district", "")
                    form.setValue("sector", "")
                    form.setValue("cell", "")
                    form.setValue("village", "")
                  }}
                  onProvinceChange={(province) => {
                    form.setValue("province", province)
                    form.setValue("district", "")
                    form.setValue("sector", "")
                    form.setValue("cell", "")
                    form.setValue("village", "")
                  }}
                  onDistrictChange={(district) => {
                    form.setValue("district", district)
                    form.setValue("sector", "")
                    form.setValue("cell", "")
                    form.setValue("village", "")
                  }}
                  onSectorChange={(sector) => {
                    form.setValue("sector", sector || "")
                    form.setValue("cell", "")
                    form.setValue("village", "")
                  }}
                  onCellChange={(cell) => {
                    form.setValue("cell", cell || "")
                    form.setValue("village", "")
                  }}
                  onVillageChange={(village) => {
                    form.setValue("village", village || "")
                  }}
                  countryError={form.formState.errors.country?.message}
                  provinceError={form.formState.errors.province?.message}
                  districtError={form.formState.errors.district?.message}
                  sectorError={form.formState.errors.sector?.message}
                  cellError={form.formState.errors.cell?.message}
                  villageError={form.formState.errors.village?.message}
                  includeRwandaDetails={form.watch("country") === "RW"}
                />
              </div>

              <div className="flex space-x-2 pt-2">
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
                  onClick={nextStep}
                  disabled={loading}
                  className="flex-1"
                >
                  Next Step
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="contactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Person Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Contact person's full name"
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
                name="contactEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="contact@school.com"
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
                name="contactPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Phone (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="+250 7XXXXXXXX"
                        {...field}
                        disabled={loading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="terms"
                  checked={agreeTerms}
                  onCheckedChange={(checked) => setAgreeTerms(checked as boolean)}
                  disabled={loading}
                />
                <Label
                  htmlFor="terms"
                  className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  I agree to the{" "}
                  <Link href="/terms" className="text-primary hover:underline">
                    terms and conditions
                  </Link>
                </Label>
              </div>

              <div className="flex space-x-2 pt-2">
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
                  disabled={loading || !agreeTerms}
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </span>
                  ) : (
                    "Create Account"
                  )}
                </Button>
              </div>
            </motion.div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300 p-3 rounded-md text-sm">
              {error}
            </div>
          )}
        </form>
      </Form>

      <div className="text-center text-sm pt-4">
        <span className="text-muted-foreground">Already have an account? </span>
        <Link href="/signin/school_admin" className="text-primary hover:underline">
          Sign in
        </Link>
      </div>

      <div className="text-center">
        <Link
          href="/"
          className="inline-flex items-center text-sm text-primary hover:underline"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mr-1"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to role selection
        </Link>
      </div>
    </div>
  );
};