"use client"

import { useState } from "react";
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Eye,
  EyeOff,
  Shield,
  Key,
  HelpCircle,
  AlertCircle,
  Save,
  Trash2,
  Loader2,
  Monitor,
  Smartphone,
  Laptop
} from "lucide-react"
import { motion } from "framer-motion"
import { useAuth } from "@/hooks/useAuth"
import { toast } from "sonner"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Id } from "@/convex/_generated/dataModel";

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, { message: "Current password is required" }),
  newPassword: z.string()
    .min(8, { message: "Password must be at least 8 characters long" })
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
      message: "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    }),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

const securityQuestionSchema = z.object({
  question: z.string().min(5, { message: "Question must be at least 5 characters" }),
  answer: z.string().min(2, { message: "Answer must be at least 2 characters" }),
  currentPassword: z.string().min(1, { message: "Current password is required for security" }),
})

type PasswordChangeFormValues = z.infer<typeof passwordChangeSchema>
type SecurityQuestionFormValues = z.infer<typeof securityQuestionSchema>

export default function SettingsForm() {
  const {
    user,
    token,
    changePassword,
    enableMFA,
    disableMFA,
    updateSecurityQuestion
  } = useAuth()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [mfaDialogOpen, setMfaDialogOpen] = useState(false)
  const [securityQuestionDialogOpen, setSecurityQuestionDialogOpen] = useState(false)
  const [deleteAccountDialogOpen, setDeleteAccountDialogOpen] = useState(false)
  const [sessionsDialogOpen, setSessionsDialogOpen] = useState(false)

  const userSessions = useQuery(
    api.functions.auth.getUserSessions,
    token ? { token } : "skip"
  )

  const revokeSession = useMutation(api.functions.auth.revokeSession)

  const passwordForm = useForm<PasswordChangeFormValues>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  })

  const securityQuestionForm = useForm<SecurityQuestionFormValues>({
    resolver: zodResolver(securityQuestionSchema),
    defaultValues: {
      question: "",
      answer: "",
      currentPassword: "",
    },
  })

  const handlePasswordChange = async (values: PasswordChangeFormValues) => {
    setLoading(true)
    setError(null)

    try {
      await changePassword(values.currentPassword, values.newPassword)
      passwordForm.reset()
    } catch (error: any) {
      console.error("Password change error:", error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleMFAToggle = async (enabled: boolean, currentPassword: string, securityQuestion?: string, securityAnswer?: string) => {
    setLoading(true)
    setError(null)

    try {
      if (enabled) {
        if (securityQuestion && securityAnswer) {
          await updateSecurityQuestion(securityQuestion, securityAnswer, currentPassword)
        }
        await enableMFA(currentPassword)
      } else {
        await disableMFA(currentPassword)
      }
      setMfaDialogOpen(false)
    } catch (error: any) {
      console.error("MFA toggle error:", error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRevokeSession = async (sessionId: string) => {
    if (!token) return

    try {
      await revokeSession({
        session_id: sessionId as Id<"auth_sessions">,
        token,
      })

    } catch (error: any) {
      console.error("Revoke session error:", error)
    }
  }

  const handleSecurityQuestionUpdate = async (values: SecurityQuestionFormValues) => {
    setLoading(true)
    setError(null)

    try {
      await updateSecurityQuestion(values.question, values.answer, values.currentPassword)
      securityQuestionForm.reset()
      setSecurityQuestionDialogOpen(false)
    } catch (error: any) {
      console.error("Security question update error:", error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const getDeviceIcon = (deviceInfo: any) => {
    if (!deviceInfo) return <Monitor className="h-4 w-4" />

    const userAgent = deviceInfo.user_agent?.toLowerCase() || ""

    if (userAgent.includes("mobile") || userAgent.includes("android") || userAgent.includes("iphone")) {
      return <Smartphone className="h-4 w-4" />
    }

    return <Laptop className="h-4 w-4" />
  }

  const getDeviceName = (deviceInfo: any) => {
    if (!deviceInfo) return "Unknown Device"

    const userAgent = deviceInfo.user_agent || ""
    const platform = deviceInfo.platform || ""

    if (userAgent.includes("Chrome")) return `Chrome on ${platform}`
    if (userAgent.includes("Firefox")) return `Firefox on ${platform}`
    if (userAgent.includes("Safari")) return `Safari on ${platform}`
    if (userAgent.includes("Edge")) return `Edge on ${platform}`

    return platform || "Unknown Device"
  }

  if (!user) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  const canUseMFA = ["school_admin", "volunteer", "admin"].includes(user.role)

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground">
              Manage your account security and preferences
            </p>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-6 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                Change Password
              </CardTitle>
              <CardDescription>
                Update your password to keep your account secure
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...passwordForm}>
                <form onSubmit={passwordForm.handleSubmit(handlePasswordChange)} className="space-y-4">
                  <FormField
                    control={passwordForm.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Password</FormLabel>
                        <div className="relative">
                          <FormControl>
                            <Input
                              type={showCurrentPassword ? "text" : "password"}
                              placeholder="Enter current password"
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
                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                            tabIndex={-1}
                          >
                            {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid gap-2 md:grid-cols-2">
                    <FormField
                      control={passwordForm.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New Password</FormLabel>
                          <div className="relative">
                            <FormControl>
                              <Input
                                type={showNewPassword ? "text" : "password"}
                                placeholder="Enter new password"
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
                              onClick={() => setShowNewPassword(!showNewPassword)}
                              tabIndex={-1}
                            >
                              {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
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
                          <FormLabel>Confirm New Password</FormLabel>
                          <div className="relative">
                            <FormControl>
                              <Input
                                type={showConfirmPassword ? "text" : "password"}
                                placeholder="Confirm new password"
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
                            >
                              {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </Button>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

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
                        Changing...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Change Password
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Security Settings
              </CardTitle>
              <CardDescription>
                Configure additional security measures for your account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {canUseMFA && (
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="font-medium text-sm">Multi-Factor Authentication</div>
                    <div className="text-xs text-muted-foreground">
                      Add an extra layer of security using your security question
                    </div>
                  </div>
                  <Dialog open={mfaDialogOpen} onOpenChange={setMfaDialogOpen}>
                    <DialogTrigger asChild>
                      <Switch checked={user.mfa_enabled} />
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
                          {user.mfa_enabled ? 'Disable' : 'Enable'} Multi-Factor Authentication
                        </DialogTitle>
                        <DialogDescription>
                          {user.mfa_enabled
                            ? 'Enter your current password to disable MFA'
                            : 'Enter your current password to enable MFA'
                          }
                        </DialogDescription>
                      </DialogHeader>
                      <MFAToggleDialog
                        enabled={!user.mfa_enabled}
                        onConfirm={handleMFAToggle}
                        loading={loading}
                      />
                    </DialogContent>
                  </Dialog>
                </div>
              )}

              {user.role === "student" && (
                <div className="space-y-2">
                  <Dialog open={securityQuestionDialogOpen} onOpenChange={setSecurityQuestionDialogOpen}>
                    <div className="flex items-center space-x-1.5">
                      <div className="font-medium text-sm">Security Question</div>
                      <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <HelpCircle className="mr-2 h-4 w-4" />
                        Update Security Question
                      </Button>
                    </DialogTrigger>
                    </div>

                  <div className="text-xs text-muted-foreground">
                    Update your security question for phone-based authentication

                  </div>

                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Update Security Question</DialogTitle>
                        <DialogDescription>
                          Change your security question and answer for enhanced account recovery
                        </DialogDescription>
                      </DialogHeader>
                      <SecurityQuestionDialog
                        form={securityQuestionForm}
                        onSubmit={handleSecurityQuestionUpdate}
                        loading={loading}
                      />
                    </DialogContent>
                  </Dialog>
                </div>
              )}

              <div className="space-y-2">
                <div className="font-medium text-sm">Active Sessions</div>
                <div className="text-xs text-muted-foreground">
                  Manage devices that are currently signed in to your account
                </div>
                <Dialog open={sessionsDialogOpen} onOpenChange={setSessionsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Monitor className="mr-2 h-4 w-4" />
                      Manage Sessions
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Active Sessions</DialogTitle>
                      <DialogDescription>
                        These are the devices currently signed in to your account
                      </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-96">
                      <div className="space-y-4">
                        {userSessions ? (
                          userSessions.map((session) => (
                            <div
                              key={session.id}
                              className="flex items-center justify-between p-4 border rounded-lg"
                            >
                              <div className="flex items-center space-x-3">
                                {getDeviceIcon(session.device_info)}
                                <div>
                                  <div className="font-medium flex items-center gap-2">
                                    {getDeviceName(session.device_info)}
                                    {session.is_current && (
                                      <Badge variant="secondary" className="text-xs">
                                        Current
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    Last active: {session.last_used_at
                                    ? new Date(session.last_used_at).toLocaleString()
                                    : 'Unknown'
                                  }
                                  </div>
                                  {session.expires_at && (
                                    <div className="text-xs text-muted-foreground">
                                      Expires: {new Date(session.expires_at).toLocaleString()}
                                    </div>
                                  )}
                                </div>
                              </div>
                              {!session.is_current && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRevokeSession(session.id)}
                                >
                                  Revoke
                                </Button>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-4 text-muted-foreground">
                            Loading sessions...
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertCircle className="h-4 w-4" />
              Danger Zone
            </CardTitle>
            <CardDescription className="text-sm">
              Irreversible and destructive actions
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            <div className="space-y-4">
              <div className="p-4 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-950/20">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-red-900 dark:text-red-100">Delete Account</div>
                    <div className="text-xs text-red-700 dark:text-red-300">
                      Permanently delete your account and all associated data
                    </div>
                  </div>
                  <Dialog open={deleteAccountDialogOpen} onOpenChange={setDeleteAccountDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Account
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle className="text-red-600">Delete Account</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            This action is permanent and cannot be reversed. All your data will be lost forever.
                          </AlertDescription>
                        </Alert>
                        <p className="text-sm text-muted-foreground">
                          If you&#39;re sure you want to delete your account, contact our support team at info@debaterwanda.org
                        </p>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteAccountDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button variant="destructive" disabled>
                          Contact Support
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

function MFAToggleDialog({
                           enabled,
                           onConfirm,
                           loading
                         }: {
  enabled: boolean
  onConfirm: (enabled: boolean, password: string, securityQuestion?: string, securityAnswer?: string) => void
  loading: boolean
}) {
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [securityQuestion, setSecurityQuestion] = useState("")
  const [securityAnswer, setSecurityAnswer] = useState("")

  const handleSubmit = () => {
    if (enabled) {
      if (!securityQuestion.trim() || !securityAnswer.trim()) {
        toast.error("Security question and answer are required for MFA")
        return
      }
      onConfirm(enabled, password, securityQuestion, securityAnswer)
    } else {
      onConfirm(enabled, password)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">Current Password</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your current password"
            className="pr-10"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-full px-3 py-2"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </Button>
        </div>
      </div>

      {enabled && (
        <>
          <div className="space-y-2">
            <Label htmlFor="securityQuestion">Security Question</Label>
            <Input
              id="securityQuestion"
              value={securityQuestion}
              onChange={(e) => setSecurityQuestion(e.target.value)}
              placeholder="e.g., What was your first pet's name?"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="securityAnswer">Security Answer</Label>
            <Input
              id="securityAnswer"
              value={securityAnswer}
              onChange={(e) => setSecurityAnswer(e.target.value)}
              placeholder="Your answer"
            />
          </div>

          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              This security question will be used for multi-factor authentication when signing in.
            </AlertDescription>
          </Alert>
        </>
      )}

      <DialogFooter>
        <Button
          onClick={handleSubmit}
          disabled={!password || loading || (enabled && (!securityQuestion.trim() || !securityAnswer.trim()))}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            `${enabled ? 'Enable' : 'Disable'} MFA`
          )}
        </Button>
      </DialogFooter>
    </div>
  )
}


function SecurityQuestionDialog({
                                  form,
                                  onSubmit,
                                  loading
                                }: {
  form: any
  onSubmit: (values: SecurityQuestionFormValues) => void
  loading: boolean
}) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="question"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Security Question</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., What was your first pet's name?"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="answer"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Answer</FormLabel>
              <FormControl>
                <Input
                  placeholder="Your answer"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="currentPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Current Password</FormLabel>
              <div className="relative">
                <FormControl>
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your current password"
                    {...field}
                    className="pr-10"
                  />
                </FormControl>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 py-2"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <DialogFooter>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              "Update Security Question"
            )}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}