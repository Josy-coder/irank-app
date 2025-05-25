"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { useQuery, useMutation } from "convex/react"
import { useRouter } from "next/navigation"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"
import { hashPassword } from "@/lib/password";

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
  position?: string
  high_school_attended?: string
  profile_image?: string
  mfa_enabled?: boolean
  biometric_enabled?: boolean
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
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<void>
  signInWithPhone: (data: PhoneSignInData) => Promise<void>
  signOut: () => Promise<void>
  refreshToken: () => Promise<void>
}

type SignUpData = {
  name: string
  email: string
  phone?: string
  password_hash: string
  role: UserRole
  gender?: "male" | "female" | "non_binary"
  date_of_birth?: string
  school_id?: Id<"schools">
  grade?: string
  security_question?: string
  security_answer_hash?: string
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
  security_answer_hash: string
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const TOKEN_KEY = "irank_auth_token"
const USER_KEY = "irank_user_data"

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  const signUpMutation = useMutation(api.functions.auth.signUp)
  const signInMutation = useMutation(api.functions.auth.signIn)
  const signInWithPhoneMutation = useMutation(api.functions.auth.signInWithPhone)
  const signOutMutation = useMutation(api.functions.auth.signOut)
  const refreshTokenMutation = useMutation(api.functions.auth.refreshToken)

  const currentUser = useQuery(
    api.functions.auth.getCurrentUser,
    token ? { token } : "skip"
  )

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

      const password_hash = await hashPassword(userData.password_hash);
      const security_answer_hash = userData.security_answer_hash
        ? await hashPassword(userData.security_answer_hash.toLowerCase().trim())
        : undefined;

      const result = await signUpMutation({
        ...userData,
        password_hash,
        security_answer_hash,
        device_info: getDeviceInfo(),
      })

      if (result.success) {
        toast.success(result.message)
        router.push("/")
      }
    } catch (error: any) {
      console.error("Sign up error:", error)
      toast.error(error.message || "Failed to create account")
      throw error
    } finally {
      setIsLoading(false)
    }
  }
  const signIn = async (email: string, password: string, rememberMe = false) => {
    try {
      setIsLoading(true)

      const password_hash = await hashPassword(password)

      const result = await signInMutation({
        email,
        password_hash,
        remember_me: rememberMe,
        device_info: getDeviceInfo(),
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

        const dashboardPath = result.user.role === 'school_admin'
          ? '/school/dashboard'
          : `/${result.user.role}/dashboard`
        router.push(dashboardPath)
        toast.success("Signed in successfully!")
      }
    } catch (error: any) {
      console.error("Sign in error:", error)
      toast.error(error.message || "Failed to sign in")
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const signInWithPhone = async (data: PhoneSignInData) => {
    try {
      setIsLoading(true)
      const security_answer_hash = await hashPassword(data.security_answer_hash.toLowerCase().trim())

      const result = await signInWithPhoneMutation({
        ...data,
        security_answer_hash,
        device_info: getDeviceInfo(),
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
      toast.error(error.message || "Failed to sign in")
      throw error
    } finally {
      setIsLoading(false)
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

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    setIsOffline(!navigator.onLine)
    if (!navigator.onLine) {
      const hasOfflineData = localStorage.getItem(TOKEN_KEY) && localStorage.getItem(USER_KEY)
      setIsOfflineValid(!!hasOfflineData)
    }

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