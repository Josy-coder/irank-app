"use client"

import { useAuth } from "@/hooks/useAuth"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import {
  User,
  Settings,
  LogOut,
  ChevronDown,
  Bluetooth,
  BluetoothConnected,
  CloudOff,
  Scan,
  Loader,
  AlertCircle,
  X,
  Share,
  Database,
  Clock
} from "lucide-react"
import Link from "next/link"
import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { NotificationCenter } from "@/components/notifications/notification-center"
import { useConvexOfflineDetector } from "@/lib/pwa/offline-detector"
import { useBluetoothP2PSync } from "@/hooks/useBluetoothP2PSync"
import { useOfflineSync } from "@/hooks/useOffline"
import { SimpleOfflineManager } from "@/hooks/useOffline"

interface IndexedDBItem {
  key: string
  data: any
  timestamp: number
  size: number
  selected: boolean
}

function ConnectionStatusIndicator() {
  const { isOffline } = useConvexOfflineDetector()
  const { queueCount } = useOfflineSync()

  if (isOffline) {
    return (
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
          <CloudOff className="w-2.5 h-2.5 text-white" />
          {queueCount > 0 && (
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
          )}
        </div>
    )
  }

  return (
      <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
  )
}

async function getAllIndexedDBItems(): Promise<IndexedDBItem[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve([])
      return
    }

    const request = indexedDB.open('irank-offline-cache', 1)

    request.onsuccess = () => {
      const db = request.result
      const transaction = db.transaction(['cache'], 'readonly')
      const store = transaction.objectStore('cache')
      const getAllRequest = store.getAll()

      getAllRequest.onsuccess = () => {
        const items: IndexedDBItem[] = getAllRequest.result.map((item: any) => ({
          key: item.key,
          data: item.data,
          timestamp: item.timestamp,
          size: JSON.stringify(item.data).length,
          selected: true
        }))
        resolve(items)
      }

      getAllRequest.onerror = () => resolve([])
    }

    request.onerror = () => resolve([])
  })
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function SyncDataSelector({
                            items,
                            onSelectionChange,
                            onStartSync
                          }: {
  items: IndexedDBItem[]
  onSelectionChange: (selectedKeys: string[]) => void
  onStartSync: (selectedItems: IndexedDBItem[]) => void
}) {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(
      new Set(items.filter(item => item.selected).map(item => item.key))
  )

  const toggleItem = (key: string) => {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(key)) {
      newSelected.delete(key)
    } else {
      newSelected.add(key)
    }
    setSelectedItems(newSelected)
    onSelectionChange(Array.from(newSelected))
  }

  const selectAll = () => {
    const allKeys = items.map(item => item.key)
    setSelectedItems(new Set(allKeys))
    onSelectionChange(allKeys)
  }

  const selectNone = () => {
    setSelectedItems(new Set())
    onSelectionChange([])
  }

  const handleStartSync = () => {
    const selectedItemsData = items.filter(item => selectedItems.has(item.key))
    onStartSync(selectedItemsData)
  }

  const totalSize = items
      .filter(item => selectedItems.has(item.key))
      .reduce((sum, item) => sum + item.size, 0)

  return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-900">Select data to sync</h4>
          <div className="flex gap-2">
            <button
                onClick={selectAll}
                className="text-xs "
            >
              All
            </button>
            <button
                onClick={selectNone}
                className="text-xs text-gray-600 hover:text-gray-700"
            >
              None
            </button>
          </div>
        </div>

        {items.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              <Database className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No cached data available</p>
              <p className="text-xs mt-1">Use the app while online to cache data for sync</p>
            </div>
        ) : (
            <>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {items.map((item) => (
                    <div key={item.key} className="flex items-start gap-3 p-2 border border-gray-200 rounded">
                      <input
                          type="checkbox"
                          checked={selectedItems.has(item.key)}
                          onChange={() => toggleItem(item.key)}
                          className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900">{item.key}</span>
                          <span className="text-xs text-gray-500">{formatBytes(item.size)}</span>
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5">
                          Cached {new Date(item.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-xs text-gray-600">
              Total: {formatBytes(totalSize)} ({selectedItems.size} items)
            </span>
              </div>

              <div className="flex gap-2">
                <Button
                    onClick={handleStartSync}
                    className="flex-1"
                    size="sm"
                    disabled={selectedItems.size === 0}
                >
                  <Share className="h-3 w-3 mr-1" />
                  Start Sync ({selectedItems.size})
                </Button>
              </div>
            </>
        )}
      </div>
  )
}

function BluetoothSyncDropdown() {
  const {
    isSupported,
    isScanning,
    devices,
    activeSyncs,
    transferProgress,
    scanForDevices,
    connectToDevice,
    disconnect
  } = useBluetoothP2PSync()

  const [error, setError] = useState<string | null>(null)
  const [showDevices, setShowDevices] = useState(false)
  const [showDataSelector, setShowDataSelector] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null)
  const [availableData, setAvailableData] = useState<IndexedDBItem[]>([])
  const [loading, setLoading] = useState(false)

  const connectedDevices = devices.filter(d => d.connected)
  const availableDevices = devices.filter(d => !d.connected)
  const hasActiveSyncs = activeSyncs.size > 0

  const loadAvailableData = useCallback(async () => {
    setLoading(true)
    try {
      const items = await getAllIndexedDBItems()
      setAvailableData(items)
    } catch (err) {
      console.error('Failed to load IndexedDB items:', err)
      setAvailableData([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (showDataSelector) {
      loadAvailableData()
    }
  }, [showDataSelector, loadAvailableData])

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [error])

  const handleScan = async () => {
    try {
      setError(null)
      await scanForDevices()
      setShowDevices(true)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleConnect = async (deviceId: string) => {
    try {
      setError(null)
      const success = await connectToDevice(deviceId)
      if (!success) {
        setError('Failed to connect to device')
      }
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleDisconnect = async (deviceId: string) => {
    try {
      await disconnect(deviceId)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleStartSync = (deviceId: string) => {
    setSelectedDevice(deviceId)
    setShowDataSelector(true)
  }

  const handleSyncData = async (selectedItems: IndexedDBItem[]) => {
    if (!selectedDevice) return

    try {
      setError(null)
      const manager = SimpleOfflineManager.getInstance()

      for (const item of selectedItems) {


        await manager.saveToCache(`sync_${item.key}`, {
          key: item.key,
          data: item.data,
          timestamp: item.timestamp,
          source: 'sync'
        })
      }

      setShowDataSelector(false)
      setSelectedDevice(null)

    } catch (err: any) {
      setError(err.message)
    }
  }

  if (!isSupported) {
    return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-gray-400"
                disabled
            >
              <Bluetooth className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-4 w-4" />
                Bluetooth Not Supported
              </div>
            </DropdownMenuLabel>
            <div className="px-2 pb-2 text-xs text-gray-600">
              <p>Bluetooth P2P sync requires:</p>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                <li>HTTPS connection (secure context)</li>
                <li>Modern browser with Web Bluetooth support</li>
                <li>Bluetooth enabled on your device</li>
              </ul>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
    )
  }

  return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 relative"
          >
            {hasActiveSyncs ? (
                <Loader className="h-4 w-4 animate-spin text-blue-600" />
            ) : connectedDevices.length > 0 ? (
                <BluetoothConnected className="h-4 w-4 text-blue-600" />
            ) : (
                <Bluetooth className="h-4 w-4 text-gray-600" />
            )}

            {connectedDevices.length > 0 && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border border-white" />
            )}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-96 max-h-[80vh] overflow-y-auto">
          {showDataSelector && selectedDevice ? (
              <>
                <DropdownMenuLabel>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Share className="h-4 w-4" />
                      Sync to {devices.find(d => d.id === selectedDevice)?.name}
                    </div>
                    <button
                        onClick={() => {
                          setShowDataSelector(false)
                          setSelectedDevice(null)
                        }}
                        className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="p-3">
                  {loading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader className="h-6 w-6 animate-spin" />
                        <span className="ml-2 text-sm text-gray-600">Loading cached data...</span>
                      </div>
                  ) : (
                      <SyncDataSelector
                          items={availableData}
                          onSelectionChange={() => {}}
                          onStartSync={handleSyncData}
                      />
                  )}
                </div>
              </>
          ) : (
              <>
                <DropdownMenuLabel>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bluetooth className="h-4 w-4" />
                      Bluetooth Sync
                    </div>
                    {connectedDevices.length > 0 && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                    {connectedDevices.length} connected
                  </span>
                    )}
                  </div>
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                {error && (
                    <div className="mx-2 mb-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-2">
                      <AlertCircle className="h-3 w-3 flex-shrink-0" />
                      <span className="flex-1">{error}</span>
                      <button
                          onClick={() => setError(null)}
                          className="text-red-600 hover:text-red-700"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                )}

                <div className="p-2">
                  <Button
                      onClick={handleScan}
                      disabled={isScanning}
                      className="w-full flex items-center justify-center text-xs text-white rounded disabled:opacity-50 transition-colors"
                  >
                    {isScanning ? (
                        <>
                          <Loader className="h-4 w-4 animate-spin" />
                          Scanning for devices...
                        </>
                    ) : (
                        <>
                          <Scan className="h-4 w-4" />
                          Find Devices
                        </>
                    )}
                  </Button>
                  <p className="text-xs text-gray-500 text-center mt-1">
                    Make sure other iRank devices are nearby
                  </p>
                </div>

                {hasActiveSyncs && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs text-gray-600 flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        Active Syncs
                      </DropdownMenuLabel>
                      {Array.from(activeSyncs.entries()).map(([deviceId, session]) => {
                        const device = devices.find(d => d.id === deviceId)
                        const progress = transferProgress.get(deviceId) || 0

                        return (
                            <div key={deviceId} className="px-2 py-1">
                              <div className="p-2 bg-blue-50 border border-blue-200 rounded">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-medium">{device?.name}</span>
                                  <span className="text-xs text-blue-600 capitalize">{session.status}</span>
                                </div>

                                {session.status === 'transferring' && (
                                    <div className="space-y-1">
                                      <div className="flex justify-between text-xs text-gray-600">
                                        <span>{session.completedItems} / {session.totalItems} items</span>
                                        <span>{Math.round(progress)}%</span>
                                      </div>
                                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                                        <div
                                            className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                                            style={{ width: `${progress}%` }}
                                        />
                                      </div>
                                    </div>
                                )}

                                {session.errors.length > 0 && (
                                    <div className="text-xs text-red-600 mt-1">
                                      {session.errors.length} error(s)
                                    </div>
                                )}
                              </div>
                            </div>
                        )
                      })}
                    </>
                )}

                {connectedDevices.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs text-gray-600 flex items-center gap-2">
                        <BluetoothConnected className="h-3 w-3" />
                        Connected Devices
                      </DropdownMenuLabel>
                      {connectedDevices.map((device) => (
                          <div key={device.id} className="px-2 py-1">
                            <div className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded">
                              <div className="flex items-center gap-2">
                                <BluetoothConnected className="h-3 w-3 text-green-600" />
                                <div>
                                  <span className="text-sm font-medium">{device.name}</span>
                                  <div className="text-xs text-gray-500">
                                    Connected at {device.lastSeen.toLocaleTimeString()}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                    onClick={() => handleStartSync(device.id)}
                                    size="sm"
                                    variant="outline"
                                    className="h-6 px-2 text-xs"
                                >
                                  <Share className="h-3 w-3 mr-1" />
                                  Sync
                                </Button>
                                <Button
                                    onClick={() => handleDisconnect(device.id)}
                                    size="sm"
                                    variant="outline"
                                    className="h-6 px-2 text-xs text-red-600 border-red-200"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                      ))}
                    </>
                )}

                {availableDevices.length > 0 && showDevices && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs text-gray-600 flex items-center gap-2">
                        <Bluetooth className="h-3 w-3" />
                        Available Devices
                      </DropdownMenuLabel>
                      {availableDevices.map((device) => (
                          <div key={device.id} className="px-2 py-1">
                            <div className="flex items-center justify-between p-2 border border-gray-200 rounded hover:bg-gray-50">
                              <div className="flex items-center gap-2">
                                <Bluetooth className="h-3 w-3 text-gray-400" />
                                <div>
                                  <span className="text-sm font-medium">{device.name}</span>
                                  <div className="text-xs text-gray-500">
                                    Found at {device.lastSeen.toLocaleTimeString()}
                                  </div>
                                </div>
                              </div>
                              <Button
                                  onClick={() => handleConnect(device.id)}
                                  size="sm"
                                  variant="outline"
                                  className="h-6 px-2 text-xs text-blue-600 border-blue-200"
                              >
                                Connect
                              </Button>
                            </div>
                          </div>
                      ))}
                    </>
                )}

                {showDevices && availableDevices.length === 0 && !isScanning && (
                    <div className="text-center py-6 text-gray-500">
                      <Bluetooth className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">No devices found</p>
                      <p className="text-xs mt-1">Make sure other devices are advertising</p>
                    </div>
                )}
              </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
  )
}

export function SiteHeader() {
  const { user, signOut } = useAuth()
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const getUrl = useMutation(api.files.getUrl)

  useEffect(() => {
    async function fetchImageUrl() {
      if (user?.profile_image) {
        try {
          const url = await getUrl({ storageId: user.profile_image as Id<"_storage"> })
          setImageUrl(url)
        } catch (error) {
          console.error("Failed to fetch profile image URL:", error)
        }
      }
    }

    fetchImageUrl()
  }, [user?.profile_image, getUrl])

  if (!user) return null

  return (
      <header className="sticky top-0 z-50 h-16 border-b border-gray-200 dark:border-gray-700 backdrop-blur-md bg-white/50 dark:bg-gray-900/60 supports-[backdrop-filter]:bg-white/50">
        <div className="flex h-full items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="hidden md:block mr-2 h-4" />
          </div>

          <div className="flex items-center gap-4">
            <BluetoothSyncDropdown />
            <NotificationCenter />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    className="flex items-center gap-2 hover:bg-gray-200 dark:hover:bg-gray-700 px-2 py-6 rounded-md relative"
                >
                  <div className="hidden lg:flex lg:flex-col lg:items-end">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {user.role === 'school_admin' ? 'School Admin' : user.role}
                    </p>
                  </div>
                  <div className="relative">
                    <Avatar className="w-8 h-8">
                      {user.profile_image ? (
                          <AvatarImage src={imageUrl || ""} alt={user.name} />
                      ) : (
                          <AvatarFallback className="bg-primary text-white">
                            {user.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                      )}
                    </Avatar>
                    <ConnectionStatusIndicator />
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div>
                    <p className="font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={user.role === "school_admin" ? "/school/profile" : `/${user.role}/profile`}>
                    <div className="flex items-center">
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </div>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={user.role === "school_admin" ? "/school/settings" : `/${user.role}/settings`}>
                    <div className="flex items-center">
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </div>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
  )
}