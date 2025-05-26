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
import { type DateRange } from "react-day-picker"

interface DateRangePickerProps {
  className?: string
  dateRange?: DateRange
  onDateRangeChange?: (range: DateRange | undefined) => void
  disabled?: boolean
  placeholder?: string
  maxDate?: Date
  minDate?: Date
  error?: string
  showYearSwitcher?: boolean
  numberOfMonths?: number
}

export default function DateRangePicker({
                                          className,
                                          dateRange,
                                          onDateRangeChange,
                                          disabled,
                                          placeholder = "Pick a date range",
                                          maxDate,
                                          minDate,
                                          error,
                                          showYearSwitcher = true,
                                          numberOfMonths = 2
                                        }: DateRangePickerProps) {
  const [date, setDate] = React.useState<DateRange | undefined>(dateRange)

  React.useEffect(() => {
    if (dateRange !== date) {
      setDate(dateRange)
    }
  }, [dateRange])

  const handleDateChange = (newDate: DateRange | undefined) => {
    setDate(newDate)
    onDateRangeChange?.(newDate)
  }

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-start text-left font-normal min-w-[300px]",
              !date && "text-muted-foreground",
              error && "border-destructive"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "LLL dd, y")} -{" "}
                  {format(date.to, "LLL dd, y")}
                </>
              ) : (
                format(date.from, "LLL dd, y")
              )
            ) : (
              <span>{placeholder}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            autoFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={handleDateChange}
            numberOfMonths={numberOfMonths}
            showYearSwitcher={showYearSwitcher}
            disabled={(date) => {
              const isAfterMax = maxDate ? date > maxDate : false
              const isBeforeMin = minDate ? date < minDate : date < new Date("1900-01-01")
              return isAfterMax || isBeforeMin
            }}
          />
        </PopoverContent>
      </Popover>
      {error && (
        <p className="text-destructive text-xs mt-1">{error}</p>
      )}
    </div>
  )
}