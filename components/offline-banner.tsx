"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { WifiOff, Clock, CheckCircle } from "lucide-react"
import { useOfflineSync } from "@/hooks/useAuth"

export function AdvancedOfflineBanner() {
  const { isOffline, isOfflineValid, syncStatus } = useOfflineSync()
  const [showBanner, setShowBanner] = useState(false)
  const [justWentOnline, setJustWentOnline] = useState(false)
  const [offlineTime, setOfflineTime] = useState<Date | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (isOffline && !offlineTime) {
      setOfflineTime(new Date())
      setShowBanner(true)
      setDismissed(false)
    } else if (!isOffline && offlineTime) {
      setJustWentOnline(true)
      setOfflineTime(null)
      const timer = setTimeout(() => {
        setShowBanner(false)
        setJustWentOnline(false)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [isOffline, offlineTime])

  const getOfflineDuration = () => {
    if (!offlineTime) return ""
    const now = new Date()
    const diffMs = now.getTime() - offlineTime.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)

    if (diffHours > 0) {
      return `for ${diffHours}h ${diffMins % 60}m`
    } else if (diffMins > 0) {
      return `for ${diffMins}m`
    } else {
      return "just now"
    }
  }

  const getBannerConfig = () => {
    if (justWentOnline) {
      return {
        icon: <CheckCircle className="h-4 w-4" />,
        text: "Connected",
        subtext: "All features restored",
        bgColor: "bg-gradient-to-r from-green-500 to-green-600",
        textColor: "text-white",
        showDismiss: false,
      }
    } else if (isOffline && isOfflineValid) {
      return {
        icon: <Clock className="h-4 w-4 animate-pulse" />,
        text: "Offline Mode",
        subtext: `Working offline ${getOfflineDuration()} • Limited features`,
        bgColor: "bg-gradient-to-r from-amber-500 to-orange-500",
        textColor: "text-white",
        showDismiss: true,
      }
    } else if (isOffline && !isOfflineValid) {
      return {
        icon: <WifiOff className="h-4 w-4 animate-bounce" />,
        text: "Connection Lost",
        subtext: `Offline ${getOfflineDuration()} • Please reconnect`,
        bgColor: "bg-gradient-to-r from-red-500 to-red-600",
        textColor: "text-white",
        showDismiss: true,
      }
    }

    return null
  }

  const config = getBannerConfig()

  if (!showBanner || !config || dismissed) {
    return null
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className={`relative z-50 ${config.bgColor} ${config.textColor} shadow-xl border-b border-white/20`}
      >
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="flex-shrink-0"
              >
                {config.icon}
              </motion.div>
              <div className="min-w-0 flex-1">
                <motion.div
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="flex flex-col sm:flex-row sm:items-center sm:space-x-2"
                >
                  <span className="font-semibold text-sm">{config.text}</span>
                  <span className="opacity-90 text-xs leading-tight">
                    {config.subtext}
                  </span>
                </motion.div>
              </div>
            </div>

            {config.showDismiss && (
              <motion.button
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.4 }}
                onClick={() => setDismissed(true)}
                className="flex-shrink-0 ml-4 p-1 rounded-full hover:bg-white/20 transition-colors"
                aria-label="Dismiss"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
