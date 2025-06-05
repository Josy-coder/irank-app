"use client"

import { useState, useEffect } from 'react'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { HardDrive, Trash2 } from 'lucide-react'
import { useOfflineFiles } from '@/lib/pwa/pwa-utils'
import { Button } from '@/components/ui/button'

export function OfflineStorageIndicator() {
  const { getStorageUsage, clearCompletedFiles } = useOfflineFiles()
  const [usage, setUsage] = useState({ used: 0, total: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const updateUsage = async () => {
      try {
        const storageInfo = await getStorageUsage()
        setUsage(storageInfo)
      } catch (error) {
        console.error('Failed to get storage usage:', error)
      } finally {
        setLoading(false)
      }
    }

    updateUsage()

    // Update every 30 seconds
    const interval = setInterval(updateUsage, 30000)
    return () => clearInterval(interval)
  }, [getStorageUsage])

  const handleClearStorage = async () => {
    setLoading(true)
    try {
      await clearCompletedFiles()
      const storageInfo = await getStorageUsage()
      setUsage(storageInfo)
    } catch (error) {
      console.error('Failed to clear storage:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center space-x-2">
        <HardDrive className="h-4 w-4" />
        <span className="text-sm">Loading...</span>
      </div>
    )
  }

  const percentage = usage.total > 0 ? Math.round((usage.used / usage.total) * 100) : 0
  const usedMB = Math.round(usage.used / (1024 * 1024))
  const totalMB = Math.round(usage.total / (1024 * 1024))

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <HardDrive className="h-4 w-4" />
          <span className="text-sm font-medium">Offline Storage</span>
          <Badge variant={percentage > 80 ? 'destructive' : percentage > 60 ? 'secondary' : 'default'}>
            {percentage}%
          </Badge>
        </div>
        {usage.used > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearStorage}
            className="h-6 px-2"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
      <div className="space-y-1">
        <Progress value={percentage} className="h-2" />
        <div className="text-xs text-muted-foreground">
          {usedMB} MB of {totalMB} MB used
        </div>
      </div>
    </div>
  )
}