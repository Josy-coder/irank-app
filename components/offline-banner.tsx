"use client"

import { useState, useEffect } from "react"
import { WifiOff, Clock, CheckCircle, Wifi, AlertTriangle, Zap, X } from "lucide-react"
import { useConvexOfflineDetector, useConvexConnectionStatus } from "@/lib/pwa/offline-detector"

export function AdvancedOfflineBanner() {
  const {
    isOffline,
    isOnline,
    lastOfflineAt,
    effectiveType,
    downlink,
    rtt,
    convexConnected,
  } = useConvexOfflineDetector()

  useConvexConnectionStatus()

  const [showBanner, setShowBanner] = useState(false)
  const [justWentOnline, setJustWentOnline] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [previousOfflineState, setPreviousOfflineState] = useState(isOffline)
  const [previousConvexState, setPreviousConvexState] = useState(convexConnected)

  useEffect(() => {

    if (previousOfflineState !== isOffline) {
      setPreviousOfflineState(isOffline)

      if (isOffline) {
        setShowBanner(true)
        setDismissed(false)
        setJustWentOnline(false)
      } else {
        // Just went online
        setJustWentOnline(true)
        setShowBanner(true)
        setDismissed(false)

        // Hide the "back online" banner after 3 seconds
        const timer = setTimeout(() => {
          setShowBanner(false)
          setJustWentOnline(false)
        }, 3000)

        return () => clearTimeout(timer)
      }
    }

    // Detect Convex connection changes (when online but Convex disconnected)
    if (previousConvexState !== convexConnected && isOnline) {
      setPreviousConvexState(convexConnected)

      if (!convexConnected) {
        // Convex disconnected while online - show reconnecting banner
        setShowBanner(true)
        setDismissed(false)
        setJustWentOnline(false)
      } else if (convexConnected && !isOffline) {
        // Convex reconnected - show brief success message
        setJustWentOnline(true)
        setShowBanner(true)
        setDismissed(false)

        const timer = setTimeout(() => {
          setShowBanner(false)
          setJustWentOnline(false)
        }, 2000)

        return () => clearTimeout(timer)
      }
    }
  }, [isOffline, convexConnected, previousOfflineState, previousConvexState, isOnline])

  const getOfflineDuration = () => {
    if (!lastOfflineAt) return ""
    const now = new Date()
    const diffMs = now.getTime() - lastOfflineAt.getTime()
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

  const getConnectionQuality = () => {
    if (isOffline) return null

    if (effectiveType === '4g' || effectiveType === '5g') {
      return 'good'
    } else if (effectiveType === '3g') {
      return 'fair'
    } else if (effectiveType === '2g') {
      return 'slow'
    }

    // Fallback based on downlink speed
    if (downlink && downlink > 10) return 'good'
    if (downlink && downlink > 1.5) return 'fair'
    if (downlink && downlink > 0) return 'slow'

    return 'unknown'
  }

  const getBannerConfig = () => {
    if (justWentOnline) {
      const quality = getConnectionQuality()
      let qualityText = ''

      if (quality === 'good') qualityText = ' • Fast connection'
      else if (quality === 'fair') qualityText = ' • Good connection'
      else if (quality === 'slow') qualityText = ' • Slow connection'

      return {
        icon: <CheckCircle className="h-4 w-4" />,
        text: "Back Online",
        subtext: `Connection restored${qualityText}`,
        bgColor: "bg-green-500",
        textColor: "text-white",
        showDismiss: false,
      }
    } else if (isOffline) {
      // Check if we have offline capabilities (cached data)
      const hasOfflineData = typeof window !== 'undefined' &&
        localStorage.getItem("irank_auth_token") &&
        localStorage.getItem("irank_user_data")

      if (hasOfflineData) {
        return {
          icon: <Clock className="h-4 w-4 animate-pulse" />,
          text: "Offline Mode",
          subtext: `Working offline ${getOfflineDuration()} • Limited features available`,
          bgColor: "bg-amber-500",
          textColor: "text-white",
          showDismiss: true,
        }
      } else {
        return {
          icon: <WifiOff className="h-4 w-4 animate-bounce" />,
          text: "No Connection",
          subtext: `Offline ${getOfflineDuration()} • Please reconnect to continue`,
          bgColor: "bg-red-500",
          textColor: "text-white",
          showDismiss: true,
        }
      }
    } else if (isOnline && !convexConnected) {
      // Special case: HTTP works but Convex is disconnected
      return {
        icon: <Zap className="h-4 w-4 animate-pulse" />,
        text: "Reconnecting",
        subtext: `App services temporarily unavailable • Trying to reconnect...`,
        bgColor: "bg-blue-500",
        textColor: "text-white",
        showDismiss: true,
      }
    } else if (isOnline) {
      // Show connection quality info for slow connections
      const quality = getConnectionQuality()

      if (quality === 'slow') {
        return {
          icon: <AlertTriangle className="h-4 w-4" />,
          text: "Slow Connection",
          subtext: `Limited connectivity • Some features may be delayed`,
          bgColor: "bg-yellow-500",
          textColor: "text-white",
          showDismiss: true,
        }
      }
    }

    return null
  }

  const handleDismiss = () => {
    setDismissed(true)
    setShowBanner(false)
  }

  const config = getBannerConfig()

  // Don't show banner if dismissed, no config
  if (!showBanner || !config || dismissed) {
    return null
  }

  return (
    <div className={`relative z-50 ${config.bgColor} ${config.textColor} shadow-lg transition-all duration-300 ease-in-out transform ${showBanner ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}`}>
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <div className="flex-shrink-0">
              {config.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2">
                <span className="font-semibold text-sm">{config.text}</span>
                <span className="opacity-90 text-xs leading-tight">
                  {config.subtext}
                </span>
              </div>
            </div>
          </div>

          {config.showDismiss && (
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 ml-4 p-1 rounded-full hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Additional info for connection quality */}
        {isOnline && !isOffline && (effectiveType || downlink || !convexConnected) && (
          <div className="mt-2 pt-2 border-t border-white/20">
            <div className="flex items-center space-x-4 text-xs opacity-75">
              {effectiveType && (
                <div className="flex items-center space-x-1">
                  <Wifi className="h-3 w-3" />
                  <span>{effectiveType.toUpperCase()}</span>
                </div>
              )}
              {downlink && (
                <div>
                  <span>{downlink.toFixed(1)} Mbps</span>
                </div>
              )}
              {rtt && (
                <div>
                  <span>{rtt}ms latency</span>
                </div>
              )}
              <div className="flex items-center space-x-1">
                <div className={`w-2 h-2 rounded-full ${convexConnected ? 'bg-green-400' : 'bg-red-400'}`} />
                <span>{convexConnected ? 'Connected' : 'Disconnected'}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}