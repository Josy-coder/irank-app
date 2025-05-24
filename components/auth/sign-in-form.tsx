"use client"

import { useEffect, useState } from "react";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Eye, EyeOff, Loader2, Search } from "lucide-react"
import { Label } from "@/components/ui/label"
import { motion } from "framer-motion"
import Image from "next/image"
import { useAuth } from "@/hooks/useAuth"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useDebounce } from "@/hooks/use-debounce"

type UserRole = "student" | "school_admin" | "volunteer" | "admin"

interface SignInFormProps {
  role: UserRole
}

const emailFormSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(1, { message: "Password is required" }),
})

const phoneFormSchema = z.object({
  nameSearch: z.string().min(2, { message: "Enter at least 2 characters to search" }),
  selectedUserId: z.string().min(1, { message: "Please select a student" }),
  phone: z.string().min(10, { message: "Valid phone number is required" }),
  securityAnswer: z.string().min(1, { message: "Security answer is required" }),
})

type EmailFormValues = z.infer<typeof emailFormSchema>
type PhoneFormValues = z.infer<typeof phoneFormSchema>

const SignInForm = ({ role }: SignInFormProps) => {
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rememberMe, setRememberMe] = useState(false)
  const [authMethod, setAuthMethod] = useState<"email" | "phone">("email")
  const [, setSelectedStudent] = useState<any>(null)
  const [securityQuestion, setSecurityQuestion] = useState<string>("")

  const { signIn, signInWithPhone } = useAuth()

  const emailForm = useForm<EmailFormValues>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  const phoneForm = useForm<PhoneFormValues>({
    resolver: zodResolver(phoneFormSchema),
    defaultValues: {
      nameSearch: "",
      selectedUserId: "",
      phone: "",
      securityAnswer: "",
    },
  })

  const nameSearch = phoneForm.watch("nameSearch")
  const debouncedSearch = useDebounce(nameSearch, 300)

  const studentsQuery = useQuery(
    api.functions.auth.searchUsersByName,
    role === "student" && authMethod === "phone" && debouncedSearch.length >= 2
      ? { name: debouncedSearch }
      : "skip"
  )

  const selectedUserId = phoneForm.watch("selectedUserId")
  const phone = phoneForm.watch("phone")

  const securityQuestionQuery = useQuery(
    api.functions.auth.getSecurityQuestion,
    selectedUserId && phone && phone.length >= 10
      ? { user_id: selectedUserId as any, phone }
      : "skip"
  )

  useEffect(() => {
    if (securityQuestionQuery?.question) {
      setSecurityQuestion(securityQuestionQuery.question)
    }
  }, [securityQuestionQuery])

  const handleEmailSignIn = async (values: EmailFormValues) => {
    setLoading(true)
    setError(null)

    try {
      await signIn(values.email, values.password, rememberMe)
    } catch (error: any) {
      console.error("Signin error:", error)
      setError(error.message || "Failed to sign in. Please check your credentials.")
    } finally {
      setLoading(false)
    }
  }

  const handlePhoneSignIn = async (values: PhoneFormValues) => {
    setLoading(true)
    setError(null)

    try {
      await signInWithPhone({
        name_search: values.nameSearch,
        selected_user_id: values.selectedUserId as any,
        phone: values.phone,
        security_answer: values.securityAnswer,
      })
    } catch (error: any) {
      console.error("Phone signin error:", error)
      setError(error.message || "Failed to sign in. Please check your information.")
    } finally {
      setLoading(false)
    }
  }

  const getRoleHeading = () => {
    switch (role) {
      case "student":
        return "Welcome Back, Student!"
      case "school_admin":
        return "School Admin Portal"
      case "volunteer":
        return "Volunteer Sign In"
      case "admin":
        return "Admin Dashboard Access"
      default:
        return "Sign In to iRankHub"
    }
  }

  const getRoleImage = () => {
    switch (role) {
      case "student":
        return "/images/student-signup.png"
      case "school_admin":
        return "/images/school-signup.png"
      case "volunteer":
        return "/images/volunteer1.jpg"
      case "admin":
        return "/images/admin-signup.png"
      default:
        return "/images/volunteer3.jpg"
    }
  }

  const getRoleDescription = () => {
    switch (role) {
      case "student":
        return "Access your debate competitions and track your progress"
      case "school_admin":
        return "Manage your school's debate teams and tournament participation"
      case "volunteer":
        return "Access your judging assignments and feedback history"
      case "admin":
        return "Manage the iRankHub platform and user accounts"
      default:
        return "Sign in to continue"
    }
  }

  return (
    <div className="flex min-h-screen ">
      <div className="w-full flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="w-full max-w-md space-y-4">
            <Image
              src="/images/logo.png"
              alt="iRankHub Logo"
              width={80}
              height={80}
              className="mx-auto md:hidden"
            />

            <div className="text-center">
              <h2 className="text-base md:text-lg font-bold dark:text-primary-foreground">
                Sign in as {role === 'school_admin' ? 'School Admin' : role.charAt(0).toUpperCase() + role.slice(1)}
              </h2>
              <p className="text-sm text-muted-foreground mt-2">Welcome back! Please sign in to continue</p>
            </div>

            {role === "student" ? (
              <Tabs value={authMethod} onValueChange={(value) => setAuthMethod(value as "email" | "phone")} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="email">Email</TabsTrigger>
                  <TabsTrigger value="phone">Phone</TabsTrigger>
                </TabsList>

                <TabsContent value="email" className="space-y-4">
                  <Form {...emailForm}>
                    <form onSubmit={emailForm.handleSubmit(handleEmailSignIn)} className="space-y-4">
                      <FormField
                        control={emailForm.control}
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
                        control={emailForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between">
                              <FormLabel>Password</FormLabel>
                              <Link
                                href={`/reset-password/${role}`}
                                className="text-xs text-primary hover:underline"
                              >
                                Forgot password?
                              </Link>
                            </div>
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

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="rememberMe"
                          checked={rememberMe}
                          onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                          disabled={loading}
                        />
                        <Label
                          htmlFor="rememberMe"
                          className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-primary-foreground"
                        >
                          Remember me
                        </Label>
                      </div>

                      <Button type="submit" disabled={loading} className="w-full">
                        {loading ? (
                          <span className="flex items-center justify-center">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Signing in...
                          </span>
                        ) : (
                          "Sign in"
                        )}
                      </Button>
                    </form>
                  </Form>
                </TabsContent>

                <TabsContent value="phone" className="space-y-4">
                  <Form {...phoneForm}>
                    <form onSubmit={phoneForm.handleSubmit(handlePhoneSignIn)} className="space-y-4">
                      <FormField
                        control={phoneForm.control}
                        name="nameSearch"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Search Your Name</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                  placeholder="Type your name to search..."
                                  {...field}
                                  disabled={loading}
                                  className="pl-10"
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Student Selection */}
                      {studentsQuery && studentsQuery.length > 0 && (
                        <FormField
                          control={phoneForm.control}
                          name="selectedUserId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Select Your Account</FormLabel>
                              <div className="space-y-2 max-h-32 overflow-y-auto border rounded-md">
                                {studentsQuery.map((student) => (
                                  <div
                                    key={student.id}
                                    className={`p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 ${
                                      field.value === student.id ? 'bg-blue-50 dark:bg-blue-900' : ''
                                    }`}
                                    onClick={() => {
                                      field.onChange(student.id)
                                      setSelectedStudent(student)
                                    }}
                                  >
                                    <p className="font-medium">{student.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      Phone ending: ...{student.phone}
                                    </p>
                                  </div>
                                ))}
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      <FormField
                        control={phoneForm.control}
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

                      {/* Security Question */}
                      {securityQuestion && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Security Question</Label>
                          <p className="text-sm text-muted-foreground bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                            {securityQuestion}
                          </p>
                        </div>
                      )}

                      <FormField
                        control={phoneForm.control}
                        name="securityAnswer"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Security Answer</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Enter your answer"
                                {...field}
                                disabled={loading || !securityQuestion}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button type="submit" disabled={loading || !securityQuestion} className="w-full">
                        {loading ? (
                          <span className="flex items-center justify-center">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Signing in...
                          </span>
                        ) : (
                          "Sign in"
                        )}
                      </Button>
                    </form>
                  </Form>
                </TabsContent>
              </Tabs>
            ) : (
              // Email-only form for non-students
              <Form {...emailForm}>
                <form onSubmit={emailForm.handleSubmit(handleEmailSignIn)} className="space-y-4">
                  <FormField
                    control={emailForm.control}
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
                    control={emailForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel>Password</FormLabel>
                          <Link
                            href={`/reset-password/${role}`}
                            className="text-xs text-primary hover:underline"
                          >
                            Forgot password?
                          </Link>
                        </div>
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

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="rememberMe"
                      checked={rememberMe}
                      onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                      disabled={loading}
                    />
                    <Label
                      htmlFor="rememberMe"
                      className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-primary-foreground"
                    >
                      Remember me
                    </Label>
                  </div>

                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? (
                      <span className="flex items-center justify-center">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing in...
                      </span>
                    ) : (
                      "Sign in"
                    )}
                  </Button>
                </form>
              </Form>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300 p-3 rounded-md text-sm">
                {error}
              </div>
            )}

            <div className="text-center text-sm">
              <span className="text-muted-foreground">Don&apos;t have an account? </span>
              <Link href={`/signup/${role}`} className="text-primary hover:underline">
                Sign up
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
        </motion.div>
      </div>
    </div>
  );
};

export default SignInForm;