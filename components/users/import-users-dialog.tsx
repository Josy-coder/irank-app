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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Upload,
  Download,
  XCircle,
  AlertCircle,
  Copy,
  Check,
  Eye,
  EyeOff,
  CircleCheck
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
  userType?: "admin" | "school"
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
    role?: string
    grade?: string
  }
}

type TemplateType = "student" | "school_admin" | "volunteer" | "admin"

export function ImportUsersDialog({ open, onOpenChange, onUsersImported, userType = "admin" }: ImportUsersDialogProps) {
  const [loading, setLoading] = useState(false)
  const [importResults, setImportResults] = useState<ImportResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [copiedPasswords, setCopiedPasswords] = useState<Set<number>>(new Set())
  const [copiedLinks, setCopiedLinks] = useState<Set<number>>(new Set())
  const [showPasswords, setShowPasswords] = useState<Set<number>>(new Set())
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>("student")

  const { token } = useAuth()
  const bulkCreateUsers = useMutation(
      userType === "admin"
          ? api.functions.admin.users.bulkCreateUsers
          : api.functions.school.students.bulkCreateStudents
  )

  const csvTemplates = {
    student: `name,email,phone,role,gender,grade,school_name,security_question,security_answer
John Doe,john@example.com,+250781234567,student,male,Grade 10,Kigali Primary School,What is your favorite color?,Blue
Jane Smith,jane@example.com,+250781234568,student,female,Grade 11,Rwanda Secondary School,What is your mother's maiden name?,Johnson
Bob Wilson,bob@example.com,+250781234569,student,male,Grade 12,International School,What is your favorite book?,To Kill a Mockingbird`,

    school_admin: `name,email,phone,role,gender,position,school_name,school_type,country,province,district,sector,cell,village,contact_name,contact_email,contact_phone
Jane Smith,jane@example.com,+250781234568,school_admin,female,Principal,Rwanda Secondary School,Public,RW,Kigali,Gasabo,Kimironko,Biryogo,Nyamirambo,John Contact,contact@school.com,+250781234569
Janet Smith,janet@example.com,+250781234570,school_admin,male,Head of Studies,Rwanda Secondary School 2,Private,RW,Kigali,Kicukiro,Niboye,Gatenga,Kagarama,Jane Contact,contact2@school.com,+250781234571`,

    volunteer: `name,email,phone,role,gender,date_of_birth,national_id,high_school_attended
Bob Wilson,bob@example.com,+250781234569,volunteer,male,1985-05-20,PASS789123,High School ABC
Alice Johnson,alice@example.com,+250781234570,volunteer,female,1990-03-15,PASS123456,Central High School`,

    admin: `name,email,phone,role,gender
Alice Johnson,alice@example.com,+250781234570,admin,female
Mike Admin,mike@example.com,+250781234571,admin,male`
  }

  const schoolStudentTemplate = `name,email,phone,gender,grade,security_question,security_answer
John Doe,john@example.com,+250781234567,male,Grade 10,What is your favorite color?,Blue
Jane Smith,jane@example.com,+250781234568,female,Grade 11,What is your mother's maiden name?,Johnson
Bob Wilson,bob@example.com,+250781234569,male,Grade 12,What is your favorite book?,To Kill a Mockingbird`

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
    }).filter(user => user.name && user.email && (userType === "admin" ? user.role || selectedTemplate : true))
  }

  const handleImport = async () => {
    if (!uploadedFile || !token) return

    setLoading(true)
    setProgress(0)

    try {
      const csvText = await uploadedFile.text()
      const users = parseCSV(csvText)

      if (users.length === 0) {
        toast.error(`No valid ${userType === "school" ? "students" : "users"} found in the CSV file`)
        setLoading(false)
        return
      }

      const processedUsers = users.map(user => {
        if (userType === "admin" && !user.role) {
          user.role = selectedTemplate
        }
        return user
      })

      const results: ImportResult[] = []
      const batchSize = 5

      for (let i = 0; i < processedUsers.length; i += batchSize) {
        const batch = processedUsers.slice(i, i + batchSize)

        for (const userData of batch) {
          try {

            let processedUserData = { ...userData }

            if (userData.role === "school_admin" || selectedTemplate === "school_admin") {

              const {
                school_name, school_type, country, province, district, sector, cell, village,
                contact_name, contact_email, contact_phone,
                ...cleanUserData
              } = userData

              processedUserData = {
                ...cleanUserData,
                school_data: {
                  name: school_name,
                  type: school_type,
                  country: country || "RW",
                  province: province,
                  district: district,
                  sector: sector,
                  cell: cell,
                  village: village,
                  contact_name: contact_name,
                  contact_email: contact_email,
                  contact_phone: contact_phone,
                }
              }
            }

            const result = userType === "admin"
                ? await bulkCreateUsers({
                  admin_token: token,
                  users: [processedUserData]
                })
                : await bulkCreateUsers({
                  school_admin_token: token,
                  students: [processedUserData]
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
                  role: userData.role || selectedTemplate,
                  grade: userData.grade
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
                role: userData.role || selectedTemplate,
                grade: userData.grade
              }
            })
          }
        }

        setProgress(Math.min(((i + batchSize) / processedUsers.length) * 100, 100))
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      setImportResults(results)
      setShowResults(true)

      const successCount = results.filter(r => r.success).length
      const failureCount = results.filter(r => !r.success).length

      if (successCount > 0) {
        toast.success(`${successCount} ${userType === "school" ? "students" : "users"} imported successfully`)
      }
      if (failureCount > 0) {
        toast.error(`${failureCount} ${userType === "school" ? "students" : "users"} failed to import`)
      }

      if (onUsersImported && successCount > 0) {
        onUsersImported()
      }

    } catch (error: any) {
      toast.error(error.message?.split("Uncaught Error:")[1]?.split(/\.|Called by client/)[0]?.trim() || `Failed to import ${userType === "school" ? "students" : "users"}`)
    } finally {
      setLoading(false)
    }
  }

  const downloadTemplate = () => {
    const csvContent = userType === "school" ? schoolStudentTemplate : csvTemplates[selectedTemplate]
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${userType === "school" ? "students" : selectedTemplate}_import_template.csv`
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
      `Name,Email,${userType === "admin" ? "Role" : "Grade"},Status,Temporary Password,Reset Link`,
      ...importResults.map(result => {
        const status = result.success ? "Success" : "Failed"
        const password = result.tempPassword || "N/A"
        const link = result.resetLink || "N/A"
        const roleOrGrade = userType === "admin" ? (result.userData.role || "N/A") : (result.userData.grade || "N/A")
        return `"${result.userData.name}","${result.userData.email}","${roleOrGrade}","${status}","${password}","${link}"`
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
    setSelectedTemplate("student")
    onOpenChange(false)
  }

  const getTemplateGuidelines = () => {
    if (userType === "school") {
      return (
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• All imported users will be students in your school</li>
            <li>• <strong>Required fields:</strong> name, email, phone, grade, security_question, security_answer</li>
            <li>• <strong>Optional fields:</strong> gender</li>
            <li>• Students will be automatically assigned to your school</li>
            <li>• Leave unused columns empty in your CSV</li>
            <li>• Temporary passwords will be generated automatically</li>
            <li>• Reset links will be provided for each student</li>
          </ul>
      )
    }

    switch (selectedTemplate) {
      case "student":
        return (
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• <strong>Required fields:</strong> name, email, phone, role, grade, school_name, security_question, security_answer</li>
              <li>• <strong>Optional fields:</strong> gender</li>
              <li>• <strong>School names must match exactly</strong> with existing active schools in the database</li>
              <li>• Leave unused columns empty in your CSV</li>
              <li>• Temporary passwords will be generated automatically</li>
              <li>• Reset links will be provided for each student</li>
            </ul>
        )
      case "school_admin":
        return (
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• <strong>Required fields:</strong> name, email, phone, role, position, school_name, school_type, country, province, district, contact_name, contact_email</li>
              <li>• <strong>Optional fields:</strong> gender, sector, cell, village, contact_phone</li>
              <li>• <strong>School types:</strong> Private, Public, Government Aided, International</li>
              <li>• A new school will be created for each school admin</li>
              <li>• Use country code &#34;RW&#34; for Rwanda with full location details</li>
              <li>• Leave unused columns empty in your CSV</li>
              <li>• Temporary passwords will be generated automatically</li>
              <li>• Reset links will be provided for each admin</li>
            </ul>
        )
      case "volunteer":
        return (
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• <strong>Required fields:</strong> name, email, phone, role, date_of_birth, national_id, high_school_attended</li>
              <li>• <strong>Optional fields:</strong> gender</li>
              <li>• <strong>Date format:</strong> YYYY-MM-DD (e.g., 1985-05-20)</li>
              <li>• Leave unused columns empty in your CSV</li>
              <li>• Temporary passwords will be generated automatically</li>
              <li>• Reset links will be provided for each volunteer</li>
            </ul>
        )
      case "admin":
        return (
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• <strong>Required fields:</strong> name, email, phone, role</li>
              <li>• <strong>Optional fields:</strong> gender</li>
              <li>• Admins have full system access</li>
              <li>• Leave unused columns empty in your CSV</li>
              <li>• Temporary passwords will be generated automatically</li>
              <li>• Reset links will be provided for each admin</li>
            </ul>
        )
      default:
        return null
    }
  }

  if (showResults) {
    const successfulResults = importResults.filter(r => r.success)
    const failedResults = importResults.filter(r => !r.success)

    return (
        <Dialog open={open} onOpenChange={handleClose}>
          <DialogContent className="sm:max-w-3xl max-h-[70vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Import Results</DialogTitle>
              <DialogDescription>
                {successfulResults.length} {userType === "school" ? "students" : "users"} imported successfully, {failedResults.length} failed.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex gap-4">
                  <Badge variant="secondary" className="text-green-600 bg-green-100">
                    <CircleCheck className="h-4 w-4 mr-1" />
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
                                <h4 className="text-sm font-medium">{result.userData.name}</h4>
                                <p className="text-xs text-muted-foreground">
                                  {result.userData.email} • {userType === "admin" ? result.userData.role : result.userData.grade}
                                </p>
                              </div>
                              <Badge className="bg-green-100 text-green-700">
                                <CircleCheck className="h-4 w-4 mr-1" />
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
                                <h4 className="text-sm font-medium">{result.userData.name}</h4>
                                <p className="text-xs text-muted-foreground">
                                  {result.userData.email} • {userType === "admin" ? result.userData.role : result.userData.grade}
                                </p>
                              </div>
                              <Badge variant="destructive">
                                <XCircle className="h-4 w-4 mr-1" />
                                Failed
                              </Badge>
                            </div>
                            {result.error && (
                                <Alert className="mt-3 text-sm">
                                  <div className="flex items-center justify-start gap-2">
                                  <AlertCircle className="h-4 w-4" />
                                  <AlertDescription className="text-xs">{result.error}</AlertDescription>
                                  </div>
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
            <DialogTitle>Import {userType === "school" ? "Students" : "Users"}</DialogTitle>
            <DialogDescription>
              Upload a CSV file to import multiple {userType === "school" ? "students" : "users"} at once. Download the template to see the required format.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">CSV Template</h4>
                <div className="flex items-center gap-2">
                  {userType === "admin" && (
                      <Select value={selectedTemplate} onValueChange={(value: TemplateType) => setSelectedTemplate(value)}>
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="student">Student</SelectItem>
                          <SelectItem value="school_admin">School Admin</SelectItem>
                          <SelectItem value="volunteer">Volunteer</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                  )}
                  <Button variant="outline" size="sm" onClick={downloadTemplate}>
                    <Download className="h-4 w-4 mr-2" />
                    Download Template
                  </Button>
                </div>
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
                    <CircleCheck className="h-4 w-4" />
                    <AlertDescription>
                      File &#34;{uploadedFile.name}&#34; selected. Ready to import.
                    </AlertDescription>
                  </Alert>
              )}

              {loading && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Importing {userType === "school" ? "students" : "users"}...</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} className="w-full" />
                  </div>
              )}
            </div>

            <div className="space-y-3">
              <h4 className="font-medium">Import Guidelines</h4>
              {getTemplateGuidelines()}
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
                    Import {userType === "school" ? "Students" : "Users"}
                  </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  )
}