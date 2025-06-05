"use client"

import { useEffect, ReactNode } from 'react'
import { initializePWA } from '@/lib/pwa/pwa-utils'

interface PWAProviderProps {
  children: ReactNode
}

export function PWAProvider({ children }: PWAProviderProps) {
  useEffect(() => {
    initializePWA()

    console.log('[PWA] PWA Provider initialized')
  }, [])

  return <>{children}</>
}
