"use client"

import { Suspense, useEffect, useState, useRef } from "react";
import { useSearchParams} from "next/navigation"
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
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Eye, EyeOff, Loader2, CheckCircle, AlertCircle, UserCog, FileText, ShieldEllipsis} from "lucide-react";
import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
import { useAuth } from "@/hooks/use-auth"
import AppLoader from "@/components/app-loader";
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { FileUpload } from "@/components/file-upload"
import { Id } from "@/convex/_generated/dataModel"

const resetPasswordSchema = z.object({
  password: z.string()
    .min(8, { message: "Password must be at least 8 characters long" })
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
      message: "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

const securityQuestionSchema = z.object({
  security_question: z.string().min(5, { message: "Security question is required" }),
  security_answer: z.string().min(2, { message: "Security answer is required" }),
})

const safeguardingSchema = z.object({
  safeguarding_certificate: z.string().min(1, { message: "Safeguarding certificate is required" }),
})

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>
type SecurityQuestionFormValues = z.infer<typeof securityQuestionSchema>
type SafeguardingFormValues = z.infer<typeof safeguardingSchema>

function ResetPasswordForm() {
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(true)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [resetToken, setResetToken] = useState<string | null>(null)
  const [userInfo, setUserInfo] = useState<any>(null)
  const [currentStep, setCurrentStep] = useState<"password" | "security" | "safeguarding">("password")
  const [isAdminCreated, setIsAdminCreated] = useState(false)
  const [safeguardingCertificateId, setSafeguardingCertificateId] = useState<Id<"_storage"> | null>(null)

  const hasVerified = useRef(false)
  const verificationAttempted = useRef(false)

  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const { verifyMagicLink, resetPassword } = useAuth()
  const updateSecurityQuestion = useMutation(api.functions.auth.updateSecurityQuestion)
  const updateSafeguardingCertificate = useMutation(api.functions.admin.users.updateSafeguardingCertificate)

  const passwordForm = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  })

  const securityForm = useForm<SecurityQuestionFormValues>({
    resolver: zodResolver(securityQuestionSchema),
    defaultValues: {
      security_question: "",
      security_answer: "",
    },
  })

  const safeguardingForm = useForm<SafeguardingFormValues>({
    resolver: zodResolver(safeguardingSchema),
    defaultValues: {
      safeguarding_certificate: "",
    },
  })

  const securityQuestions = [
    "What was the name of your first pet?",
    "What is your mother's maiden name?",
    "What was the name of your elementary school?",
    "What is your favorite book?",
    "In what city were you born?",
    "What is your favorite color?",
    "What was your first car?",
    "What is your favorite food?",
  ]

  useEffect(() => {
    const verifyToken = async () => {

      if (!token || hasVerified.current || verificationAttempted.current) {
        if (!token && !verificationAttempted.current) {
          setError("Invalid or missing reset token")
          setVerifying(false)
          verificationAttempted.current = true
        }
        return
      }

      verificationAttempted.current = true

      try {
        console.log("Verifying token:", token)

        const result = await verifyMagicLink(token)
        console.log("Verification result:", result)

        if (result.success && result.purpose === "password_reset") {
          setResetToken(result.resetToken!)
          setUserInfo(result.user)

          if (result.user?.verified && result.user?.status === "inactive") {
            setIsAdminCreated(true)
          }

          hasVerified.current = true
          setVerifying(false)
        } else {
          console.error("Invalid verification result:", result)
          setError("Invalid reset link")
          setVerifying(false)
        }
      } catch (error: any) {
        console.error("Token verification error:", error)

        if (error.message.includes("already been used")) {
          setError("This reset link has already been used. Please request a new one.")
        } else if (error.message.includes("expired")) {
          setError("This reset link has expired. Please request a new one.")
        } else {
          setError(error.message || "Invalid or expired reset link")
        }

        setVerifying(false)
      }
    }

    verifyToken()
  }, [token, verifyMagicLink])

  const handlePasswordSubmit = async (values: ResetPasswordFormValues) => {
    if (!resetToken) {
      setError("Invalid reset session")
      return
    }

    setLoading(true)
    setError(null)

    try {
      await resetPassword(resetToken, values.password)
      if (userInfo?.role === "student") {
        setCurrentStep("security")
      } else if (userInfo?.role === "volunteer" && isAdminCreated) {
        setCurrentStep("safeguarding")
      } else {
        setSuccess(true)
      }
    } catch (error: any) {
      console.error("Reset password error:", error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSecurityQuestionSubmit = async (values: SecurityQuestionFormValues) => {
    if (!userInfo) return

    setLoading(true)
    setError(null)

    try {
      await updateSecurityQuestion({
        question: values.security_question,
        answer: values.security_answer,
        current_password: passwordForm.getValues("password"),
        token: resetToken!,
      })

      setSuccess(true)
    } catch (error: any) {
      console.error("Security question update error:", error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSafeguardingSubmit = async () => {
    if (!safeguardingCertificateId || !userInfo) return

    setLoading(true)
    setError(null)

    try {
      await updateSafeguardingCertificate({
        user_id: userInfo.id,
        safeguarding_certificate: safeguardingCertificateId,
      })

      setSuccess(true)
    } catch (error: any) {
      console.error("Safeguarding certificate update error:", error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleFileUploaded = (storageId: Id<"_storage">) => {
    setSafeguardingCertificateId(storageId)
    safeguardingForm.setValue("safeguarding_certificate", storageId)
    safeguardingForm.clearErrors("safeguarding_certificate")
  }

  const skipCurrentStep = () => {
    if (currentStep === "security") {
      if (userInfo?.role === "volunteer" && isAdminCreated) {
        setCurrentStep("safeguarding")
      } else {
        setSuccess(true)
      }
    } else if (currentStep === "safeguarding") {
      setSuccess(true)
    }
  }

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-bl from-orange-400 via-orange-50 to-orange-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md"
        >
          <Card className="border border-[#E2E8F0]">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Image
                src="/images/logo.png"
                alt="iRankHub Logo"
                width={80}
                height={80}
                className="mx-auto mb-6"
              />
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-lg font-medium mb-2">Verifying reset link...</p>
              <p className="text-sm text-muted-foreground text-center">
                Please wait while we verify your password reset link.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-bl from-orange-400 via-orange-50 to-orange-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md"
        >
          <Card className="border border-[#E2E8F0]">
            <CardHeader className="text-center pb-6">
              <Image
                src="/images/logo.png"
                alt="iRankHub Logo"
                width={80}
                height={80}
                className="mx-auto mb-4"
              />
              <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <CardTitle className="text-lg">Account setup complete!</CardTitle>
              <CardDescription className="text-sm">
                {isAdminCreated ? (
                  "Your account has been set up successfully. You can now sign in with your new credentials."
                ) : (
                  "Your password has been successfully updated. You can now sign in with your new password."
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                asChild
                className="w-full"
              >
                <Link href={`/signin/${userInfo?.role || 'student'}`}>
                  Continue to Sign In
                </Link>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  if (error && !resetToken) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-bl from-orange-400 via-orange-50 to-orange-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md"
        >
          <Card className="border border-[#E2E8F0]">
            <CardHeader className="text-center pb-6">
              <Image
                src="/images/logo.png"
                alt="iRankHub Logo"
                width={80}
                height={80}
                className="mx-auto mb-4"
              />
              <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
              <CardTitle className="text-lg">Invalid reset link</CardTitle>
              <CardDescription className="text-sm">
                This password reset link is invalid, has expired, or has already been used. Please request a new one.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>

              <Button asChild className="w-full">
                <Link href="/forgot-password">
                  Request new reset link
                </Link>
              </Button>

              <div className="text-center">
                <Link
                  href="/"
                  className="text-xs text-primary hover:underline transition-colors"
                >
                  Back to sign in
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  if (currentStep === "safeguarding") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-bl from-orange-400 via-orange-50 to-orange-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md"
        >
          <Card className="border border-[#E2E8F0]">
            <CardHeader className="text-center">
              <Image
                src="/images/logo.png"
                alt="iRankHub Logo"
                width={80}
                height={80}
                className="mx-auto mb-4"
              />
              <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-orange-600" />
              </div>
              <CardTitle className="text-xl">Upload Safeguarding Certificate</CardTitle>
              <CardDescription className="text-base">
                As a volunteer, please upload your safeguarding certificate to complete your account setup.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <Form {...safeguardingForm}>
                <FormField
                  control={safeguardingForm.control}
                  name="safeguarding_certificate"
                  render={() => (
                    <FormItem>
                      <FileUpload
                        onUpload={handleFileUploaded}
                        accept={["application/pdf", "image/jpeg", "image/jpg", "image/png"]}
                        maxSize={5 * 1024 * 1024}
                        label="Safeguarding Certificate"
                        description="Upload your safeguarding certificate. PDF or image files accepted (max 5MB)."
                        required={true}
                        disabled={loading}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </Form>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Button
                  onClick={handleSafeguardingSubmit}
                  disabled={loading || !safeguardingCertificateId}
                  className="w-full h-11"
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </span>
                  ) : (
                    "Complete Setup"
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={skipCurrentStep}
                  className="w-full h-11"
                  disabled={loading}
                >
                  Skip for Now
                </Button>
              </div>

              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-700">
                  <strong>Note:</strong> You can upload your safeguarding certificate later in your profile settings.
                  However, you may be prompted to upload it each time you sign in until it&#39;s provided.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  if (currentStep === "security") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-bl from-orange-400 via-orange-50 to-orange-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md"
        >
          <Card className="border border-[#E2E8F0]">
            <CardHeader className="text-center">
              <Image
                src="/images/logo.png"
                alt="iRankHub Logo"
                width={80}
                height={80}
                className="mx-auto mb-4"
              />
              <div className="mx-auto w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                <UserCog className="h-8 w-8 text-purple-600" />
              </div>
              <CardTitle className="text-xl">Set Security Question</CardTitle>
              <CardDescription className="text-base">
                As a student, please set up your security question for phone authentication.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <Form {...securityForm}>
                <form onSubmit={securityForm.handleSubmit(handleSecurityQuestionSubmit)} className="space-y-4">
                  <FormField
                    control={securityForm.control}
                    name="security_question"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Security Question</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={loading}>
                          <FormControl>
                            <SelectTrigger className="h-11">
                              <SelectValue placeholder="Select a security question" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {securityQuestions.map((question, index) => (
                              <SelectItem key={index} value={question}>
                                {question}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={securityForm.control}
                    name="security_answer"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Security Answer</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter your answer"
                            {...field}
                            disabled={loading}
                            className="h-11"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Button type="submit" disabled={loading} className="w-full h-11">
                      {loading ? (
                        <span className="flex items-center justify-center">
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating...
                        </span>
                      ) : (
                        "Set Security Question"
                      )}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={skipCurrentStep}
                      className="w-full h-11"
                      disabled={loading}
                    >
                      Skip for Now
                    </Button>
                  </div>
                </form>
              </Form>

              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-700">
                  <strong>Note:</strong> You can update your security question later in your profile settings.
                  It&#39;s used for phone-based authentication.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-bl from-orange-400 via-orange-50 to-orange-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <Card className="border border-[#E2E8F0]">
          <CardHeader className="text-center">
            <Image
              src="/images/logo.png"
              alt="iRankHub Logo"
              width={80}
              height={80}
              className="mx-auto mb-4"
            />
            <CardDescription className="text-sm">
              {userInfo && (
                <span>
                  {isAdminCreated ? (
                    <>Welcome! Create a secure password for <strong>{userInfo.email}</strong></>
                  ) : (
                    <>Create a new secure password for <strong>{userInfo.email}</strong></>
                  )}
                </span>
              )}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Form {...passwordForm}>
              <form onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)} className="space-y-4">
                <FormField
                  control={passwordForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New password</FormLabel>
                      <div className="relative">
                        <FormControl>
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter your new password"
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

                <FormField
                  control={passwordForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm new password</FormLabel>
                      <div className="relative">
                        <FormControl>
                          <Input
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Confirm your new password"
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
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          tabIndex={-1}
                          disabled={loading}
                        >
                          {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" disabled={loading} size="sm" className="w-full">
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating password...
                    </span>
                  ) : (
                    isAdminCreated ? "Set Password" : "Update password"
                  )}
                </Button>
              </form>
            </Form>

            <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
              <div className="text-sm">
                <p className="font-medium text-amber-900 mb-2">Password requirements:</p>
                <ul className="text-amber-700 space-y-1 text-xs">
                  <li>• At least 8 characters long</li>
                  <li>• Contains uppercase and lowercase letters</li>
                  <li>• Contains at least one number</li>
                  <li>• Avoid using common words or personal information</li>
                </ul>
              </div>
            </div>

            {isAdminCreated && userInfo && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-700">
                  <strong>Welcome!</strong> Your account was created by an administrator.
                  {userInfo.role === "student" && " You'll be prompted to set up a security question next."}
                  {userInfo.role === "volunteer" && " You'll be prompted to upload your safeguarding certificate next."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AppLoader />}>
      <ResetPasswordForm />
    </Suspense>
  )
}