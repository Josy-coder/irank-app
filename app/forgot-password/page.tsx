"use client"

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation"
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
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail, Loader2, CheckCircle, ArrowLeft, AlertCircle, ChevronLeft } from "lucide-react";
import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
import { useAuth } from "@/hooks/use-auth"
import AppLoader from "@/components/app-loader";

const forgotPasswordSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
})

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>

function ForgotPasswordForm() {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const role = searchParams.get("role") || "student"

  const { generateMagicLink } = useAuth()

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  })

  const handleSubmit = async (values: ForgotPasswordFormValues) => {
    setLoading(true)
    setError(null)

    try {
      await generateMagicLink(values.email, "password_reset")
      setSuccess(true)
    } catch (error: any) {
      console.error("Forgot password error:", error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case "school_admin":
        return "School Admin"
      case "volunteer":
        return "Volunteer"
      case "admin":
        return "Admin"
      case "student":
        return "Student"
      default:
        return "User"
    }
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
          <Card className="border-0 shadow-xl">
            <CardHeader className="text-center pb-6">
              <Image
                src="/images/logo.png"
                alt="iRankHub Logo"
                width={80}
                height={80}
                className="mx-auto mb-4"
              />
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <CardTitle className="text-xl">Check your email</CardTitle>
              <CardDescription className="text-base">
                We&#39;ve sent a password reset link to your email address.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <Mail className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-900 mb-1">
                      Email sent successfully
                    </p>
                    <p className="text-blue-700">
                      The reset link will expire in 15 minutes for security reasons.
                      If you don&#39;t see the email, check your spam folder.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Button asChild className="w-full">
                  <Link href={`/signin/${role}`}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Sign In
                  </Link>
                </Button>

                <Button
                  variant="outline"
                  onClick={() => handleSubmit(form.getValues())}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </span>
                  ) : (
                    "Send another email"
                  )}
                </Button>
              </div>

              <div className="text-center text-sm text-muted-foreground">
                <p>
                  Didn&#39;t receive the email? Check your spam folder or try again.
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
        <Card className="border-0 shadow-xl">
          <CardHeader className="text-center">
            <Image
              src="/images/logo.png"
              alt="iRankHub Logo"
              width={80}
              height={80}
              className="mx-auto mb-4"
            />
            <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
              <Mail className="h-8 w-8 text-orange-600" />
            </div>
            <CardTitle className="text-xl">Forgot your password?</CardTitle>
            <CardDescription className="text-base">
              No worries! Enter your email address and we&#39;ll send you a link to reset your password.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email address</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="Enter your email address"
                          {...field}
                          disabled={loading}
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

                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending reset link...
                    </span>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Send reset link
                    </>
                  )}
                </Button>

                <div className="text-center">
                  <Link
                    href={`/signin/${role}`}
                    className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    <ChevronLeft className="mr-1 h-3 w-3" />
                    Back to sign in
                  </Link>
                </div>
              </form>
            </Form>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start space-x-3">
                <div className="text-blue-600 mt-0.5">
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="text-sm">
                  <p className="font-medium text-blue-900 mb-1">
                    {getRoleDisplayName(role)} Account Recovery
                  </p>
                  <p className="text-blue-700">
                    Make sure to enter the email address associated with your {getRoleDisplayName(role).toLowerCase()} account.
                    The reset link will be valid for 15 minutes.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

export default function ForgotPasswordPage(){
  return (
    <Suspense fallback={<AppLoader />}>
      <ForgotPasswordForm />
    </Suspense>
  )
}