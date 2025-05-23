"use client"

import { useState, useEffect, useCallback, useContext, createContext } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { toast } from "sonner"

type User = {
  id: string
  name: string
  email: string
  phone?: string
  role: string
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

type AuthState = {
  user: User | null
  token: string | null
  isLoading: boolean
  isOffline: boolean
  isAuthenticated: boolean
  isOfflineValid: boolean
}

type AuthContextType = {
  user: User | null
  token: string | null
  isLoading: boolean
  isOffline: boolean
  isAuthenticated: boolean
  isOfflineValid: boolean
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<void>
  signInWithPhone: (nameSearch: string, selectedUserId: string, phone: string, securityAnswer: string) => Promise<void>
  signUp: (data: SignUpData) => Promise<void>
  signOut: () => Promise<void>
  requestMagicLink: (email: string, purpose: string) => Promise<void>
  verifyMagicLink: (token: string) => Promise<void>
  refreshToken: () => Promise<void>
  updateOfflineStatus: (isOffline: boolean) => void
}

type SignUpData = {
  name: string
  email: string
  phone?: string
  password: string
  role: "student" | "school_admin" | "volunteer" | "admin"
  gender?: "male" | "female" | "non_binary"
  date_of_birth?: string
  school_id?: string
  grade?: string
  security_question?: string
  security_answer?: string
  position?: string
  school_data?: any
  high_school_attended?: string
  national_id?: string
}

const AuthContext = createContext<AuthContextType | null>(null)

const TOKEN_KEY = "irank_auth_token"
const USER_KEY = "irank_auth_user"
const OFFLINE_EXPIRY_KEY = "irank_offline_expiry"

function getDeviceInfo() {
  return {
    user_agent: navigator.userAgent,
    platform: navigator.platform,
    device_id: getDeviceId(),
    ip_address: undefined,
  }
}

function getDeviceId(): string {
  let deviceId = localStorage.getItem("irank_device_id")
  if (!deviceId) {
    deviceId = crypto.randomUUID()
    localStorage.setItem("irank_device_id", deviceId)
  }
  return deviceId
}

function persistAuthData(token: string, user: User, offlineExpiry: number) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  localStorage.setItem(OFFLINE_EXPIRY_KEY, offlineExpiry.toString())
}

function clearAuthData() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem(OFFLINE_EXPIRY_KEY)
}

function getPersistedAuthData(): { token: string | null; user: User | null; isOfflineValid: boolean } {
  const token = localStorage.getItem(TOKEN_KEY)
  const userStr = localStorage.getItem(USER_KEY)
  const offlineExpiryStr = localStorage.getItem(OFFLINE_EXPIRY_KEY)

  if (!token || !userStr || !offlineExpiryStr) {
    return { token: null, user: null, isOfflineValid: false }
  }

  const offlineExpiry = parseInt(offlineExpiryStr)
  const isOfflineValid = Date.now() < offlineExpiry

  try {
    const user = JSON.parse(userStr)
    return { token, user, isOfflineValid }
  } catch {
    clearAuthData()
    return { token: null, user: null, isOfflineValid: false }
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    isLoading: true,
    isOffline: false,
    isAuthenticated: false,
    isOfflineValid: false,
  })

  const router = useRouter()
  const pathname = usePathname()

  const signInMutation = useMutation(api.functions.auth.signIn)
  const signInWithPhoneMutation = useMutation(api.functions.auth.signInWithPhone)
  const signUpMutation = useMutation(api.functions.auth.signUp)
  const signOutMutation = useMutation(api.functions.auth.signOut)
  const refreshTokenMutation = useMutation(api.functions.auth.refreshToken)
  const requestMagicLinkMutation = useMutation(api.functions.auth.requestMagicLink)
  const verifyMagicLinkMutation = useMutation(api.functions.auth.verifyMagicLink)

  const currentUserQuery = useQuery(
    api.functions.auth.getCurrentUser,
    authState.token && !authState.isOffline ? { token: authState.token } : "skip"
  )

  useEffect(() => {
    const handleOnline = () => {
      setAuthState(prev => ({ ...prev, isOffline: false }))
    }

    const handleOffline = () => {
      setAuthState(prev => ({ ...prev, isOffline: true }))
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Set initial state
    setAuthState(prev => ({ ...prev, isOffline: !navigator.onLine }))

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    const { token, user, isOfflineValid } = getPersistedAuthData()

    setAuthState(prev => ({
      ...prev,
      token,
      user,
      isAuthenticated: !!user,
      isOfflineValid,
      isLoading: false,
    }))
  }, [])

  useEffect(() => {
    if (currentUserQuery !== undefined && !authState.isOffline) {
      if (currentUserQuery) {
        const offlineExpiry = Date.now() + (2 * 24 * 60 * 60 * 1000)
        persistAuthData(authState.token!, currentUserQuery, offlineExpiry)

        setAuthState(prev => ({
          ...prev,
          user: currentUserQuery,
          isAuthenticated: true,
          isOfflineValid: true,
          isLoading: false,
        }))
      } else if (authState.token) {
        // Token is invalid, clear auth
        clearAuthData()
        setAuthState(prev => ({
          ...prev,
          user: null,
          token: null,
          isAuthenticated: false,
          isOfflineValid: false,
          isLoading: false,
        }))
      }
    }
  }, [currentUserQuery, authState.isOffline, authState.token])

  const signIn = useCallback(async (email: string, password: string, rememberMe = false) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }))

      const result = await signInMutation({
        email,
        password,
        device_info: getDeviceInfo(),
        remember_me: rememberMe,
      })

      const offlineExpiry = Date.now() + (2 * 24 * 60 * 60 * 1000)
      persistAuthData(result.token, result.user, offlineExpiry)

      setAuthState(prev => ({
        ...prev,
        token: result.token,
        user: result.user,
        isAuthenticated: true,
        isOfflineValid: true,
        isLoading: false,
      }))

      toast.success("Signed in successfully!")

      // Redirect to dashboard
      const dashboardPath = getDashboardPath(result.user.role)
      router.push(dashboardPath)

    } catch (error: any) {
      setAuthState(prev => ({ ...prev, isLoading: false }))
      toast.error(error.message || "Failed to sign in")
      throw error
    }
  }, [signInMutation, router])

  const signInWithPhone = useCallback(async (
    nameSearch: string,
    selectedUserId: string,
    phone: string,
    securityAnswer: string
  ) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }))

      const result = await signInWithPhoneMutation({
        name_search: nameSearch,
        selected_user_id: selectedUserId,
        phone,
        security_answer: securityAnswer,
        device_info: getDeviceInfo(),
      })

      const offlineExpiry = Date.now() + (2 * 24 * 60 * 60 * 1000)
      persistAuthData(result.token, result.user, offlineExpiry)

      setAuthState(prev => ({
        ...prev,
        token: result.token,
        user: result.user,
        isAuthenticated: true,
        isOfflineValid: true,
        isLoading: false,
      }))

      toast.success("Signed in successfully!")

      // Redirect to dashboard
      const dashboardPath = getDashboardPath(result.user.role)
      router.push(dashboardPath)

    } catch (error: any) {
      setAuthState(prev => ({ ...prev, isLoading: false }))
      toast.error(error.message || "Failed to sign in")
      throw error
    }
  }, [signInWithPhoneMutation, router])

  const signUp = useCallback(async (data: SignUpData) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }))

      await signUpMutation({
        ...data,
        device_info: getDeviceInfo(),
      })

      setAuthState(prev => ({ ...prev, isLoading: false }))
      toast.success("Account created successfully! Please wait for admin approval.")

      // Redirect to sign in
      router.push(`/signin/${data.role}`)

    } catch (error: any) {
      setAuthState(prev => ({ ...prev, isLoading: false }))
      toast.error(error.message || "Failed to create account")
      throw error
    }
  }, [signUpMutation, router])

  const signOut = useCallback(async () => {
    try {
      if (authState.token && !authState.isOffline) {
        await signOutMutation({
          token: authState.token,
          device_id: getDeviceId(),
        })
      }
    } catch (error) {
    } finally {
      clearAuthData()
      setAuthState({
        user: null,
        token: null,
        isLoading: false,
        isOffline: authState.isOffline,
        isAuthenticated: false,
        isOfflineValid: false,
      })

      toast.success("Signed out successfully")
      router.push("/")
    }
  }, [authState.token, authState.isOffline, signOutMutation, router])

  const requestMagicLink = useCallback(async (email: string, purpose: string) => {
    try {
      await requestMagicLinkMutation({ email, purpose })
      toast.success("Magic link sent to your email!")
    } catch (error: any) {
      toast.error(error.message || "Failed to send magic link")
      throw error
    }
  }, [requestMagicLinkMutation])

  const verifyMagicLink = useCallback(async (token: string) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }))

      const result = await verifyMagicLinkMutation({
        token,
        device_info: getDeviceInfo(),
      })

      const offlineExpiry = Date.now() + (2 * 24 * 60 * 60 * 1000)
      persistAuthData(result.token, result.user, offlineExpiry)

      setAuthState(prev => ({
        ...prev,
        token: result.token,
        user: result.user,
        isAuthenticated: true,
        isOfflineValid: true,
        isLoading: false,
      }))

      toast.success("Signed in successfully!")

      // Redirect to dashboard
      const dashboardPath = getDashboardPath(result.user.role)
      router.push(dashboardPath)

    } catch (error: any) {
      setAuthState(prev => ({ ...prev, isLoading: false }))
      toast.error(error.message || "Invalid or expired magic link")
      throw error
    }
  }, [verifyMagicLinkMutation, router])

  const refreshToken = useCallback(async () => {
    if (!authState.token || authState.isOffline) return

    try {
      const result = await refreshTokenMutation({
        token: authState.token,
        device_info: getDeviceInfo(),
      })

      const offlineExpiry = Date.now() + (2 * 24 * 60 * 60 * 1000)
      if (authState.user) {
        persistAuthData(result.token, authState.user, offlineExpiry)
      }

      setAuthState(prev => ({
        ...prev,
        token: result.token,
        isOfflineValid: true,
      }))
    } catch (error) {
      await signOut()
    }
  }, [authState.token, authState.isOffline, authState.user, refreshTokenMutation, signOut])

  const updateOfflineStatus = useCallback((isOffline: boolean) => {
    setAuthState(prev => ({ ...prev, isOffline }))
  }, [])


  useEffect(() => {
    if (!authState.token || authState.isOffline) return

    const interval = setInterval(() => {
      refreshToken()
    }, 6 * 60 * 60 * 1000)

    return () => clearInterval(interval)
  }, [authState.token, authState.isOffline, refreshToken])

  const contextValue: AuthContextType = {
    user: authState.user,
    token: authState.token,
    isLoading: authState.isLoading,
    isOffline: authState.isOffline,
    isAuthenticated: authState.isAuthenticated,
    isOfflineValid: authState.isOfflineValid,
    signIn,
    signInWithPhone,
    signUp,
    signOut,
    requestMagicLink,
    verifyMagicLink,
    refreshToken,
    updateOfflineStatus,
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
      </AuthContext.Provider>
  )
}

function getDashboardPath(role: string): string {
  switch (role) {
    case "student":
      return "/dashboard/student"
    case "school_admin":
      return "/dashboard/school"
    case "volunteer":
      return "/dashboard/volunteer"
    case "admin":
      return "/dashboard/admin"
    default:
      return "/dashboard"
  }
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

export function useRequireAuth(requiredRole?: string) {
  const auth = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (auth.isLoading) return

    if (!auth.isAuthenticated && !auth.isOfflineValid) {
      router.push("/")
      return
    }

    if (auth.user && requiredRole && auth.user.role !== requiredRole) {
      const correctDashboard = getDashboardPath(auth.user.role)
      if (pathname !== correctDashboard) {
        router.push(correctDashboard)
      }
      return
    }

    if (auth.user && !auth.user.verified) {
      toast.warning("Your account is pending admin approval. Some features may be limited.")
    }
  }, [auth.isLoading, auth.isAuthenticated, auth.isOfflineValid, auth.user, requiredRole, router, pathname])

  return auth
}

export function useRoleAccess() {
  const { user } = useAuth()

  const hasRole = useCallback((role: string | string[]) => {
    if (!user) return false
    if (Array.isArray(role)) {
      return role.includes(user.role)
    }
    return user.role === role
  }, [user])

  const isAdmin = useCallback(() => hasRole("admin"), [hasRole])
  const isSchoolAdmin = useCallback(() => hasRole("school_admin"), [hasRole])
  const isVolunteer = useCallback(() => hasRole("volunteer"), [hasRole])
  const isStudent = useCallback(() => hasRole("student"), [hasRole])
  const isVerified = useCallback(() => user?.verified ?? false, [user])

  return {
    hasRole,
    isAdmin,
    isSchoolAdmin,
    isVolunteer,
    isStudent,
    isVerified,
  }
}

export function useOfflineSync() {
  const { isOffline, isOfflineValid } = useAuth()

  return {
    isOffline,
    isOfflineValid,
    canUseApp: !isOffline || isOfflineValid,
    syncStatus: isOffline
      ? (isOfflineValid ? "offline_valid" : "offline_expired")
      : "online"
  }
}