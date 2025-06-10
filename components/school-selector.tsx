"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Search, Building2, Trophy, Calendar, User } from "lucide-react";
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Skeleton } from "@/components/ui/skeleton"
import { useDebounce } from "@/hooks/use-debounce"

interface SchoolSelectorProps {
  value?: string
  onValueChange: (value: string | undefined) => void
  placeholder?: string
  emptyMessage?: string
  className?: string
  disabled?: boolean
  required?: boolean
}

function SchoolSelector({
                          value,
                          onValueChange,
                          placeholder = "Select school...",
                          emptyMessage = "No schools found.",
                          className,
                          disabled = false,
                        }: SchoolSelectorProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const debouncedSearch = useDebounce(search, 300)

  const schoolsQuery = useQuery(api.functions.schools.getSchoolsForSelection, {
    search: debouncedSearch,
    limit: 50,
  })

  const schools = schoolsQuery || []
  const isLoading = schoolsQuery === undefined

  const selectedSchool = schools.find((school) => school.id === value)

  const handleSelect = (selectedValue: string) => {
    if (selectedValue === value) {
      onValueChange(undefined)
    } else {
      onValueChange(selectedValue)
    }
    setOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onValueChange(undefined)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between h-[34px]", className)}
          disabled={disabled}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
            {selectedSchool ? (
              <div className="flex flex-col items-start min-w-0 flex-1">
                <span className="truncate font-medium">
                  {selectedSchool.name}
                </span>
                <span className="text-xs text-muted-foreground truncate">
                  {selectedSchool.type} • {selectedSchool.location}
                </span>
              </div>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {selectedSchool && !disabled && (
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                onClick={handleClear}
              >
                <span className="sr-only">Clear selection</span>
                ×
              </Button>
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 max-w-sm" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search schools..."
            value={search}
            onValueChange={setSearch}
            className="h-9"
          />
          <CommandList className="max-h-64">
            {isLoading ? (
              <div className="p-2">
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center space-x-2">
                      <Skeleton className="h-4 w-4 rounded" />
                      <div className="space-y-1 flex-1">
                        <Skeleton className="h-4 w-[200px]" />
                        <Skeleton className="h-3 w-[150px]" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : schools.length === 0 ? (
              <CommandEmpty className="py-6 text-center">
                <div className="flex flex-col items-center gap-2">
                  <Search className="h-8 w-8 text-muted-foreground" />
                  <div className="text-sm text-muted-foreground">
                    {debouncedSearch.length > 0
                      ? `No schools found for "${debouncedSearch}"`
                      : emptyMessage
                    }
                  </div>
                  {debouncedSearch.length === 0 && (
                    <div className="text-xs text-muted-foreground">
                      Can&#39;t find your school? <br/> Contact the administrator.
                    </div>
                  )}
                </div>
              </CommandEmpty>
            ) : (
              <CommandGroup>
                {schools.map((school) => (
                  <CommandItem
                    key={school.id}
                    value={school.id}
                    onSelect={handleSelect}
                    className="flex items-center gap-2 p-3"
                  >
                    <Check
                      className={cn(
                        "h-4 w-4",
                        value === school.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex flex-col items-start min-w-0 flex-1">
                      <span className="font-medium truncate w-full">
                        {school.name}
                      </span>
                      <span className="text-xs text-muted-foreground truncate w-full">
                        {school.type} • {school.location}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

interface VolunteerSchoolSelectorProps {
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

function VolunteerSchoolSelector({
                                   value,
                                   onValueChange,
                                   placeholder = "Enter your high school name...",
                                   className,
                                   disabled = false,
                                 }: VolunteerSchoolSelectorProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const debouncedSearch = useDebounce(search, 300)

  const schoolsQuery = useQuery(api.functions.schools.getSchoolsForSelection, {
    search: debouncedSearch,
    limit: 20,
  })

  const schools = schoolsQuery || []
  const isLoading = schoolsQuery === undefined

  const handleSelectSchool = (schoolId: string) => {
    const school = schools.find(s => s.id === schoolId)
    if (school) {
      onValueChange(school.name)
    }
    setOpen(false)
  }

  const handleUseCustomName = () => {
    onValueChange(search)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full h-[34px] justify-between text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="truncate">
              {value || placeholder}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search schools..."
            value={search}
            onValueChange={setSearch}
            className="h-9"
          />
          <CommandList className="max-h-64">
            {isLoading ? (
              <div className="p-2">
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center space-x-2">
                      <Skeleton className="h-4 w-4 rounded" />
                      <div className="space-y-1 flex-1">
                        <Skeleton className="h-4 w-[200px]" />
                        <Skeleton className="h-3 w-[150px]" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {schools.length > 0 && (
                  <CommandGroup heading="Suggestions">
                    {schools.map((school) => (
                      <CommandItem
                        key={school.id}
                        value={school.id}
                        onSelect={handleSelectSchool}
                        className="flex items-center gap-2 p-3"
                      >
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <div className="flex flex-col items-start min-w-0 flex-1">
                          <span className="font-medium truncate w-full">{school.name}</span>
                          <span className="text-xs text-muted-foreground truncate w-full">
                            {school.type} • {school.location}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {debouncedSearch.length > 0 && (
                  <>
                    {schools.length > 0 && <div className="border-t" />}
                    <CommandGroup>
                      <CommandItem
                        value={`use-custom-${debouncedSearch}`}
                        onSelect={handleUseCustomName}
                        className="flex items-center gap-2 p-3"
                      >
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <div className="flex flex-col items-start min-w-0 flex-1">
                          <span className="font-medium truncate w-full">
                            Use &quot;{debouncedSearch}&quot;
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {schools.length === 0
                              ? "No matching schools found"
                              : "Use custom school name"
                            }
                          </span>
                        </div>
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}

                {debouncedSearch.length === 0 && schools.length === 0 && (
                  <CommandEmpty className="py-6 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Search className="h-8 w-8 text-muted-foreground" />
                      <div className="text-sm text-muted-foreground">
                        Start typing to search for schools
                      </div>
                    </div>
                  </CommandEmpty>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

interface GenericSelectorProps<T> {
  value?: string
  onValueChange: (value: string | undefined) => void
  items: T[]
  isLoading?: boolean
  searchValue: string
  onSearchChange: (value: string) => void
  getItemValue: (item: T) => string
  getItemLabel: (item: T) => string
  getItemDescription?: (item: T) => string
  getItemIcon?: (item: T) => React.ReactNode
  placeholder?: string
  emptyMessage?: string
  searchPlaceholder?: string
  className?: string
  disabled?: boolean
  allowClear?: boolean
  renderItem?: (item: T, isSelected: boolean) => React.ReactNode
}

function GenericSelector<T>({
                              value,
                              onValueChange,
                              items,
                              isLoading = false,
                              searchValue,
                              onSearchChange,
                              getItemValue,
                              getItemLabel,
                              getItemDescription,
                              getItemIcon,
                              placeholder = "Select item...",
                              emptyMessage = "No items found.",
                              searchPlaceholder = "Search...",
                              className,
                              disabled = false,
                              allowClear = true,
                              renderItem,
                            }: GenericSelectorProps<T>) {
  const [open, setOpen] = React.useState(false)

  const selectedItem = items.find((item) => getItemValue(item) === value)

  const handleSelect = (selectedValue: string) => {
    if (selectedValue === value) {
      onValueChange(undefined)
    } else {
      onValueChange(selectedValue)
    }
    setOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onValueChange(undefined)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={disabled}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {selectedItem && getItemIcon && getItemIcon(selectedItem)}
            {selectedItem ? (
              <div className="flex flex-col items-start min-w-0 flex-1">
                <span className="truncate font-medium">
                  {getItemLabel(selectedItem)}
                </span>
                {getItemDescription && (
                  <span className="text-xs text-muted-foreground truncate">
                    {getItemDescription(selectedItem)}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {selectedItem && allowClear && !disabled && (
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                onClick={handleClear}
              >
                <span className="sr-only">Clear selection</span>
                ×
              </Button>
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 max-w-sm" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={searchValue}
            onValueChange={onSearchChange}
            className="h-9"
          />
          <CommandList className="max-h-64">
            {isLoading ? (
              <div className="p-2">
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center space-x-2">
                      <Skeleton className="h-4 w-4 rounded" />
                      <div className="space-y-1 flex-1">
                        <Skeleton className="h-4 w-[200px]" />
                        <Skeleton className="h-3 w-[150px]" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : items.length === 0 ? (
              <CommandEmpty className="py-6 text-center">
                <div className="flex flex-col items-center gap-2">
                  <Search className="h-8 w-8 text-muted-foreground" />
                  <div className="text-sm text-muted-foreground">
                    {emptyMessage}
                  </div>
                </div>
              </CommandEmpty>
            ) : (
              <CommandGroup>
                {items.map((item) => {
                  const itemValue = getItemValue(item)
                  const isSelected = value === itemValue

                  if (renderItem) {
                    return (
                      <CommandItem
                        key={itemValue}
                        value={itemValue}
                        onSelect={handleSelect}
                      >
                        {renderItem(item, isSelected)}
                      </CommandItem>
                    )
                  }

                  return (
                    <CommandItem
                      key={itemValue}
                      value={itemValue}
                      onSelect={handleSelect}
                      className="flex items-center gap-2 p-3"
                    >
                      <Check
                        className={cn(
                          "h-4 w-4",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {getItemIcon && getItemIcon(item)}
                      <div className="flex flex-col items-start min-w-0 flex-1">
                        <span className="font-medium truncate w-full">
                          {getItemLabel(item)}
                        </span>
                        {getItemDescription && (
                          <span className="text-xs text-muted-foreground truncate w-full">
                            {getItemDescription(item)}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

interface User {
  id: string
  name: string
  email: string
  role: string
}

interface UserSelectorProps {
  value?: string
  onValueChange: (value: string | undefined) => void
  role?: string
  placeholder?: string
  className?: string
  disabled?: boolean
}

function UserSelector({
                        value,
                        onValueChange,
                        role,
                        placeholder = "Select user...",
                        className,
                        disabled = false,
                      }: UserSelectorProps) {
  const [search, setSearch] = React.useState("")

  const users: User[] = []
  const isLoading = false

  return (
    <GenericSelector
      value={value}
      onValueChange={onValueChange}
      items={users}
      isLoading={isLoading}
      searchValue={search}
      onSearchChange={setSearch}
      getItemValue={(user) => user.id}
      getItemLabel={(user) => user.name}
      getItemDescription={(user) => `${user.email} • ${user.role}`}
      getItemIcon={() => <User className="h-4 w-4 text-muted-foreground shrink-0" />}
      placeholder={placeholder}
      emptyMessage="No users found."
      searchPlaceholder="Search users..."
      className={className}
      disabled={disabled}
    />
  )
}

export {
  SchoolSelector,
  VolunteerSchoolSelector,
  UserSelector,
}