import { toast } from 'sonner'

export interface PWAInstallPrompt {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt(): Promise<void>
}

class PWAManager {
  private static instance: PWAManager | null = null
  private deferredPrompt: BeforeInstallPromptEvent | null = null
  private registration: ServiceWorkerRegistration | null = null
  private installPromptShown = false

  constructor() {
    this.init()
  }

  static getInstance(): PWAManager {
    if (!PWAManager.instance) {
      PWAManager.instance = new PWAManager()
    }
    return PWAManager.instance
  }

  private async init() {
    if (typeof window === 'undefined') return

    await this.registerServiceWorker()

    this.setupInstallPrompt()

    this.setupAppInstalled()

    this.checkIfInstalled()
  }

  private async registerServiceWorker(): Promise<void> {
    if ('serviceWorker' in navigator) {
      try {
        console.log('[PWA] Registering service worker...')

        this.registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        })

        this.registration.addEventListener('updatefound', () => {
          const newWorker = this.registration?.installing
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                this.notifyUpdate()
              }
            })
          }
        })

        console.log('[PWA] Service worker registered successfully')
      } catch (error) {
        console.error('[PWA] Service worker registration failed:', error)
      }
    }
  }

  private setupInstallPrompt(): void {
    window.addEventListener('beforeinstallprompt', (event: Event) => {
      console.log('[PWA] Install prompt available')
      event.preventDefault()
      this.deferredPrompt = event as BeforeInstallPromptEvent

    })
  }

  private setupAppInstalled(): void {
    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App installed successfully')
      this.deferredPrompt = null
      toast.success('iRankHub installed successfully!', {
        description: 'You can now access the app from your home screen.'
      })
    })
  }

  private checkIfInstalled(): void {
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      console.log('[PWA] App is running in standalone mode')
      return
    }

    if ((window.navigator as any).standalone === true) {
      console.log('[PWA] App is running as PWA on iOS')
      return
    }
  }



  private notifyUpdate(): void {
    toast('App Update Available', {
      description: 'A new version of iRankHub is available.',
      action: {
        label: 'Refresh',
        onClick: () => window.location.reload()
      },
      duration: Infinity
    })
  }

  public async promptInstall(): Promise<boolean> {
    if (!this.deferredPrompt) {
      toast.error('Install not available', {
        description: 'The app is already installed or installation is not supported.'
      })
      return false
    }

    try {
      await this.deferredPrompt.prompt()
      const choiceResult = await this.deferredPrompt.userChoice

      if (choiceResult.outcome === 'accepted') {
        console.log('[PWA] User accepted the install prompt')
        return true
      } else {
        console.log('[PWA] User dismissed the install prompt')
        return false
      }
    } catch (error) {
      console.error('[PWA] Error during install prompt:', error)
      return false
    } finally {
      this.deferredPrompt = null
    }
  }

  public isInstalled(): boolean {
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      return true
    }

    if ((window.navigator as any).standalone === true) {
      return true
    }

    return false
  }

  public canInstall(): boolean {
    return !!this.deferredPrompt && !this.isInstalled()
  }

  public getRegistration(): ServiceWorkerRegistration | null {
    return this.registration
  }
}

export interface OfflineFile {
  id: string
  file: File
  name: string
  size: number
  type: string
  uploadPath: string
  metadata?: Record<string, any>
  createdAt: Date
  status: 'pending' | 'uploading' | 'completed' | 'failed'
  retryCount: number
  error?: string
}

class OfflineFileManager {
  private static instance: OfflineFileManager | null = null
  private dbName = 'irank-files'
  private dbVersion = 1
  private db: IDBDatabase | null = null

  constructor() {
    this.init()
  }

  static getInstance(): OfflineFileManager {
    if (!OfflineFileManager.instance) {
      OfflineFileManager.instance = new OfflineFileManager()
    }
    return OfflineFileManager.instance
  }

  private async init(): Promise<void> {
    try {
      this.db = await this.openDB()
      console.log('[OfflineFileManager] Database initialized')
    } catch (error) {
      console.error('[OfflineFileManager] Failed to initialize database:', error)
    }
  }

  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        if (!db.objectStoreNames.contains('files')) {
          const filesStore = db.createObjectStore('files', { keyPath: 'id' })
          filesStore.createIndex('status', 'status', { unique: false })
          filesStore.createIndex('createdAt', 'createdAt', { unique: false })
        }

        if (!db.objectStoreNames.contains('blobs')) {
          db.createObjectStore('blobs', { keyPath: 'id' })
        }
      }
    })
  }

  public async storeFile(
    file: File,
    uploadPath: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    if (!this.db) throw new Error('Database not initialized')

    const id = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const offlineFile: OfflineFile = {
      id,
      file: new File([file], file.name, { type: file.type }),
      name: file.name,
      size: file.size,
      type: file.type,
      uploadPath,
      metadata,
      createdAt: new Date(),
      status: 'pending',
      retryCount: 0
    }

    const transaction = this.db.transaction(['files', 'blobs'], 'readwrite')

    const blobStore = transaction.objectStore('blobs')
    await new Promise((resolve, reject) => {
      const request = blobStore.put({ id, blob: file })
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })

    const filesStore = transaction.objectStore('files')
    const fileMetadata = { ...offlineFile }
    delete (fileMetadata as any).file

    await new Promise((resolve, reject) => {
      const request = filesStore.put(fileMetadata)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })

    console.log(`[OfflineFileManager] Stored file: ${file.name} (${id})`)
    return id
  }

  public async getFile(id: string): Promise<OfflineFile | null> {
    if (!this.db) return null

    const transaction = this.db.transaction(['files', 'blobs'], 'readonly')

    const filesStore = transaction.objectStore('files')
    const fileMetadata = await new Promise<any>((resolve, reject) => {
      const request = filesStore.get(id)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })

    if (!fileMetadata) return null

    const blobStore = transaction.objectStore('blobs')
    const blobData = await new Promise<any>((resolve, reject) => {
      const request = blobStore.get(id)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })

    if (!blobData) return null

    return {
      ...fileMetadata,
      file: blobData.blob,
      createdAt: new Date(fileMetadata.createdAt)
    }
  }

  public async getPendingFiles(): Promise<OfflineFile[]> {
    if (!this.db) return []

    const transaction = this.db.transaction(['files', 'blobs'], 'readonly')
    const filesStore = transaction.objectStore('files')
    const index = filesStore.index('status')

    const pendingFiles = await new Promise<any[]>((resolve, reject) => {
      const request = index.getAll('pending')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })

    const blobStore = transaction.objectStore('blobs')
    const filesWithBlobs = await Promise.all(
      pendingFiles.map(async (fileMetadata) => {
        const blobData = await new Promise<any>((resolve, reject) => {
          const request = blobStore.get(fileMetadata.id)
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })

        return {
          ...fileMetadata,
          file: blobData?.blob,
          createdAt: new Date(fileMetadata.createdAt)
        }
      })
    )

    return filesWithBlobs.filter(f => f.file)
  }

  public async updateFileStatus(
    id: string,
    status: OfflineFile['status'],
    error?: string
  ): Promise<void> {
    if (!this.db) return

    const transaction = this.db.transaction(['files'], 'readwrite')
    const store = transaction.objectStore('files')

    const file = await new Promise<any>((resolve, reject) => {
      const request = store.get(id)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })

    if (file) {
      file.status = status
      file.error = error
      if (status === 'failed') {
        file.retryCount = (file.retryCount || 0) + 1
      }

      await new Promise((resolve, reject) => {
        const request = store.put(file)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
    }
  }

  public async deleteFile(id: string): Promise<void> {
    if (!this.db) return

    const transaction = this.db.transaction(['files', 'blobs'], 'readwrite')

    const filesStore = transaction.objectStore('files')
    const blobStore = transaction.objectStore('blobs')

    await Promise.all([
      new Promise((resolve, reject) => {
        const request = filesStore.delete(id)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      }),
      new Promise((resolve, reject) => {
        const request = blobStore.delete(id)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
    ])

    console.log(`[OfflineFileManager] Deleted file: ${id}`)
  }

  public async clearCompletedFiles(): Promise<void> {
    if (!this.db) return

    const transaction = this.db.transaction(['files'], 'readwrite')
    const store = transaction.objectStore('files')
    const index = store.index('status')

    const completedFiles = await new Promise<any[]>((resolve, reject) => {
      const request = index.getAll('completed')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    for (const file of completedFiles) {
      if (new Date(file.createdAt) < oneDayAgo) {
        await this.deleteFile(file.id)
      }
    }
  }

  public async getStorageUsage(): Promise<{ used: number; total: number }> {
    if (!this.db) return { used: 0, total: 0 }

    const transaction = this.db.transaction(['blobs'], 'readonly')
    const store = transaction.objectStore('blobs')

    const allBlobs = await new Promise<any[]>((resolve, reject) => {
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })

    const used = allBlobs.reduce((total, item) => total + (item.blob?.size || 0), 0)

    const total = 50 * 1024 * 1024

    return { used, total }
  }
}

export function usePWA() {
  const pwaManager = PWAManager.getInstance()

  return {
    isInstalled: pwaManager.isInstalled(),
    canInstall: pwaManager.canInstall(),
    promptInstall: () => pwaManager.promptInstall(),
    registration: pwaManager.getRegistration()
  }
}

export function useOfflineFiles() {
  const fileManager = OfflineFileManager.getInstance()

  return {
    storeFile: (file: File, uploadPath: string, metadata?: Record<string, any>) =>
      fileManager.storeFile(file, uploadPath, metadata),
    getFile: (id: string) => fileManager.getFile(id),
    getPendingFiles: () => fileManager.getPendingFiles(),
    updateFileStatus: (id: string, status: OfflineFile['status'], error?: string) =>
      fileManager.updateFileStatus(id, status, error),
    deleteFile: (id: string) => fileManager.deleteFile(id),
    clearCompletedFiles: () => fileManager.clearCompletedFiles(),
    getStorageUsage: () => fileManager.getStorageUsage()
  }
}

export function initializePWA() {
  if (typeof window !== 'undefined') {
    PWAManager.getInstance()
    OfflineFileManager.getInstance()
  }
}
