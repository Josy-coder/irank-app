import React from "react";
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { X } from "lucide-react"
import { Search, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface DataToolbarProps {
  searchTerm: string
  onSearchChange: (value: string) => void
  onReset: () => void
  filters?: React.ReactNode[]
  actions?: React.ReactNode[]
  isLoading?: boolean
  selectedCount?: number
  bulkActions?: Array<{
    label: string
    icon: React.ReactNode
    onClick: () => void
    variant?: "default" | "destructive"
  }>
  searchPlaceholder?: string
  hideSearch?: boolean
}

export function DataToolbar({
                              searchTerm,
                              onSearchChange,
                              onReset,
                              filters,
                              actions,
                              isLoading = false,
                              selectedCount = 0,
                              bulkActions = [],
                              searchPlaceholder = "Search...",
                              hideSearch = false,
                            }: DataToolbarProps) {
  const hasFilters = filters && filters.some(filter =>
    React.isValidElement(filter) &&
    (() => {
      const selected = (filter as React.ReactElement<{ selected?: any[] }>).props.selected;
      return selected !== undefined && selected.length > 0;
    })()
  );


  return (
    <div className="w-full bg-brown p-4 space-y-4 md:space-y-0 md:flex md:items-center md:justify-between">
      <div className="flex flex-col space-y-4 md:space-y-0 md:flex-row md:items-center md:space-x-4 flex-1">
        {!hideSearch && (
          <div className="relative w-full md:w-52">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className={cn("h-9 pl-9 pr-8 bg-white", isLoading && "opacity-50")}
              disabled={isLoading}
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSearchChange("")}
                className="absolute right-0 top-0 h-9 px-2 hover:bg-transparent"
                disabled={isLoading}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Clear search</span>
              </Button>
            )}
          </div>
        )}
        <div className="flex items-center space-x-1 flex-wrap">
          {filters}
          {(hasFilters || searchTerm) && (
            <Button
              variant="ghost"
              onClick={onReset}
              className="h-8 px-1 text-white hover:bg-white/10"
              disabled={isLoading}
            >
              <span className="hidden md:block">Reset</span>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {selectedCount > 0 && bulkActions.length > 0 && (
          <div className="flex items-center gap-2 mr-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 border-white/20">
                  {selectedCount > 0 ? `${selectedCount} selected` : 'Actions'}
                  <ChevronDown className="h-4 w-4 " />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions ({selectedCount} selected)</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {bulkActions.map((action, index) => (
                  <DropdownMenuItem
                    key={index}
                    onClick={action.onClick}
                    className={cn(
                      "flex items-center gap-2",
                      action.variant === "destructive" && "text-red-600"
                    )}
                  >
                    {action.icon}
                    {action.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
        {actions}
      </div>
    </div>
  )
}