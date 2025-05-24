"use client"

import { useState } from "react"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Upload, FileText, X, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Id } from "@/convex/_generated/dataModel"

interface FileUploadProps {
    onFileUploaded?: (storageId: Id<"_storage">) => void
    acceptedTypes?: string[]
    maxSizeInMB?: number
    label?: string
    description?: string
    required?: boolean
    disabled?: boolean
}

export function FileUpload({
                               onFileUploaded,
                               acceptedTypes = [".pdf", ".jpg", ".jpeg", ".png"],
                               maxSizeInMB = 5,
                               label = "Upload File",
                               description = "Click to upload or drag and drop",
                               required = false,
                               disabled = false,
                           }: FileUploadProps) {
    const [file, setFile] = useState<File | null>(null)
    const [uploading, setUploading] = useState(false)

    const generateUploadUrl = useMutation(api.files.generateUploadUrl)

    const validateFile = (file: File): boolean => {
        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
        const allowedMimeTypes = [
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/jpg'
        ]

        if (!allowedMimeTypes.includes(file.type) && !acceptedTypes.includes(fileExtension)) {
            toast.error(`Please upload a file with one of these types: ${acceptedTypes.join(', ')}`)
            return false
        }

        // Check file size
        const maxSizeInBytes = maxSizeInMB * 1024 * 1024
        if (file.size > maxSizeInBytes) {
            toast.error(`File size must be less than ${maxSizeInMB}MB`)
            return false
        }

        return true
    }

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0]
        if (!selectedFile) return

        if (!validateFile(selectedFile)) return

        setFile(selectedFile)
        await uploadFile(selectedFile)
    }

    const uploadFile = async (fileToUpload: File) => {
        try {
            setUploading(true)

            const postUrl = await generateUploadUrl()

            const result = await fetch(postUrl, {
                method: "POST",
                headers: { "Content-Type": fileToUpload.type },
                body: fileToUpload,
            })

            if (!result.ok) {
                throw new Error("Upload failed")
            }

            const { storageId } = await result.json()
            onFileUploaded?.(storageId)
            toast.success("File uploaded successfully")

        } catch (error) {
            console.error("Upload error:", error)
            toast.error("Failed to upload file")
            setFile(null)
        } finally {
            setUploading(false)
        }
    }

    const removeFile = () => {
        setFile(null)
        // Reset the input
        const input = document.querySelector('input[type="file"]') as HTMLInputElement
        if (input) input.value = ''
    }

    return (
      <div className="space-y-2">
          <Label className="text-sm font-medium">
              {label} {required && <span className="text-red-500">*</span>}
          </Label>

          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}

          {!file ? (
            <div className="relative border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-muted-foreground/50 transition-colors">
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-2">
                    Click to upload or drag and drop
                </p>
                <p className="text-xs text-muted-foreground">
                    {acceptedTypes.join(', ').toUpperCase()} (max {maxSizeInMB}MB)
                </p>
                <input
                  type="file"
                  accept={acceptedTypes.join(',')}
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={disabled || uploading}
                />
            </div>
          ) : (
            <div className="border rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <FileText className="h-8 w-8 text-blue-500" />
                    <div>
                        <p className="text-sm font-medium">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                    </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={removeFile}
                  disabled={disabled || uploading}
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>
          )}

          {uploading && (
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Uploading...</span>
            </div>
          )}
      </div>
    )
}