import React from "react"
import { cn } from "@/lib/utils"

interface CardLayoutWithToolbarProps {
  title?: string
  description?: string
  toolbar: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function CardLayoutWithToolbar({
                                        title,
                                        description,
                                        toolbar,
                                        children,
                                        className
                                      }: CardLayoutWithToolbarProps) {
  return (
    <div className="space-y-6">
      {(title || description) && (
        <div>
          {description && <p className="text-muted-foreground">{description}</p>}
        </div>
      )}

      <div className={cn("w-full rounded-md overflow-hidden border border-[#E2E8F0] bg-background", className)}>
        {toolbar}
        <div className="w-full bg-background">
          {children}
        </div>
      </div>
    </div>
  )
}