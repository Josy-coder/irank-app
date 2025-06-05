import { useCallback, useEffect, useRef, useState } from "react";

export interface ConvexOfflineState {
  isOffline: boolean
  isOnline: boolean
  lastOnlineAt: Date | null
  lastOfflineAt: Date | null
  connectionType: string | null
  effectiveType: string | null
  downlink: number | null
  rtt: number | null
  convexConnected: boolean
  lastConvexDisconnect: Date | null
  lastConvexConnect: Date | null
}

export interface ConvexOfflineDetectorOptions {
  pingInterval?: number
  pingTimeout?: number
  maxRetries?: number
  onOnline?: () => void
  onOffline?: () => void
  onConnectionChange?: (state: ConvexOfflineState) => void
}

const DEFAULT_OPTIONS: Required<ConvexOfflineDetectorOptions> = {
  pingInterval: 30000,
  pingTimeout: 5000,
  maxRetries: 2,
  onOnline: () => {},
  onOffline: () => {},
  onConnectionChange: () => {},
}

class ConvexOfflineDetector {
  private static instance: ConvexOfflineDetector | null = null
  private options: Required<ConvexOfflineDetectorOptions>
  private state: ConvexOfflineState
  private listeners: Set<(state: ConvexOfflineState) => void> = new Set()
  private pingInterval: NodeJS.Timeout | null = null
  private retryCount = 0
  private isChecking = false
  private convexConnectionStatus = true

  constructor(options: ConvexOfflineDetectorOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
    this.state = {
      isOffline: !navigator.onLine,
      isOnline: navigator.onLine,
      lastOnlineAt: navigator.onLine ? new Date() : null,
      lastOfflineAt: !navigator.onLine ? new Date() : null,
      connectionType: this.getConnectionType(),
      effectiveType: this.getEffectiveType(),
      downlink: this.getDownlink(),
      rtt: this.getRTT(),
      convexConnected: true,
      lastConvexDisconnect: null,
      lastConvexConnect: new Date(),
    }

    this.init()
  }

  static getInstance(options?: ConvexOfflineDetectorOptions): ConvexOfflineDetector {
    if (!ConvexOfflineDetector.instance) {
      ConvexOfflineDetector.instance = new ConvexOfflineDetector(options)
    }
    return ConvexOfflineDetector.instance
  }

  private init() {
    window.addEventListener('online', this.handleOnline)
    window.addEventListener('offline', this.handleOffline)

    if ('connection' in navigator) {
      const connection = (navigator as any).connection
      connection?.addEventListener('change', this.handleConnectionChange)
    }

    this.startPingCheck()

    this.checkConnectivity()
  }

  public updateConvexStatus(connected: boolean) {
    const wasConnected = this.convexConnectionStatus
    this.convexConnectionStatus = connected

    console.log(`[ConvexOfflineDetector] Convex connection status: ${connected}`)

    if (wasConnected !== connected) {
      this.updateState({
        convexConnected: connected,
        lastConvexConnect: connected ? new Date() : this.state.lastConvexConnect,
        lastConvexDisconnect: !connected ? new Date() : this.state.lastConvexDisconnect,
      })

      if (!connected) {
        this.handleConvexDisconnect()
      } else {
        this.handleConvexConnect()
      }
    }
  }

  private handleConvexDisconnect() {
    console.log('[ConvexOfflineDetector] Convex disconnected - checking connectivity')
    this.checkConnectivity()
  }

  private handleConvexConnect() {
    console.log('[ConvexOfflineDetector] Convex connected - likely back online')
    this.updateState({
      isOffline: false,
      isOnline: true,
      lastOnlineAt: new Date()
    })
    this.retryCount = 0
  }

  private handleOnline = () => {
    console.log('[ConvexOfflineDetector] Browser online event')
    this.verifyConnection()
  }

  private handleOffline = () => {
    console.log('[ConvexOfflineDetector] Browser offline event')
    this.updateState({
      isOffline: true,
      isOnline: false,
      lastOfflineAt: new Date()
    })
  }

  private handleConnectionChange = () => {
    console.log('[ConvexOfflineDetector] Connection change event')
    this.updateState({
      connectionType: this.getConnectionType(),
      effectiveType: this.getEffectiveType(),
      downlink: this.getDownlink(),
      rtt: this.getRTT(),
    })

    this.verifyConnection()
  }

  private startPingCheck() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
    }

    this.pingInterval = setInterval(() => {
      if (!this.convexConnectionStatus || this.state.isOffline) {
        this.checkConnectivity()
      }
    }, this.options.pingInterval)
  }

  private async checkConnectivity(): Promise<boolean> {
    if (this.isChecking) return this.state.isOnline

    this.isChecking = true

    try {
      if (!navigator.onLine) {
        console.log('[ConvexOfflineDetector] navigator.onLine is false')
        this.updateState({
          isOffline: true,
          isOnline: false,
          lastOfflineAt: new Date()
        })
        return false
      }

      if (this.convexConnectionStatus) {
        console.log('[ConvexOfflineDetector] Convex connected - assuming online')
        this.updateState({
          isOffline: false,
          isOnline: true,
          lastOnlineAt: new Date()
        })
        this.retryCount = 0
        return true
      }

      const isConnected = await this.pingExternalServer()

      if (isConnected) {
        console.log('[ConvexOfflineDetector] External ping successful - online')
        this.retryCount = 0
        this.updateState({
          isOffline: false,
          isOnline: true,
          lastOnlineAt: new Date()
        })
        return true
      } else {
        this.retryCount++
        console.log(`[ConvexOfflineDetector] External ping failed - retry ${this.retryCount}/${this.options.maxRetries}`)

        if (this.retryCount >= this.options.maxRetries) {
          console.log('[ConvexOfflineDetector] Max retries reached - marking as offline')
          this.updateState({
            isOffline: true,
            isOnline: false,
            lastOfflineAt: new Date()
          })
          this.retryCount = 0
        }
        return false
      }
    } catch (error) {
      console.log('[ConvexOfflineDetector] Connectivity check failed:', error)
      this.retryCount++

      if (this.retryCount >= this.options.maxRetries) {
        console.log('[ConvexOfflineDetector] Max retries reached after error - marking as offline')
        this.updateState({
          isOffline: true,
          isOnline: false,
          lastOfflineAt: new Date()
        })
        this.retryCount = 0
      }
      return false
    } finally {
      this.isChecking = false
    }
  }

  private async verifyConnection(): Promise<void> {
    setTimeout(() => {
      this.checkConnectivity()
    }, 100)
  }

  private async pingExternalServer(): Promise<boolean> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.options.pingTimeout)

      const endpoints = [
        'https://httpbin.org/status/200',
        'https://jsonplaceholder.typicode.com/posts/1',
        'https://api.github.com/zen',
      ]

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, {
            method: 'HEAD',
            mode: 'no-cors',
            cache: 'no-cache',
            signal: controller.signal,
          })

          clearTimeout(timeoutId)
          return true
        } catch (error) {
          continue
        }
      }

      clearTimeout(timeoutId)
      return false
    } catch (error) {
      return false
    }
  }

  private updateState(updates: Partial<ConvexOfflineState>) {
    const prevState = { ...this.state }
    this.state = { ...this.state, ...updates }

    if (prevState.isOffline !== this.state.isOffline) {
      if (this.state.isOffline) {
        this.options.onOffline()
      } else {
        this.options.onOnline()
      }
    }

    this.options.onConnectionChange(this.state)

    this.listeners.forEach(listener => listener(this.state))
  }

  private getConnectionType(): string | null {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection
      return connection?.type || null
    }
    return null
  }

  private getEffectiveType(): string | null {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection
      return connection?.effectiveType || null
    }
    return null
  }

  private getDownlink(): number | null {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection
      return connection?.downlink || null
    }
    return null
  }

  private getRTT(): number | null {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection
      return connection?.rtt || null
    }
    return null
  }

  public getState(): ConvexOfflineState {
    return { ...this.state }
  }

  public subscribe(listener: (state: ConvexOfflineState) => void): () => void {
    this.listeners.add(listener)

    listener(this.state)

    return () => {
      this.listeners.delete(listener)
    }
  }

  public async forceCheck(): Promise<boolean> {
    return await this.checkConnectivity()
  }

  public destroy() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }

    window.removeEventListener('online', this.handleOnline)
    window.removeEventListener('offline', this.handleOffline)

    if ('connection' in navigator) {
      const connection = (navigator as any).connection
      connection?.removeEventListener('change', this.handleConnectionChange)
    }

    this.listeners.clear()
    ConvexOfflineDetector.instance = null
  }
}

export function useConvexOfflineDetector(options?: ConvexOfflineDetectorOptions) {
  const [state, setState] = useState<ConvexOfflineState>(() => {
    const detector = ConvexOfflineDetector.getInstance(options)
    return detector.getState()
  })

  const detectorRef = useRef<ConvexOfflineDetector>()

  useEffect(() => {
    detectorRef.current = ConvexOfflineDetector.getInstance(options)

    return detectorRef.current.subscribe(setState)
  }, [])

  const forceCheck = useCallback(async () => {
    if (detectorRef.current) {
      return await detectorRef.current.forceCheck()
    }
    return false
  }, [])

  const updateConvexStatus = useCallback((connected: boolean) => {
    if (detectorRef.current) {
      detectorRef.current.updateConvexStatus(connected)
    }
  }, [])

  return {
    ...state,
    forceCheck,
    updateConvexStatus,
  }
}

export function useConvexConnectionStatus() {
  const { updateConvexStatus } = useConvexOfflineDetector()

  useEffect(() => {
    const handleConvexOnline = () => {
      console.log('[ConvexConnectionStatus] Convex client connected')
      updateConvexStatus(true)
    }

    const handleConvexOffline = () => {
      console.log('[ConvexConnectionStatus] Convex client disconnected')
      updateConvexStatus(false)
    }

    const originalWebSocket = window.WebSocket
    let connectionCount = 0

    window.WebSocket = class extends originalWebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols)

        if (url.toString().includes('convex.cloud') || url.toString().includes('convex')) {
          connectionCount++

          this.addEventListener('open', handleConvexOnline)
          this.addEventListener('close', handleConvexOffline)
          this.addEventListener('error', handleConvexOffline)
        }
      }
    }

    return () => {
      window.WebSocket = originalWebSocket
    }
  }, [updateConvexStatus])

  return { updateConvexStatus }
}

export function useIsOffline(): boolean {
  const { isOffline } = useConvexOfflineDetector()
  return isOffline
}

export function useIsOnline(): boolean {
  const { isOnline } = useConvexOfflineDetector()
  return isOnline
}

export function useConnectionQuality(): {
  quality: 'good' | 'poor' | 'offline' | 'unknown'
  effectiveType: string | null
  downlink: number | null
  rtt: number | null
  convexConnected: boolean
} {
  const { isOffline, effectiveType, downlink, rtt, convexConnected } = useConvexOfflineDetector()

  if (isOffline) {
    return { quality: 'offline', effectiveType, downlink, rtt, convexConnected }
  }

  if (effectiveType) {
    if (effectiveType === '4g' || effectiveType === '5g') {
      return { quality: 'good', effectiveType, downlink, rtt, convexConnected }
    } else if (effectiveType === '3g' || effectiveType === '2g') {
      return { quality: 'poor', effectiveType, downlink, rtt, convexConnected }
    }
  }

  return { quality: 'unknown', effectiveType, downlink, rtt, convexConnected }
}