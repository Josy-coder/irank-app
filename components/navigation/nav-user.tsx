"use client"

import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function NavUser({
                          onSignOut,
                        }: {
  onSignOut: () => void
}) {
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"

  if (isCollapsed) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={onSignOut}
                variant="ghost"
                className="w-full p-3 flex justify-center text-white/80 hover:text-white hover:bg-white/10 rounded-lg"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              Sign Out
            </TooltipContent>
          </Tooltip>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Button
          onClick={onSignOut}
          variant="ghost"
          className="w-full text-white/80 hover:text-white hover:bg-white/10 border border-white/20 rounded-lg"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}