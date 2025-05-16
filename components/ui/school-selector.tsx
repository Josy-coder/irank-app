"use client"

import * as React from "react"
import { Check, ChevronsUpDown, PlusCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"

interface School {
  _id: Id<"schools">
  name: string
  type: "Private" | "Public" | "Government Aided" | "International"
  country: string
  province?: string
  district?: string
  sector?: string
  contact_name: string
  contact_email: string
  contact_phone?: string
  logo_url?: Id<"_storage">
  status: "active" | "inactive" | "banned"
}

interface SchoolSelectorProps {
  value: string
  onChange: (value: string) => void
  role: string
  onAddSchool?: (school: School) => void
  disabled?: boolean
  error?: string
  country?: string
  type?: "Private" | "Public" | "Government Aided" | "International"
  province?: string
}

export function SchoolSelector({
                                 value,
                                 onChange,
                                 role,
                                 onAddSchool,
                                 disabled = false,
                                 error,
                                 country,
                                 type,
                                 province,
                               }: SchoolSelectorProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [addSchoolOpen, setAddSchoolOpen] = useState(false)

  const [newSchoolName, setNewSchoolName] = useState("")
  const [newSchoolType, setNewSchoolType] = useState<string>("")
  const [newSchoolCountry, setNewSchoolCountry] = useState("")
  const [newSchoolContactName, setNewSchoolContactName] = useState("")
  const [newSchoolContactEmail, setNewSchoolContactEmail] = useState("")
  const [newSchoolContactPhone, setNewSchoolContactPhone] = useState("")

  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [allSchools, setAllSchools] = useState<School[]>([])

  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      // Reset pagination when search changes
      setPage(1)
      setAllSchools([])
      setNextCursor(null)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  const schoolsResult = useQuery(api.functions.schools.getSchools, {
    search: debouncedSearch,
    type,
    country,
    province,
    page,
    limit: 20,
  })

  const addSchoolMutation = useMutation(api.functions.schools.createSchool)

  useEffect(() => {
    if (schoolsResult) {
      if (page === 1) {
        setAllSchools(schoolsResult.schools)
      } else {
        setAllSchools(prev => [...prev, ...schoolsResult.schools])
      }

      setHasMore(schoolsResult.hasMore)
      setNextCursor(schoolsResult.nextPage)
    }
  }, [schoolsResult, page])

  const selectedSchool = React.useMemo(() => {
    return allSchools.find((school) => school._id === value)
  }, [value, allSchools])

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const bottom = e.currentTarget.scrollHeight - e.currentTarget.scrollTop === e.currentTarget.clientHeight
    if (bottom && hasMore && nextCursor) {
      setPage(prev => prev + 1)
    }
  }

  // Handle creating a new school
  const handleAddSchool = async () => {
    if (!newSchoolName.trim() || !newSchoolType || !newSchoolCountry.trim() || !newSchoolContactName.trim() || !newSchoolContactEmail.trim()) {
      toast.error("Please fill in all required fields.")
      return
    }

    try {
      if (role === 'volunteer') {
        // For volunteers, create a temporary school object
        const newSchool: School = {
          _id: `temp-${Date.now()}` as Id<"schools">,
          name: newSchoolName,
          type: newSchoolType as "Private" | "Public" | "Government Aided" | "International",
          country: newSchoolCountry,
          contact_name: newSchoolContactName,
          contact_email: newSchoolContactEmail,
          contact_phone: newSchoolContactPhone,
          status: "active"
        }

        if (onAddSchool) {
          onAddSchool(newSchool)
        }

        onChange(newSchool._id)
      } else {

        const schoolId = await addSchoolMutation({
          name: newSchoolName,
          type: newSchoolType as "Private" | "Public" | "Government Aided" | "International",
          country: newSchoolCountry,
          contact_name: newSchoolContactName,
          contact_email: newSchoolContactEmail,
          contact_phone: newSchoolContactPhone || undefined,
          status: "active",
        })

        onChange(schoolId)
      }

      setAddSchoolOpen(false)

      toast.success(`${newSchoolName} has been added`)

      setNewSchoolName("")
      setNewSchoolType("")
      setNewSchoolCountry("")
      setNewSchoolContactName("")
      setNewSchoolContactEmail("")
      setNewSchoolContactPhone("")
    } catch (error) {
      console.error('Error adding school:', error)
      toast.error("Failed to add school. Please try again.")
    }
  }

  const isLoading = schoolsResult === undefined

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "w-full justify-between",
              !value && "text-muted-foreground",
              error && "border-destructive"
            )}
          >
            {value && selectedSchool
              ? selectedSchool.name
              : "Select a school..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0">
          <Command>
            <CommandInput
              placeholder="Search schools..."
              className="h-9"
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList className="max-h-[300px] overflow-auto" onScroll={handleScroll}>
              <CommandEmpty className="py-6 text-center text-sm">
                {isLoading ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                    <span>Loading schools...</span>
                  </div>
                ) : (
                  <>
                    <p>No school found.</p>
                    {(role === 'volunteer' || role === 'admin') && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {role === 'volunteer' ? "Add your school manually if it's not listed." : "Add a new school to the system."}
                      </p>
                    )}
                  </>
                )}
              </CommandEmpty>

              <CommandGroup>
                {allSchools.map((school) => (
                  <CommandItem
                    key={String(school._id)}
                    value={String(school._id)}
                    onSelect={(currentValue) => {
                      onChange(currentValue)
                      setOpen(false)
                    }}
                    className="flex justify-between"
                  >
                    <div className="flex flex-col">
                      <span>{school.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {school.type}, {school.country}
                        {school.province ? `, ${school.province}` : ''}
                      </span>
                    </div>
                    <Check
                      className={cn(
                        "ml-auto h-4 w-4",
                        value === String(school._id) ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>

              {hasMore && (
                <div className="py-2 text-center text-xs text-muted-foreground">
                  Scroll for more schools
                </div>
              )}

              {(role === 'volunteer' || role === 'admin') && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <DialogTrigger asChild>
                      <CommandItem
                        onSelect={() => {
                          setAddSchoolOpen(true)
                          setOpen(false)
                        }}
                      >
                        <PlusCircle className="mr-2 h-4 w-4" />
                        <span>{role === 'volunteer' ? "Add my school manually" : "Add new school"}</span>
                      </CommandItem>
                    </DialogTrigger>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {error && (
        <p className="text-destructive text-xs mt-1">{error}</p>
      )}

      <Dialog open={addSchoolOpen} onOpenChange={setAddSchoolOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {role === 'volunteer' ? "Add your former high school" : "Add a new school"}
            </DialogTitle>
            <DialogDescription>
              {role === 'volunteer'
                ? "If your high school isn't in our database, you can add it manually."
                : "Add a new school to the database."
              }
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">School name*</Label>
              <Input
                id="name"
                value={newSchoolName}
                onChange={(e) => setNewSchoolName(e.target.value)}
                placeholder="E.g. St. Patrick's High School"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">School type*</Label>
              <Select value={newSchoolType} onValueChange={setNewSchoolType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select school type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Private">Private</SelectItem>
                  <SelectItem value="Public">Public</SelectItem>
                  <SelectItem value="Government Aided">Government Aided</SelectItem>
                  <SelectItem value="International">International</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">Country*</Label>
              <Input
                id="country"
                value={newSchoolCountry}
                onChange={(e) => setNewSchoolCountry(e.target.value)}
                placeholder="E.g. Rwanda"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactName">Contact Person Name*</Label>
              <Input
                id="contactName"
                value={newSchoolContactName}
                onChange={(e) => setNewSchoolContactName(e.target.value)}
                placeholder="E.g. John Doe"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactEmail">Contact Email*</Label>
              <Input
                id="contactEmail"
                value={newSchoolContactEmail}
                onChange={(e) => setNewSchoolContactEmail(e.target.value)}
                placeholder="E.g. john.doe@example.com"
                type="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactPhone">Contact Phone</Label>
              <Input
                id="contactPhone"
                value={newSchoolContactPhone}
                onChange={(e) => setNewSchoolContactPhone(e.target.value)}
                placeholder="E.g. +250 78 123 4567"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddSchoolOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleAddSchool}>
              Add School
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}