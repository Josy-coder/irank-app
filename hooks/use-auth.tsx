"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { useQuery, useMutation, useAction } from "convex/react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"

type UserRole = "student" | "school_admin" | "volunteer" | "admin"

type User = {
  id: string
  name: string
  email: string
  phone?: string
  role: UserRole
  status: string
  verified: boolean
  gender?: string
  date_of_birth?: string
  grade?: string
  national_id?: string
  position?: string
  high_school_attended?: string
  profile_image?: string
  mfa_enabled?: boolean
  last_login_at?: number
  school: {
    id: string
    name: string
    type: string
    status: string
    verified: boolean
  } | null
}

type AuthContextType = {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  signUp: (userData: SignUpData) => Promise<void>
  signIn: (email: string, password: string, rememberMe?: boolean, mfaCode?: string, expectedRole?: string) => Promise<SignInResult>
  signInWithPhone: (data: PhoneSignInData, expectedRole?: string) => Promise<void>
  signOut: () => Promise<void>
  refreshToken: () => Promise<void>
  generateMagicLink: (email: string, purpose: MagicLinkPurpose) => Promise<void>
  verifyMagicLink: (token: string) => Promise<MagicLinkResult>
  resetPassword: (resetToken: string, newPassword: string) => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  enableMFA: (currentPassword: string) => Promise<void>
  disableMFA: (currentPassword: string) => Promise<void>
  updateSecurityQuestion: (question: string, answer: string, currentPassword: string) => Promise<void>
}

type SignUpData = {
  name: string
  email: string
  phone?: string
  password: string
  role: UserRole
  gender?: "male" | "female" | "non_binary"
  date_of_birth?: string
  school_id?: Id<"schools">
  grade?: string
  security_question?: string
  security_answer?: string
  position?: string
  school_data?: {
    name: string
    type: "Private" | "Public" | "Government Aided" | "International"
    country: string
    province?: string
    district?: string
    sector?: string
    cell?: string
    village?: string
    contact_name: string
    contact_email: string
    contact_phone?: string
  }
  high_school_attended?: string
  national_id?: string
  safeguarding_certificate?: Id<"_storage">
}

type PhoneSignInData = {
  name_search: string
  selected_user_id: Id<"users">
  phone: string
  security_answer: string
}

type MagicLinkPurpose = "login" | "password_reset"

type SignInResult = {
  success: boolean
  requiresMFA?: boolean
  userId?: string
  message?: string
  securityQuestion?: string
  expectedRole?: string
}

type MagicLinkResult = {
  success: boolean
  purpose: string
  token?: string
  resetToken?: string
  user?: {
    id: string
    name: string
    email: string
    role?: string
    status?: string
    verified?: boolean
    school_id?: string
  }
  expiresAt?: number
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const TOKEN_KEY = "irank_auth_token"
const USER_KEY = "irank_user_data"

function getErrorMessage(error: string): string {
  const errorMap: Record<string, string> = {
    "The email or password you entered is incorrect. Please try again.": "The email or password you entered is incorrect. Please try again.",
    "Your account has been temporarily locked due to too many failed login attempts. Please try again later.": "Your account has been temporarily locked due to too many failed login attempts. Please try again later.",
    "Your account has been suspended. Please contact support.": "Your account has been suspended. Please contact support.",
    "Your account is pending approval. Please wait for admin verification.": "Your account is pending approval. Please wait for admin verification.",
    "Multi-factor authentication is required. Please enter your MFA code.": "Multi-factor authentication is required. Please enter your MFA code.",
    "The security answer you provided is incorrect. Please try again.": "The security answer you provided is incorrect. Please try again.",
    "We couldn't find a security question for this user.": "We couldn't find a security question for this user.",
    "An account with this email already exists. Please use a different email or sign in.": "An account with this email already exists. Please use a different email or sign in.",
    "An account with this phone number already exists. Please use a different number.": "An account with this phone number already exists. Please use a different number.",
    "Please select your school to continue registration.": "Please select your school to continue registration.",
    "Both phone number and security question are required for student registration.": "Both phone number and security question are required for student registration.",
    "Please provide school details to register as a school administrator.": "Please provide school details to register as a school administrator.",
    "Please provide your high school and national ID to register as a volunteer.": "Please provide your high school and national ID to register as a volunteer.",
    "Your session is invalid or has expired. Please sign in again.": "Your session is invalid or has expired. Please sign in again.",
    "This password reset link is invalid or has expired.": "This password reset link is invalid or has expired.",
    "No account was found with the provided details.": "No account was found with the provided details.",
    "This magic link has expired. Please request a new one.": "This magic link has expired. Please request a new one.",
    "This magic link has already been used. Please request a new one.": "This magic link has already been used. Please request a new one.",
    "The password you entered is incorrect.": "The password you entered is incorrect.",
    "Multi-factor authentication is only available for school administrators, volunteers, and administrators.": "Multi-factor authentication is only available for school administrators, volunteers, and administrators.",
  };

  for (const key in errorMap) {
    if (error.includes(key)) {
      return errorMap[key];
    }
  }

  return "Something went wrong. Please try again or contact support if the problem persists.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  const signUpMutation = useMutation(api.functions.auth.signUp)
  const signInMutation = useMutation(api.functions.auth.signIn)
  const signInWithPhoneMutation = useMutation(api.functions.auth.signInWithPhone)
  const signOutMutation = useMutation(api.functions.auth.signOut)
  const refreshTokenMutation = useMutation(api.functions.auth.refreshToken)
  const generateMagicLinkMutation = useMutation(api.functions.auth.generateMagicLink)
  const verifyMagicLinkMutation = useMutation(api.functions.auth.verifyMagicLink)
  const resetPasswordMutation = useMutation(api.functions.auth.resetPassword)
  const changePasswordMutation = useMutation(api.functions.auth.changePassword)
  const enableMFAMutation = useMutation(api.functions.auth.enableMFA)
  const disableMFAMutation = useMutation(api.functions.auth.disableMFA)
  const updateSecurityQuestionMutation = useMutation(api.functions.auth.updateSecurityQuestion)
  const sendWelcomeEmail = useAction(api.functions.email.sendWelcomeEmail);
  const sendMagicLinkEmail = useAction(api.functions.email.sendMagicLinkEmail);

  const currentUser = useQuery(
    api.functions.auth.getCurrentUser,
    token ? { token } : "skip"
  )

  useEffect(() => {
    const isAuthPage =
      pathname === "/" || pathname.startsWith("/signin") || pathname.startsWith("/signup");

    if (isAuthPage && user) {
      const dashboardPath =
        user.role === "school_admin" ? "/school/dashboard" : `/${user.role}/dashboard`;
      router.push(dashboardPath);
    }
  }, [pathname, user, router]);


  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY)
    const storedUser = localStorage.getItem(USER_KEY)

    if (storedToken && storedUser) {
      try {
        setToken(storedToken)
        setUser(JSON.parse(storedUser))
      } catch (error) {
        console.error("Error parsing stored user data:", error)
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
      }
    }
    setIsLoading(false)
  }, [])

  const getDeviceInfo = () => ({
    user_agent: navigator.userAgent,
    platform: navigator.platform,
    device_id: localStorage.getItem("device_id") || generateDeviceId(),
  })

  const generateDeviceId = () => {
    const deviceId = Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    localStorage.setItem("device_id", deviceId)
    return deviceId
  }

  const handleSignOut = async () => {
    if (token) {
      try {
        await signOutMutation({
          token,
          device_id: localStorage.getItem("device_id") || undefined,
        })
      } catch (error) {
        console.error("Error during sign out:", error)
      }
    }

    setToken(null)
    setUser(null)
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    router.push("/")
  }

  useEffect(() => {
    if (currentUser !== undefined) {
      if (currentUser) {
        setUser({
          ...currentUser,
          role: currentUser.role as UserRole,
        })
        localStorage.setItem(USER_KEY, JSON.stringify(currentUser))
      } else if (token) {
        handleSignOut()
      }
      setIsLoading(false)
    }
  }, [currentUser, token])

  const signUp = async (userData: SignUpData) => {
    try {
      setIsLoading(true)

      const result = await signUpMutation({
        ...userData,
        device_info: getDeviceInfo(),
      })

      if (result.success) {
        try {
          await sendWelcomeEmail({
            email: userData.email,
            name: userData.name,
            role: userData.role,
          });
        } catch (err) {
          console.error("Failed to send email:", err);
        }

        toast.success(result.message);
        router.push("/");
      }
    } catch (error: any) {
      console.error("Sign up error:", error)
      const friendlyMessage = getErrorMessage(error.message)
      toast.error(friendlyMessage)
      throw new Error(friendlyMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const signIn = async (email: string, password: string, rememberMe = false, mfaCode?: string, expectedRole?: string): Promise<SignInResult> => {
    try {
      setIsLoading(true)

      const result = await signInMutation({
        email,
        password,
        remember_me: rememberMe,
        mfa_code: mfaCode,
        device_info: getDeviceInfo(),
        expected_role: expectedRole || ""
      })

      if (result.requiresMFA) {
        return {
          success: false,
          requiresMFA: true,
          userId: result.userId,
          message: result.message,
          securityQuestion: result.securityQuestion || undefined,
        }
      }

      if (result.success && result.token && result.user) {
        setToken(result.token)

        const userWithSchool: User = {
          ...result.user,
          school: null,
        } as User

        setUser(userWithSchool)
        localStorage.setItem(TOKEN_KEY, result.token)
        localStorage.setItem(USER_KEY, JSON.stringify(userWithSchool))

        const dashboardPath = result.user.role === 'school_admin'
          ? '/school/dashboard'
          : `/${result.user.role}/dashboard`
        router.push(dashboardPath)
        toast.success("Signed in successfully!")

        return { success: true }
      }

      return { success: false, message: "Sign in failed" }
    } catch (error: any) {
      console.error("Sign in error:", error)
      const friendlyMessage = getErrorMessage(error.message)
      toast.error(friendlyMessage)
      throw new Error(friendlyMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const signInWithPhone = async (data: PhoneSignInData, expectedRole?: string) => {
    try {
      setIsLoading(true)

      const result = await signInWithPhoneMutation({
        ...data,
        device_info: getDeviceInfo(),
        expected_role: expectedRole || "student",
      })

      if (result.success && result.token && result.user) {
        setToken(result.token)

        const userWithSchool: User = {
          ...result.user,
          school: null,
        } as User

        setUser(userWithSchool)
        localStorage.setItem(TOKEN_KEY, result.token)
        localStorage.setItem(USER_KEY, JSON.stringify(userWithSchool))

        const dashboardPath = (result.user.role as UserRole) === 'school_admin'
          ? '/school/dashboard'
          : `/${result.user.role}/dashboard`;
        router.push(dashboardPath)
        toast.success("Signed in successfully!")
      }
    } catch (error: any) {
      console.error("Phone sign in error:", error)
      const friendlyMessage = getErrorMessage(error.message)
      toast.error(friendlyMessage)
      throw new Error(friendlyMessage)
    } finally {
      setIsLoading(false)
    }
  }
  
  const generateMagicLink = async (email: string, purpose: MagicLinkPurpose) => {
    try {
      const result = await generateMagicLinkMutation({
        email,
        purpose,
      })

      if (result.success) {
        try {
          await sendMagicLinkEmail({
            email,
            purpose,
            token: result.token,
          });
        } catch (err) {
          console.error("Failed to send magic link email:", err);
        }
        toast.success(result.message)
      }
    } catch (error: any) {
      console.error("Generate magic link error:", error)
      const friendlyMessage = getErrorMessage(error.message)
      toast.error(friendlyMessage)
      throw new Error(friendlyMessage)
    }
  }

  const verifyMagicLink = async (token: string): Promise<MagicLinkResult> => {
    try {
      setIsLoading(true)

      const result = await verifyMagicLinkMutation({
        token,
        device_info: getDeviceInfo(),
      })

      if (result.success) {
        if (result.purpose === "login" && result.token && result.user) {
          setToken(result.token)

          const userWithSchool: User = {
            ...result.user,
            school: null,
          } as User

          setUser(userWithSchool)
          localStorage.setItem(TOKEN_KEY, result.token)
          localStorage.setItem(USER_KEY, JSON.stringify(userWithSchool))

          const dashboardPath = result.user.role === 'school_admin'
            ? '/school/dashboard'
            : `/${result.user.role}/dashboard`
          router.push(dashboardPath)
          toast.success("Signed in successfully!")
        } else if (result.purpose === "password_reset") {
          toast.success("Magic link verified. You can now reset your password.")
        }
      }

      return result
    } catch (error: any) {
      console.error("Verify magic link error:", error)
      const friendlyMessage = getErrorMessage(error.message)
      toast.error(friendlyMessage)
      throw new Error(friendlyMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const resetPassword = async (resetToken: string, newPassword: string) => {
    try {
      const result = await resetPasswordMutation({
        reset_token: resetToken,
        new_password: newPassword,
      })

      if (result.success) {
        toast.success(result.message)
        router.push("/")
      }
    } catch (error: any) {
      console.error("Reset password error:", error)
      const friendlyMessage = getErrorMessage(error.message)
      toast.error(friendlyMessage)
      throw new Error(friendlyMessage)
    }
  }

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!token) throw new Error("Authentication required")

    try {
      const result = await changePasswordMutation({
        current_password: currentPassword,
        new_password: newPassword,
        token,
      })

      if (result.success) {
        toast.success(result.message)
      }
    } catch (error: any) {
      console.error("Change password error:", error)
      const friendlyMessage = getErrorMessage(error.message)
      toast.error(friendlyMessage)
      throw new Error(friendlyMessage)
    }
  }

  const enableMFA = async (currentPassword: string) => {
    if (!token) throw new Error("Authentication required")

    try {
      const result = await enableMFAMutation({
        current_password: currentPassword,
        token,
      })

      if (result.success) {
        toast.success(result.message)
        if (user) {
          setUser({ ...user, mfa_enabled: true })
        }
      }
    } catch (error: any) {
      console.error("Enable MFA error:", error)
      const friendlyMessage = getErrorMessage(error.message)
      toast.error(friendlyMessage)
      throw new Error(friendlyMessage)
    }
  }

  const disableMFA = async (currentPassword: string) => {
    if (!token) throw new Error("Authentication required")

    try {
      const result = await disableMFAMutation({
        current_password: currentPassword,
        token,
      })

      if (result.success) {
        toast.success(result.message)
        if (user) {
          setUser({ ...user, mfa_enabled: false })
        }
      }
    } catch (error: any) {
      console.error("Disable MFA error:", error)
      const friendlyMessage = getErrorMessage(error.message)
      toast.error(friendlyMessage)
      throw new Error(friendlyMessage)
    }
  }
  
  const updateSecurityQuestion = async (question: string, answer: string, currentPassword: string) => {
    if (!token) throw new Error("Authentication required")

    try {
      const result = await updateSecurityQuestionMutation({
        question,
        answer,
        current_password: currentPassword,
        token,
      })

      if (result.success) {
        toast.success(result.message)
      }
    } catch (error: any) {
      console.error("Update security question error:", error)
      const friendlyMessage = getErrorMessage(error.message)
      toast.error(friendlyMessage)
      throw new Error(friendlyMessage)
    }
  }

  const refreshToken = async () => {
    if (!token) return

    try {
      const result = await refreshTokenMutation({
        token,
        device_info: getDeviceInfo(),
      })

      if (result.success && result.token) {
        setToken(result.token)
        localStorage.setItem(TOKEN_KEY, result.token)
      }
    } catch (error) {
      console.error("Token refresh error:", error)
      handleSignOut()
    }
  }

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!token && !!user,
    isLoading,
    signUp,
    signIn,
    signInWithPhone,
    signOut: handleSignOut,
    refreshToken,
    generateMagicLink,
    verifyMagicLink,
    resetPassword,
    changePassword,
    enableMFA,
    disableMFA,
    updateSecurityQuestion,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

export function useRequireAuth(requiredRole?: UserRole) {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/")
      return
    }

    if (!isLoading && user && requiredRole && user.role !== requiredRole) {
      toast.error("Access denied. Insufficient permissions.")
      router.push("/")
      return
    }
  }, [isAuthenticated, isLoading, user, requiredRole, router])

  return {
    user,
    isAuthenticated,
    isLoading,
    hasRequiredRole: !requiredRole || (user?.role === requiredRole),
  }
}

export function useRoleAccess() {
  const { user } = useAuth()

  const isAdmin = () => user?.role === "admin"
  const isSchoolAdmin = () => user?.role === "school_admin"
  const isVolunteer = () => user?.role === "volunteer"
  const isStudent = () => user?.role === "student"
  const isVerified = () => user?.verified === true
  const isActive = () => user?.status === "active"

  const canAccessAdminFeatures = () => isAdmin()
  const canAccessSchoolFeatures = () => isAdmin() || isSchoolAdmin()
  const canAccessVolunteerFeatures = () => isAdmin() || isVolunteer()
  const canAccessStudentFeatures = () => isAdmin() || isSchoolAdmin() || isStudent()

  return {
    user,
    isAdmin,
    isSchoolAdmin,
    isVolunteer,
    isStudent,
    isVerified,
    isActive,
    canAccessAdminFeatures,
    canAccessSchoolFeatures,
    canAccessVolunteerFeatures,
    canAccessStudentFeatures,
  }
}

export function useOfflineSync() {
  const [isOffline, setIsOffline] = useState(false)
  const [isOfflineValid, setIsOfflineValid] = useState(false)
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "error">("idle")

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false)
      setSyncStatus("syncing")
      setTimeout(() => setSyncStatus("idle"), 2000)
    }

    const handleOffline = () => {
      setIsOffline(true)
      const hasOfflineData = localStorage.getItem(TOKEN_KEY) && localStorage.getItem(USER_KEY)
      setIsOfflineValid(!!hasOfflineData)
    }

    setIsOffline(!navigator.onLine)
    if (!navigator.onLine) {
      const hasOfflineData = localStorage.getItem(TOKEN_KEY) && localStorage.getItem(USER_KEY)
      setIsOfflineValid(!!hasOfflineData)
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  return {
    isOffline,
    isOfflineValid,
    syncStatus,
  }
}