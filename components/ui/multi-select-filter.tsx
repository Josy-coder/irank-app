import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { CirclePlus, Filter } from "lucide-react";
import { cn } from "@/lib/utils"

interface MultiSelectFilterProps {
  title: string
  options: { value: string; label: string; icon?: React.ReactNode }[]
  selected: string[]
  onSelectionChange: (values: string[]) => void
}

export function MultiSelectFilter({
                                    title,
                                    options,
                                    selected,
                                    onSelectionChange
                                  }: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false)

  const handleSelect = (value: string) => {
    if (value === "all") {
      onSelectionChange([])
    } else {
      const newSelected = selected.includes(value)
        ? selected.filter(v => v !== value)
        : [...selected, value]
      onSelectionChange(newSelected)
    }
  }

  const displayText = selected.length === 0
    ? title
    : selected.length === 1
      ? options.find(o => o.value === selected[0])?.label || title
      : `${selected.length} selected`

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 bg-primary text-white border-dashed ">
          <CirclePlus className="h-4 w-4" />
          {displayText}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-0" align="start">
        <div className="p-2">
          <div
            className={cn(
              "flex items-center px-2 py-1.5 text-sm rounded-sm cursor-pointer hover:bg-accent",
              selected.length === 0 && "bg-accent"
            )}
            onClick={() => handleSelect("all")}
          >
            <div className="w-4 h-4 mr-2 flex items-center justify-center">
              {selected.length === 0 && <div className="w-2 h-2 bg-primary rounded-full" />}
            </div>
            All {title}
          </div>
          {options.filter(o => o.value !== "all").map(option => (
            <div
              key={option.value}
              className="flex items-center px-2 py-1.5 text-sm rounded-sm cursor-pointer hover:bg-accent"
              onClick={() => handleSelect(option.value)}
            >
              <Checkbox
                checked={selected.includes(option.value)}
                className="mr-2 h-4 w-4"
              />
              {option.icon && <div className="mr-2">{option.icon}</div>}
              {option.label}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}