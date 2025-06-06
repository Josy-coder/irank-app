"use client"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import * as React from "react"

interface DatePickerProps {
  date?: Date
  onDateChange?: (date: Date | undefined) => void
  disabled?: boolean
  placeholder?: string
  className?: string
  maxDate?: Date
  minDate?: Date
  error?: string
  showYearSwitcher?: boolean
}

export default function DatePicker({
                                     date,
                                     onDateChange,
                                     disabled,
                                     placeholder = "Pick a date",
                                     className,
                                     maxDate,
                                     minDate,
                                     error,
                                     showYearSwitcher = true
                                   }: DatePickerProps) {
  return (
    <div className="space-y-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-start text-left font-normal",
              !date && "text-muted-foreground",
              error && "border-destructive",
              className
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, "PPP") : <span>{placeholder}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={onDateChange}
            disabled={(date) => {
              const isAfterMax = maxDate ? date > maxDate : false
              const isBeforeMin = minDate ? date < minDate : date < new Date("1900-01-01")
              return isAfterMax || isBeforeMin
            }}
            showYearSwitcher={showYearSwitcher}
            autoFocus
          />
        </PopoverContent>
      </Popover>
      {error && (
        <p className="text-destructive text-xs mt-1">{error}</p>
      )}
    </div>
  )
}