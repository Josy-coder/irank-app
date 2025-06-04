"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
  Upload,
  Download,
  CheckCircle,
  XCircle,
  AlertCircle,
  Copy,
  Check,
  Eye,
  EyeOff
} from "lucide-react"
import { toast } from "sonner"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useAuth } from "@/hooks/useAuth"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface ImportUsersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUsersImported?: () => void
}

interface ImportResult {
  success: boolean
  userId?: string
  error?: string
  resetLink?: string
  tempPassword?: string
  userData: {
    name: string
    email: string
    role: string
  }
}

export function ImportUsersDialog({ open, onOpenChange, onUsersImported }: ImportUsersDialogProps) {
  const [loading, setLoading] = useState(false)
  const [importResults, setImportResults] = useState<ImportResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [copiedPasswords, setCopiedPasswords] = useState<Set<number>>(new Set())
  const [copiedLinks, setCopiedLinks] = useState<Set<number>>(new Set())
  const [showPasswords, setShowPasswords] = useState<Set<number>>(new Set())

  const { token } = useAuth()
  const bulkCreateUsers = useMutation(api.functions.admin.users.bulkCreateUsers)

  const csvTemplate = `name,email,phone,role,gender,grade,school_name,position,security_question,security_answer,date_of_birth,national_id,high_school_attended
John Doe,john@example.com,+250781234567,student,male,Grade 10,Kigali Primary School,,What is your favorite color?,Blue,,,
Jane Smith,jane@example.com,+250781234568,school_admin,female,,,Rwanda Secondary School,Principal,,,,,
Bob Wilson,bob@example.com,+250781234569,volunteer,male,,,,,,,1985-05-20,PASS789123,High School ABC
Alice Johnson,alice@example.com,+250781234570,admin,female,,,,,,,,`

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
        toast.error("Please upload a CSV file")
        return
      }
      setUploadedFile(file)
    }
  }

  const parseCSV = (csvText: string): any[] => {
    const lines = csvText.trim().split('\n')
    const headers = lines[0].split(',').map(h => h.trim())

    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim())
      const user: any = {}

      headers.forEach((header, index) => {
        if (values[index] && values[index] !== '') {
          user[header] = values[index]
        }
      })

      return user
    }).filter(user => user.name && user.email && user.role)
  }

  const handleImport = async () => {
    if (!uploadedFile || !token) return

    setLoading(true)
    setProgress(0)

    try {
      const csvText = await uploadedFile.text()
      const users = parseCSV(csvText)

      if (users.length === 0) {
        toast.error("No valid users found in the CSV file")
        setLoading(false)
        return
      }

      const results: ImportResult[] = []
      const batchSize = 5

      for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize)

        for (const userData of batch) {
          try {
            const result = await bulkCreateUsers({
              admin_token: token,
              users: [userData]
            })

            if (result.results && result.results.length > 0) {
              const userResult = result.results[0]
              results.push({
                success: userResult.success,
                userId: userResult.userId,
                error: userResult.error,
                resetLink: userResult.resetLink,
                tempPassword: userResult.tempPassword,
                userData: {
                  name: userData.name,
                  email: userData.email,
                  role: userData.role
                }
              })
            }
          } catch (error: any) {
            results.push({
              success: false,
              error: error.message?.split("Uncaught Error:")[1]?.split(/\.|Called by client/)[0]?.trim(),
              userData: {
                name: userData.name,
                email: userData.email,
                role: userData.role
              }
            })
          }
        }

        setProgress(Math.min(((i + batchSize) / users.length) * 100, 100))

        await new Promise(resolve => setTimeout(resolve, 100))
      }

      setImportResults(results)
      setShowResults(true)

      const successCount = results.filter(r => r.success).length
      const failureCount = results.filter(r => !r.success).length

      if (successCount > 0) {
        toast.success(`${successCount} users imported successfully`)
      }
      if (failureCount > 0) {
        toast.error(`${failureCount} users failed to import`)
      }

      if (onUsersImported && successCount > 0) {
        onUsersImported()
      }

    } catch (error: any) {
      toast.error(error.message?.split("Uncaught Error:")[1]?.split(/\.|Called by client/)[0]?.trim() || "Failed to import users")
    } finally {
      setLoading(false)
    }
  }

  const downloadTemplate = () => {
    const blob = new Blob([csvTemplate], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'users_import_template.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
    toast.success("Template downloaded!")
  }

  const handleCopy = async (text: string, index: number, type: "password" | "link") => {
    try {
      await navigator.clipboard.writeText(text)

      if (type === "password") {
        setCopiedPasswords(prev => {
          const newSet = new Set(Array.from(prev));
          newSet.add(index);
          return newSet;
        });
        setTimeout(() => {
          setCopiedPasswords(prev => {
            const newSet = new Set(prev)
            newSet.delete(index)
            return newSet
          })
        }, 2000)
      } else {
        setCopiedLinks(prev => {
          const newSet = new Set(Array.from(prev));
          newSet.add(index);
          return newSet;
        });
        setTimeout(() => {
          setCopiedLinks(prev => {
            const newSet = new Set(prev)
            newSet.delete(index)
            return newSet
          })
        }, 2000)
      }

      toast.success("Copied to clipboard!")
    } catch (error) {
      toast.error("Failed to copy")
    }
  }

  const togglePasswordVisibility = (index: number) => {
    setShowPasswords(prev => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
  }

  const exportResults = () => {
    const csvContent = [
      "Name,Email,Role,Status,Temporary Password,Reset Link",
      ...importResults.map(result => {
        const status = result.success ? "Success" : "Failed"
        const password = result.tempPassword || "N/A"
        const link = result.resetLink || "N/A"
        return `"${result.userData.name}","${result.userData.email}","${result.userData.role}","${status}","${password}","${link}"`
      })
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `import_results_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
    toast.success("Results exported!")
  }

  const handleClose = () => {
    setUploadedFile(null)
    setImportResults([])
    setShowResults(false)
    setProgress(0)
    setCopiedPasswords(new Set())
    setCopiedLinks(new Set())
    setShowPasswords(new Set())
    onOpenChange(false)
  }

  if (showResults) {
    const successfulResults = importResults.filter(r => r.success)
    const failedResults = importResults.filter(r => !r.success)

    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Results</DialogTitle>
            <DialogDescription>
              {successfulResults.length} users imported successfully, {failedResults.length} failed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex gap-4">
                <Badge variant="secondary" className="text-green-600 bg-green-100">
                  <CheckCircle className="h-4 w-4 mr-1" />
                  {successfulResults.length} Success
                </Badge>
                <Badge variant="secondary" className="text-red-600 bg-red-100">
                  <XCircle className="h-4 w-4 mr-1" />
                  {failedResults.length} Failed
                </Badge>
              </div>

              <Button variant="outline" size="sm" onClick={exportResults}>
                <Download className="h-4 w-4 mr-2" />
                Export Results
              </Button>
            </div>

            <Tabs defaultValue="successful" className="w-full">
              <TabsList>
                <TabsTrigger value="successful">
                  Successful ({successfulResults.length})
                </TabsTrigger>
                <TabsTrigger value="failed">
                  Failed ({failedResults.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="successful" className="space-y-3">
                {successfulResults.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No successful imports</p>
                ) : (
                  successfulResults.map((result, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{result.userData.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {result.userData.email} • {result.userData.role}
                          </p>
                        </div>
                        <Badge className="bg-green-100 text-green-700">
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Created
                        </Badge>
                      </div>

                      {result.tempPassword && (
                        <div className="space-y-2">
                          <Label className="text-sm">Temporary Password</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type={showPasswords.has(index) ? "text" : "password"}
                              value={result.tempPassword}
                              readOnly
                              className="flex-1 text-sm"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => togglePasswordVisibility(index)}
                            >
                              {showPasswords.has(index) ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCopy(result.tempPassword!, index, "password")}
                            >
                              {copiedPasswords.has(index) ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      )}

                      {result.resetLink && (
                        <div className="space-y-2">
                          <Label className="text-sm">Reset Password Link</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              value={result.resetLink}
                              readOnly
                              className="flex-1 text-sm"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCopy(result.resetLink!, index, "link")}
                            >
                              {copiedLinks.has(index) ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="failed" className="space-y-3">
                {failedResults.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No failed imports</p>
                ) : (
                  failedResults.map((result, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{result.userData.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {result.userData.email} • {result.userData.role}
                          </p>
                        </div>
                        <Badge variant="destructive">
                          <XCircle className="h-4 w-4 mr-1" />
                          Failed
                        </Badge>
                      </div>
                      {result.error && (
                        <Alert className="mt-3">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>{result.error}</AlertDescription>
                        </Alert>
                      )}
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter>
            <Button onClick={handleClose}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Users</DialogTitle>
          <DialogDescription>
            Upload a CSV file to import multiple users at once. Download the template to see the required format.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">CSV Template</h4>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="file-upload" className="font-medium">Upload CSV File</Label>
              <div className="mt-2">
                <Input
                  id="file-upload"
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  disabled={loading}
                />
              </div>
            </div>

            {uploadedFile && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  File &#34;{uploadedFile.name}&#34; selected. Ready to import.
                </AlertDescription>
              </Alert>
            )}

            {loading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Importing users...</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="w-full" />
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h4 className="font-medium">Import Guidelines</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Each user type requires different fields (see template)</li>
              <li>• <strong>Students need:</strong> school_name (exact match), grade, security_question, security_answer</li>
              <li>• <strong>School admins need:</strong> position and school information</li>
              <li>• <strong>Volunteers need:</strong> date_of_birth, national_id, high_school_attended</li>
              <li>• <strong>Admins</strong> only need basic information</li>
              <li>• <strong>School names must match exactly</strong> with existing active schools in the database</li>
              <li>• Temporary passwords will be generated automatically</li>
              <li>• Reset links will be provided for each user</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!uploadedFile || loading}
          >
            {loading ? (
              <>
                <Upload className="mr-2 h-4 w-4 animate-pulse" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Import Users
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}