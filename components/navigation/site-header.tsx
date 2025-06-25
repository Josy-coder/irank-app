"use client"

import { useAuth } from "@/hooks/use-auth"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import {
  User,
  Settings,
  LogOut,
  ChevronDown,
  CloudOff,
  Loader2,
  AlertCircle,
  X,
  Share,
  Database,
  Clock,
  QrCode,
  ArrowRight,
  ArrowLeft
} from "lucide-react"
import Link from "next/link"
import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
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
import { useWebRTCP2PSync } from "@/hooks/use-webrtc-p2p-sync"
import { useOfflineSync } from "@/hooks/use-offline"
import { QRCodeDisplay, QRCodeScanner } from "@/components/qrcode-scanner"

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
        <div className="flex gap-2">
          <button
            onClick={selectAll}
            className="text-xs text-blue-600 hover:text-blue-700"
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
                <Checkbox
                  checked={selectedItems.has(item.key)}
                  onCheckedChange={() => toggleItem(item.key)}
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

function WebRTCSyncDropdown() {
  const {
    isSupported,
    isGeneratingQR,
    isScanning,
    activeSyncs,
    transferProgress,
    qrStep,
    currentOffer,
    currentAnswer,
    createOffer,
    createAnswer,
    processAnswer,
    getAvailableSyncItems,
    disconnect,
    resetQRState
  } = useWebRTCP2PSync()

  const [error, setError] = useState<string | null>(null)
  const [showDataSelector, setShowDataSelector] = useState(false)
  const [availableData, setAvailableData] = useState<IndexedDBItem[]>([])
  const [loading, setLoading] = useState(false)
  const [showQRDisplay, setShowQRDisplay] = useState(false)
  const [showQRScanner, setShowQRScanner] = useState(false)
  const [syncMode, setSyncMode] = useState<'send' | 'receive' | null>(null)
  const [qrDisplayData, setQrDisplayData] = useState<string>('')
  const [qrDisplayTitle, setQrDisplayTitle] = useState<string>('')
  const [selectedItemsForSync, setSelectedItemsForSync] = useState<IndexedDBItem[]>([])

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

  const handleStartSend = async () => {
    try {
      setError(null)
      setSyncMode('send')
      setShowDataSelector(true)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleStartReceive = async () => {
    try {
      setError(null)
      setSyncMode('receive')
      setShowQRScanner(true)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleSyncData = async (selectedItems: IndexedDBItem[]) => {
    try {
      setError(null)
      setShowDataSelector(false)
      setSelectedItemsForSync(selectedItems)

      const syncItems = selectedItems.map(item => ({
        key: item.key,
        type: 'cache' as const,
        data: item.data,
        timestamp: item.timestamp,
        version: 1,
        size: item.size,
        selected: item.selected
      }))

      const offer = await createOffer(syncItems)
      setQrDisplayData(offer)
      setQrDisplayTitle("Show this QR to receiving device")
      setShowQRDisplay(true)

    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleOfferScanned = async (offerData: string) => {
    try {
      setError(null)
      setShowQRScanner(false)

      const answer = await createAnswer(offerData)
      setQrDisplayData(answer)
      setQrDisplayTitle("Show this QR to sending device")
      setShowQRDisplay(true)

    } catch (err: any) {
      setError(err.message)
      setShowQRScanner(false)
    }
  }

  const handleAnswerScanned = async (answerData: string) => {
    try {
      setError(null)
      setShowQRScanner(false)

      await processAnswer(answerData)

    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleCloseQR = () => {
    setShowQRDisplay(false)

    if (syncMode === 'send' && qrStep === 'showing_offer') {

      setShowQRScanner(true)
      return
    }

    setSyncMode(null)
    setSelectedItemsForSync([])
    resetQRState()
  }

  const handleCloseScan = () => {
    setShowQRScanner(false)
    setSyncMode(null)
    setSelectedItemsForSync([])
    resetQRState()
  }

  const handleDisconnect = async (sessionId: string) => {
    try {
      disconnect(sessionId)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const getScannerProps = () => {
    if (syncMode === 'receive') {
      return {
        onScan: handleOfferScanned,
        title: "Scan sender's QR code"
      }
    } else if (syncMode === 'send') {
      return {
        onScan: handleAnswerScanned,
        title: "Scan receiver's QR code"
      }
    }
    return {
      onScan: () => {},
      title: "Scan QR code"
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
            <QrCode className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel>
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-4 w-4" />
              Sync Not Supported
            </div>
          </DropdownMenuLabel>
          <div className="px-2 pb-2 text-xs text-gray-600">
            <p>P2P sync requires:</p>
            <ul className="list-disc list-inside mt-1 text-xs space-y-0.5">
              <li>HTTPS connection (secure context)</li>
              <li>Modern browser with WebRTC support</li>
              <li>Camera access for QR scanning</li>
            </ul>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="relative"
          >
            {hasActiveSyncs ? (
              <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
            ) : (
              <QrCode className="h-3 w-3 text-gray-600" />
            )}

            {hasActiveSyncs && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border border-white" />
            )}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="overflow-y-auto">
          {showDataSelector && syncMode === 'send' ? (
            <>
              <DropdownMenuLabel>
                <div className="flex items-center justify-between">
                  <div className="flex text-sm items-center gap-2">
                    <Share className="h-3 w-3" />
                    Select Data to Send
                  </div>
                  <button
                    onClick={() => {
                      setShowDataSelector(false)
                      setSyncMode(null)
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
                    <Loader2 className="h-4 w-4 animate-spin" />
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
                    <QrCode className="h-4 w-4" />
                    Offline Sync
                  </div>
                  {hasActiveSyncs && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                      {activeSyncs.size} active
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

              <div className="p-2 space-y-2">
                <Button
                  onClick={handleStartSend}
                  disabled={isGeneratingQR}
                  className="w-full flex items-center justify-center text-xs text-white rounded disabled:opacity-50 transition-colors"
                >
                  {isGeneratingQR ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <ArrowRight className="h-3 w-3 mr-2" />
                      Send Data
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleStartReceive}
                  disabled={isScanning}
                  variant="outline"
                  className="w-full flex items-center justify-center text-xs rounded disabled:opacity-50 transition-colors"
                >
                  <ArrowLeft className="h-3 w-3 mr-2" />
                  Receive Data
                </Button>

                <p className="text-xs text-gray-500 text-center mt-2">
                  Use QR codes to sync data between devices completely offline
                </p>
              </div>

              {hasActiveSyncs && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-gray-600 flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    Active Syncs
                  </DropdownMenuLabel>
                  {Array.from(activeSyncs.entries()).map(([sessionId, session]) => {
                    const progress = transferProgress.get(sessionId) || 0

                    return (
                      <div key={sessionId} className="px-2 py-1">
                        <div className="p-2 bg-blue-50 border border-blue-200 rounded">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">Session {sessionId.slice(-6)}</span>
                            <span className="text-xs text-blue-600 capitalize">{session.status}</span>
                          </div>

                          {session.status === 'transferring' && (
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs text-gray-600">
                                <span>{session.completedItems} / {session.totalItems} items</span>
                                <span>{Math.round(progress)}%</span>
                              </div>
                              <Progress
                                value={progress}
                                className="w-full h-1.5"
                              />
                            </div>
                          )}

                          {session.errors.length > 0 && (
                            <div className="text-xs text-red-600 mt-1">
                              {session.errors.length} error(s)
                            </div>
                          )}

                          <div className="flex items-center justify-end mt-2">
                            <Button
                              onClick={() => handleDisconnect(sessionId)}
                              size="sm"
                              variant="outline"
                              className="px-2 text-xs text-red-600 border-red-200"
                            >
                              <X className="h-3 w-3 mr-1" />
                              Stop
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      
      <QRCodeDisplay
        data={qrDisplayData}
        title={qrDisplayTitle}
        open={showQRDisplay}
        onClose={handleCloseQR}
      />

      
      <QRCodeScanner
        {...getScannerProps()}
        open={showQRScanner}
        onClose={handleCloseScan}
      />
    </>
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
          <WebRTCSyncDropdown />
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