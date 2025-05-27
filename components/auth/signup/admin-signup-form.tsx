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
import { Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { motion } from "framer-motion"
import Image from "next/image"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/hooks/useAuth"

const formSchema = z.object({
  name: z.string().min(2, { message: "Full name is required" }),
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(8, { message: "Password must be at least 8 characters" }),
  phone: z.string().min(10, { message: "Valid phone number is required" }),
  position: z.string().min(2, { message: "Position is required" }),
})

type FormValues = z.infer<typeof formSchema>

const AdminSignUpForm = () => {
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
    },
  })

  const nextStep = async () => {
    let fieldsToValidate: ("name" | "email" | "password" | "phone" | "position")[] = [];

    switch(step) {
      case 1:
        fieldsToValidate = ["name", "email", "password"];
        break;
      case 2:
        fieldsToValidate = ["phone", "position"];
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
        role: "admin",
        phone: values.phone,
        position: values.position,
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
        <h2 className="text-lg font-bold dark:text-primary-foreground">Admin Sign Up</h2>
        <p className="text-sm text-muted-foreground mt-2">Create an administrator account</p>
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
                    <FormLabel>Position</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. System Administrator"
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
        <Link href="/signin/admin" className="text-primary hover:underline">
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

export default AdminSignUpForm;