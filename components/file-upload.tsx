"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Slot } from "@radix-ui/react-slot"
import {
    FileArchiveIcon,
    FileAudioIcon,
    FileCodeIcon,
    FileCogIcon,
    FileIcon,
    FileTextIcon,
    FileVideoIcon,
    Upload,
    X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { UploadStatus } from "@/types"

interface FileUploadContextValue {
    files: File[]
    setFiles: React.Dispatch<React.SetStateAction<File[]>>
    uploadStatuses: Record<string, UploadStatus>
    setUploadStatuses: React.Dispatch<React.SetStateAction<Record<string, UploadStatus>>>
    uploadProgress: Record<string, number>
    setUploadProgress: React.Dispatch<React.SetStateAction<Record<string, number>>>
    disabled: boolean
    maxSize?: number
    accept?: string
    multiple?: boolean
    bucketId?: string
}

const FileUploadContext = React.createContext<FileUploadContextValue | undefined>(undefined)

function useFileUploadContext() {
    const context = React.useContext(FileUploadContext)
    if (!context) {
        throw new Error("useFileUploadContext must be used within a FileUpload provider")
    }
    return context
}

function formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

function getFileIcon(file: File) {
    const type = file.type
    const extension = file.name.split(".").pop()?.toLowerCase() || ""

    if (type.startsWith("video/")) {
        return <FileVideoIcon className="h-10 w-10 text-blue-500" />
    }

    if (type.startsWith("audio/")) {
        return <FileAudioIcon className="h-10 w-10 text-purple-500" />
    }

    if (type.startsWith("image/")) {
        return (
            <div className="h-10 w-10 overflow-hidden rounded-md border">
                <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="h-full w-full object-cover"
                    onLoad={(e) => {
                        if (e.target instanceof HTMLImageElement) {
                            URL.revokeObjectURL(e.target.src)
                        }
                    }}
                />
            </div>
        )
    }

    if (
        type.startsWith("text/") ||
        ["txt", "md", "rtf", "pdf"].includes(extension)
    ) {
        return <FileTextIcon className="h-10 w-10 text-yellow-500" />
    }

    if (
        ["html", "css", "js", "jsx", "ts", "tsx", "json", "xml", "php", "py", "rb", "java", "c", "cpp", "cs"].includes(extension)
    ) {
        return <FileCodeIcon className="h-10 w-10 text-green-500" />
    }

    if (["zip", "rar", "7z", "tar", "gz", "bz2"].includes(extension)) {
        return <FileArchiveIcon className="h-10 w-10 text-orange-500" />
    }

    if (
        ["exe", "msi", "app", "apk", "deb", "rpm"].includes(extension) ||
        type.startsWith("application/")
    ) {
        return <FileCogIcon className="h-10 w-10 text-red-500" />
    }

    return <FileIcon className="h-10 w-10 text-gray-500" />
}

interface FileUploadProps extends React.HTMLAttributes<HTMLDivElement> {
    value?: File[]
    onChange: (files: File[] | null) => void
    bucketId?: string
    accept?: string
    multiple?: boolean
    maxSize?: number // in MB
    disabled?: boolean
    children?: React.ReactNode
    className?: string
}

export function FileUpload({
                               value = [],
                               onChange,
                               bucketId,
                               accept,
                               multiple = false,
                               maxSize = 5, // Default 5MB
                               disabled = false,
                               className,
                               ...props
                           }: FileUploadProps) {
    const [files, setFiles] = React.useState<File[]>(value || [])
    const [uploadStatuses, setUploadStatuses] = React.useState<Record<string, UploadStatus>>({})
    const [uploadProgress, setUploadProgress] = React.useState<Record<string, number>>({})
    const [dragActive, setDragActive] = React.useState(false)

    React.useEffect(() => {
        if (value !== undefined) {
            setFiles(value)
        }
    }, [value])

    React.useEffect(() => {
        onChange(files.length > 0 ? files : null)
    }, [files, onChange])

    const handleFileChange = (newFiles: FileList | null) => {
        if (!newFiles || newFiles.length === 0) return

        const newFilesArray = Array.from(newFiles)
        const validFiles: File[] = []

        newFilesArray.forEach((file) => {
            if (maxSize && file.size > maxSize * 1024 * 1024) {
                invalidFiles.push({
                    file,
                    error: `File exceeds maximum size of ${maxSize}MB`
                })
                return
            }

            if (accept) {
                const acceptedTypes = accept.split(',').map(t => t.trim())
                const fileType = file.type
                const fileExtension = `.${file.name.split('.').pop()}`

                const isAccepted = acceptedTypes.some(type => {
                    // Handle wildcards like image/*
                    if (type.includes('*')) {
                        const category = type.split('/')[0]
                        return fileType.startsWith(category)
                    }
                    return type === fileType || type === fileExtension
                })

                if (!isAccepted) {
                    invalidFiles.push({
                        file,
                        error: `File type not accepted. Please upload ${accept.replace(/,/g, ' or ')}`
                    })
                    return
                }
            }

            validFiles.push(file)
        })

        if (validFiles.length > 0) {
            if (multiple) {
                setFiles(prevFiles => [...prevFiles, ...validFiles])
            } else {
                setFiles(validFiles.slice(0, 1))
            }

            const newStatuses: Record<string, UploadStatus> = {}
            const newProgress: Record<string, number> = {}

            validFiles.forEach(file => {
                newStatuses[file.name] = "idle"
                newProgress[file.name] = 0
            })

            setUploadStatuses(prev => ({...prev, ...newStatuses}))
            setUploadProgress(prev => ({...prev, ...newProgress}))
        }

        if (invalidFiles.length > 0) {
            invalidFiles.forEach(({ file, error }) => {
                console.error(`Invalid file "${file.name}": ${error}`)
            })
        }
    }

    const handleRemoveFile = (file: File) => {
        setFiles(files.filter(f => f !== file))

        const updatedStatuses = {...uploadStatuses}
        const updatedProgress = {...uploadProgress}

        delete updatedStatuses[file.name]
        delete updatedProgress[file.name]

        setUploadStatuses(updatedStatuses)
        setUploadProgress(updatedProgress)
    }

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        e.stopPropagation()
        if (!dragActive) setDragActive(true)
    }

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        e.stopPropagation()
        if (dragActive) setDragActive(false)
    }

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActive(false)

        if (!disabled) {
            handleFileChange(e.dataTransfer.files)
        }
    }

    const contextValue = {
        files,
        setFiles,
        uploadStatuses,
        setUploadStatuses,
        uploadProgress,
        setUploadProgress,
        disabled,
        maxSize,
        accept,
        multiple,
        bucketId
    }

    return (
        <FileUploadContext.Provider value={contextValue}>
            <div
                className={cn(
                    "relative flex flex-col gap-2",
                    disabled && "opacity-60 pointer-events-none",
                    className
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                {...props}
            >
                {props.children || (
                    <>
                        <FileUploadDropzone
                            dragActive={dragActive}
                            onFileChange={handleFileChange}
                        />
                        <FileUploadPreview
                            files={files}
                            onRemove={handleRemoveFile}
                        />
                    </>
                )}
            </div>
        </FileUploadContext.Provider>
    )
}

interface FileUploadDropzoneProps {
    dragActive?: boolean
    onFileChange: (files: FileList | null) => void
    children?: React.ReactNode
    className?: string
}

export function FileUploadDropzone({
                                       dragActive,
                                       onFileChange,
                                       children,
                                       className
                                   }: FileUploadDropzoneProps) {
    const { disabled, accept, multiple } = useFileUploadContext()
    const inputRef = React.useRef<HTMLInputElement>(null)

    const handleClick = () => {
        inputRef.current?.click()
    }

    return (
        <div
            onClick={handleClick}
            className={cn(
                "flex flex-col items-center justify-center rounded-lg border-2 border-dashed  p-6 cursor-pointer transition-colors",
                dragActive ? "border-primary bg-primary/10" : "border-muted-foreground hover:bg-accent/30",
                className
            )}
        >
            {children || (
                <>
                    <div className="flex flex-col items-center gap-2 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-muted bg-background">
                            <Upload className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div className="flex flex-col space-y-1 text-center">
                            <p className="text-sm font-medium dark:text-muted-foreground">
                                Drag files here or click to upload
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Upload files up to {useFileUploadContext().maxSize}MB
                            </p>
                        </div>
                    </div>
                    <input
                        ref={inputRef}
                        type="file"
                        className="hidden"
                        accept={accept}
                        multiple={multiple}
                        disabled={disabled}
                        onChange={(e) => onFileChange(e.target.files)}
                    />
                </>
            )}
        </div>
    )
}

interface FileUploadPreviewProps {
    files: File[]
    onRemove: (file: File) => void
    className?: string
}

export function FileUploadPreview({
                                      files,
                                      onRemove,
                                      className
                                  }: FileUploadPreviewProps) {
    const { uploadStatuses, uploadProgress } = useFileUploadContext()

    if (files.length === 0) return null

    return (
        <div className={cn("space-y-3", className)}>
            {files.map((file, index) => (
                <div
                    key={index}
                    className="flex items-center rounded-md border p-3 relative"
                >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        {getFileIcon(file)}
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{file.name}</p>
                            <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                        </div>
                    </div>

                    {/* Progress indicator */}
                    {uploadStatuses[file.name] === "uploading" && (
                        <div className="h-1.5 bg-muted absolute left-0 right-0 bottom-0 overflow-hidden rounded-b-md">
                            <div
                                className="h-full bg-primary transition-all"
                                style={{ width: `${uploadProgress[file.name] || 0}%` }}
                            />
                        </div>
                    )}

                    {/* Status indicators */}
                    {uploadStatuses[file.name] === "success" && (
                        <span className="inline-flex items-center text-xs text-success-foreground px-2 py-0.5 mr-2">
              Uploaded
            </span>
                    )}

                    {uploadStatuses[file.name] === "error" && (
                        <span className="inline-flex items-center text-xs text-destructive px-2 py-0.5 mr-2">
              Failed
            </span>
                    )}

                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full"
                        onClick={() => onRemove(file)}
                    >
                        <X className="h-4 w-4 text-muted-foreground" />
                        <span className="sr-only">Remove file</span>
                    </Button>
                </div>
            ))}
        </div>
    )
}

interface FileUploadTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    asChild?: boolean
}

export const FileUploadTrigger = React.forwardRef<HTMLButtonElement, FileUploadTriggerProps>(
    ({ asChild = false, className, ...props }, ref) => {
        const { disabled, accept, multiple } = useFileUploadContext()
        const inputRef = React.useRef<HTMLInputElement>(null)

        const handleClick = () => {
            inputRef.current?.click()
        }

        const Comp = asChild ? Slot : Button

        return (
            <>
                <Comp
                    ref={ref}
                    className={className}
                    disabled={disabled}
                    onClick={handleClick}
                    {...props}
                />
                <input
                    ref={inputRef}
                    type="file"
                    className="hidden"
                    accept={accept}
                    multiple={multiple}
                    disabled={disabled}
                    onChange={(e) => {
                        const context = useFileUploadContext()
                        if (context && e.target.files) {
                            const newFilesArray = Array.from(e.target.files)
                            if (multiple) {
                                context.setFiles(prev => [...prev, ...newFilesArray])
                            } else {
                                context.setFiles(newFilesArray.slice(0, 1))
                            }
                        }
                    }}
                />
            </>
        )
    }
)
FileUploadTrigger.displayName = "FileUploadTrigger"