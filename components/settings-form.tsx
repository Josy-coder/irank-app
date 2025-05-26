"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
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
  Fingerprint,
  Key,
  Lock,
  Settings,
  HelpCircle,
  AlertCircle,
  Save,
  Trash2
} from "lucide-react"
import { motion } from "framer-motion"
import { useAuth } from "@/hooks/useAuth"
import { toast } from "sonner"
import { Label } from "@/components/ui/label";

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

export default function SettingsPage() {
  const { user, changePassword, enableMFA, disableMFA, enableBiometric, disableBiometric, updateSecurityQuestion } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [mfaDialogOpen, setMfaDialogOpen] = useState(false)
  const [biometricDialogOpen, setBiometricDialogOpen] = useState(false)
  const [securityQuestionDialogOpen, setSecurityQuestionDialogOpen] = useState(false)
  const [deleteAccountDialogOpen, setDeleteAccountDialogOpen] = useState(false)

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
      toast.success("Password changed successfully!")
    } catch (error: any) {
      console.error("Password change error:", error)
      setError(error.message)
      toast.error("Failed to change password")
    } finally {
      setLoading(false)
    }
  }

  const handleMFAToggle = async (enabled: boolean, currentPassword: string) => {
    setLoading(true)
    setError(null)

    try {
      if (enabled) {
        await enableMFA(currentPassword)
        toast.success("Multi-factor authentication enabled!")
      } else {
        await disableMFA(currentPassword)
        toast.success("Multi-factor authentication disabled!")
      }
      setMfaDialogOpen(false)
    } catch (error: any) {
      console.error("MFA toggle error:", error)
      setError(error.message)
      toast.error(`Failed to ${enabled ? 'enable' : 'disable'} MFA`)
    } finally {
      setLoading(false)
    }
  }

  const handleBiometricToggle = async (enabled: boolean, currentPassword?: string) => {
    setLoading(true)
    setError(null)

    try {
      if (enabled) {
        // For enabling biometric, we'd need to create credentials first
        // This is a simplified version - you'd need actual WebAuthn implementation
        const credential = await navigator.credentials.create({
          publicKey: {
            challenge: new Uint8Array(32),
            rp: { name: "iRankHub" },
            user: {
              id: new TextEncoder().encode(user?.id),
              name: user?.email || "",
              displayName: user?.name || "",
            },
            pubKeyCredParams: [{ alg: -7, type: "public-key" }],
            timeout: 60000,
            attestation: "direct"
          }
        }) as PublicKeyCredential

        // Extract credential data (simplified)
        const credentialId = "mock-credential-id"
        const publicKey = "mock-public-key"

        await enableBiometric(credentialId, publicKey, navigator.userAgent)
        toast.success("Biometric authentication enabled!")
      } else {
        if (!currentPassword) {
          setError("Current password is required to disable biometric authentication")
          return
        }
        await disableBiometric(currentPassword)
        toast.success("Biometric authentication disabled!")
      }
      setBiometricDialogOpen(false)
    } catch (error: any) {
      console.error("Biometric toggle error:", error)
      setError(error.message)
      toast.error(`Failed to ${enabled ? 'enable' : 'disable'} biometric authentication`)
    } finally {
      setLoading(false)
    }
  }

  const handleSecurityQuestionUpdate = async (values: SecurityQuestionFormValues) => {
    setLoading(true)
    setError(null)

    try {
      await updateSecurityQuestion(values.question, values.answer, values.currentPassword)
      securityQuestionForm.reset()
      setSecurityQuestionDialogOpen(false)
      toast.success("Security question updated successfully!")
    } catch (error: any) {
      console.error("Security question update error:", error)
      setError(error.message)
      toast.error("Failed to update security question")
    } finally {
      setLoading(false)
    }
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
  const canUseBiometric = typeof window !== 'undefined' &&
    'navigator' in window &&
    'credentials' in navigator &&
    typeof navigator.credentials.create === 'function'

  return (
    <div className="container mx-auto py-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground">
              Manage your account security and preferences
            </p>
          </div>
          <Settings className="h-8 w-8 text-muted-foreground" />
        </div>
      </motion.div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Password Change */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
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

                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? (
                      <>
                        <Lock className="mr-2 h-4 w-4 animate-spin" />
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

        {/* Security Settings */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Settings
              </CardTitle>
              <CardDescription>
                Configure additional security measures for your account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Multi-Factor Authentication */}
              {canUseMFA && (
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="font-medium">Multi-Factor Authentication</div>
                    <div className="text-sm text-muted-foreground">
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

              {/* Biometric Authentication */}
              {canUseBiometric && (
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="font-medium">Biometric Authentication</div>
                    <div className="text-sm text-muted-foreground">
                      Use fingerprint or face recognition to sign in
                    </div>
                  </div>
                  <Dialog open={biometricDialogOpen} onOpenChange={setBiometricDialogOpen}>
                    <DialogTrigger asChild>
                      <Switch checked={user.biometric_enabled} />
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
                          {user.biometric_enabled ? 'Disable' : 'Enable'} Biometric Authentication
                        </DialogTitle>
                        <DialogDescription>
                          {user.biometric_enabled
                            ? 'Enter your current password to disable biometric authentication'
                            : 'Set up biometric authentication for this device'
                          }
                        </DialogDescription>
                      </DialogHeader>
                      <BiometricToggleDialog
                        enabled={!user.biometric_enabled}
                        onConfirm={handleBiometricToggle}
                        loading={loading}
                      />
                    </DialogContent>
                  </Dialog>
                </div>
              )}

              {/* Security Question (Students only) */}
              {user.role === "student" && (
                <div className="space-y-2">
                  <div className="font-medium">Security Question</div>
                  <div className="text-sm text-muted-foreground">
                    Update your security question for phone-based authentication
                  </div>
                  <Dialog open={securityQuestionDialogOpen} onOpenChange={setSecurityQuestionDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <HelpCircle className="mr-2 h-4 w-4" />
                        Update Security Question
                      </Button>
                    </DialogTrigger>
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
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Danger Zone */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertCircle className="h-5 w-5" />
              Danger Zone
            </CardTitle>
            <CardDescription>
              Irreversible and destructive actions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-950/20">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-red-900 dark:text-red-100">Delete Account</div>
                    <div className="text-sm text-red-700 dark:text-red-300">
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
                        <DialogDescription>
                          This action cannot be undone. This will permanently delete your account and remove all your data from our servers.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            This action is permanent and cannot be reversed. All your data will be lost forever.
                          </AlertDescription>
                        </Alert>
                        <p className="text-sm text-muted-foreground">
                          If you&#39;re sure you want to delete your account, contact our support team at support@irankdebate.com
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

// Helper components for dialogs
function MFAToggleDialog({
                           enabled,
                           onConfirm,
                           loading
                         }: {
  enabled: boolean
  onConfirm: (enabled: boolean, password: string) => void
  loading: boolean
}) {
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)

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
      <DialogFooter>
        <Button
          onClick={() => onConfirm(enabled, password)}
          disabled={!password || loading}
        >
          {loading ? "Processing..." : `${enabled ? 'Enable' : 'Disable'} MFA`}
        </Button>
      </DialogFooter>
    </div>
  )
}

function BiometricToggleDialog({
                                 enabled,
                                 onConfirm,
                                 loading
                               }: {
  enabled: boolean
  onConfirm: (enabled: boolean, password?: string) => void
  loading: boolean
}) {
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  if (enabled) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center p-8">
          <Fingerprint className="h-16 w-16 text-primary" />
        </div>
        <p className="text-center text-sm text-muted-foreground">
          Click the button below to set up biometric authentication for this device.
        </p>
        <DialogFooter>
          <Button
            onClick={() => onConfirm(true)}
            disabled={loading}
          >
            {loading ? "Setting up..." : "Set Up Biometric"}
          </Button>
        </DialogFooter>
      </div>
    )
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
      <DialogFooter>
        <Button
          onClick={() => onConfirm(false, password)}
          disabled={!password || loading}
        >
          {loading ? "Processing..." : "Disable Biometric"}
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
            {loading ? "Updating..." : "Update Security Question"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}