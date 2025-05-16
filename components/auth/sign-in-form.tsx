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
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { useAuthActions } from "@convex-dev/auth/react"
import { motion } from "framer-motion"
import Image from "next/image";

type UserRole = "student" | "school_admin" | "volunteer" | "admin"

interface SignInFormProps {
  role: UserRole
}

const formSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(1, { message: "Password is required" }),
})

type FormValues = z.infer<typeof formSchema>

const SignInForm = ({ role }: SignInFormProps) => {
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rememberMe, setRememberMe] = useState(false)

  const { signIn } = useAuthActions()
  const router = useRouter()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  const handleSignIn = async (values: FormValues) => {
    setLoading(true)
    setError(null)

    try {

      const formData = new FormData()
      formData.set("flow", "signIn")
      formData.set("email", values.email)
      formData.set("password", values.password)
      formData.set("role", role)

      await signIn("password", formData)

      toast.success("Signed in successfully!")

      router.push(`/dashboard/${role === 'school_admin' ? 'school' : role}`)
    } catch (error: any) {
      console.error("Signin error:", error)
      setError(error.message || "Failed to sign in. Please check your credentials.")
      toast.error(error.message || "Failed to sign in")
    } finally {
      setLoading(false)
    }
  }

  const getRoleName = (role: UserRole) => {
    switch (role) {
      case "student":
        return "Student"
      case "school_admin":
        return "School Admin"
      case "volunteer":
        return "Volunteer"
      case "admin":
        return "Admin"
      default:
        return role
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
        <h2 className="text-base md:text-lg font-bold dark:text-primary-foreground">Sign in as {getRoleName(role)}</h2>
        <p className="text-sm text-muted-foreground mt-2">Welcome back! Please sign in to continue</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSignIn)} className="mt-6 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
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

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300 p-3 rounded-md text-sm">
                {error}
              </div>
            )}

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
          </motion.div>
        </form>
      </Form>

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
  );
};

export default SignInForm;