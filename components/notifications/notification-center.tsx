"use client"

import React, { useState } from "react"
import { formatDistanceToNow, isToday, isYesterday, format } from "date-fns"
import {
  Bell,
  CheckCheck,
  X,
  ExternalLink,
  Trophy,
  Users,
  Medal,
  Settings,
  UserCheck,
  Clock
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { useNotifications } from "@/hooks/use-notifications"
import { useRouter } from "next/navigation"

interface Notification {
  _id: string
  title: string
  message: string
  type: "tournament" | "debate" | "result" | "system" | "auth"
  related_id?: string
  is_read: boolean
  created_at: number
}

const typeIcons = {
  tournament: Trophy,
  debate: Users,
  result: Medal,
  system: Settings,
  auth: UserCheck,
}

const typeColors = {
  tournament: "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/20",
  debate: "text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950/20",
  result: "text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-950/20",
  system: "text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-950/20",
  auth: "text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-950/20",
}

const typeLabels = {
  tournament: "Tournament",
  debate: "Debate",
  result: "Result",
  system: "System",
  auth: "Account",
}

function getNotificationUrl(type: string, related_id: string): string {
  switch (type) {
    case "tournament":
      return `/tournaments/${related_id}`
    case "debate":
      return `/debates/${related_id}`
    case "result":
      return "/results"
    case "system":
      return "/settings"
    case "auth":
      return "/profile"
    default:
      return "/dashboard"
  }
}

function getNotificationActions(notification: Notification) {
  switch (notification.type) {
    case "tournament":
      return [
        { label: "View Tournament", variant: "default" as const },
        { label: "Remind me later", variant: "outline" as const }
      ]
    case "debate":
      return [
        { label: "Join Debate", variant: "default" as const },
        { label: "Check Schedule", variant: "outline" as const }
      ]
    case "result":
      return [
        { label: "View Results", variant: "default" as const }
      ]
    default:
      return []
  }
}

function getDateGroup(date: Date): string {
  if (isToday(date)) return "Today"
  if (isYesterday(date)) return "Yesterday"
  return format(date, "MMMM d, yyyy")
}

function groupNotificationsByDate(notifications: Notification[]) {
  const groups: Record<string, Notification[]> = {}

  notifications.forEach(notification => {
    const date = new Date(notification.created_at)
    const group = getDateGroup(date)

    if (!groups[group]) {
      groups[group] = []
    }
    groups[group].push(notification)
  })

  return groups
}

interface NotificationItemProps {
  notification: Notification
  onClose: () => void
  isInDropdown?: boolean
}

function NotificationItem({ notification, onClose, isInDropdown = false }: NotificationItemProps) {
  const { markAsRead } = useNotifications()
  const router = useRouter()
  const [isMarkingRead, setIsMarkingRead] = useState(false)

  const Icon = typeIcons[notification.type] || Settings
  const iconColorClass = typeColors[notification.type] || typeColors.system
  const actions = getNotificationActions(notification)

  const handleClick = async () => {
    if (!notification.is_read) {
      setIsMarkingRead(true)
      try {
        await markAsRead(notification._id)
      } catch (error) {
        console.error("Failed to mark as read:", error)
      } finally {
        setIsMarkingRead(false)
      }
    }

    if (notification.related_id) {
      const url = getNotificationUrl(notification.type, notification.related_id)
      router.push(url)
      onClose()
    }
  }

  const handleMarkRead = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsMarkingRead(true)
    try {
      await markAsRead(notification._id)
    } catch (error) {
      console.error("Failed to mark as read:", error)
    } finally {
      setIsMarkingRead(false)
    }
  }

  const handleAction = (action: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (action === "View Tournament" || action === "Join Debate" || action === "View Results") {
      handleClick()
    }
  }

  if (isInDropdown) {
    return (
      <div
        className={cn(
          "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 relative",
          !notification.is_read && "bg-blue-50/30 dark:bg-blue-950/10 border-blue-200/50 dark:border-blue-800/50",
          notification.is_read && "border-gray-200 dark:border-gray-700"
        )}
        onClick={handleClick}
      >
        <Avatar className="w-8 h-8 border">
          <AvatarFallback className={cn("text-xs", iconColorClass)}>
            <Icon className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className={cn(
                "text-sm font-medium mb-1",
                !notification.is_read && "font-semibold"
              )}>
                {notification.title}
              </p>
              <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                {notification.message}
              </p>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {typeLabels[notification.type]}
                </Badge>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>

            {!notification.is_read && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-primary rounded-full" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                  onClick={handleMarkRead}
                  disabled={isMarkingRead}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex items-start gap-4 p-4 rounded-xl border transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 relative",
        !notification.is_read && "bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-950/20 dark:to-transparent border-blue-200/50 dark:border-blue-800/30",
        notification.is_read && "border-gray-200 dark:border-gray-700"
      )}
    >
      <Avatar className="w-10 h-10 border">
        <AvatarFallback className={iconColorClass}>
          <Icon className="h-5 w-5" />
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <p className={cn(
                "font-medium",
                !notification.is_read && "font-semibold"
              )}>
                {notification.title}
              </p>
              {!notification.is_read && (
                <div className="w-2 h-2 bg-primary rounded-full" />
              )}
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              {notification.message}
            </p>

            {actions.length > 0 && (
              <div className="flex items-center gap-2 mb-3">
                {actions.map((action, index) => (
                  <Button
                    key={index}
                    variant={action.variant}
                    size="sm"
                    className="h-8"
                    onClick={(e) => handleAction(action.label, e)}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="text-xs">
                  {typeLabels[notification.type]}
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
              </div>
              {notification.related_id && (
                <div className="flex items-center gap-1 cursor-pointer text-primary hover:underline" onClick={handleClick}>
                  <ExternalLink className="h-3 w-3" />
                  <span>View Details</span>
                </div>
              )}
            </div>
          </div>

          {!notification.is_read && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
              onClick={handleMarkRead}
              disabled={isMarkingRead}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export function NotificationCenter() {
  const { notifications, unreadCount, markAllAsRead, isLoading } = useNotifications()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead()
    } catch (error) {
      console.error("Failed to mark all as read:", error)
    }
  }

  const recentNotifications = notifications.slice(0, 5)

  const filteredNotifications = showUnreadOnly
    ? notifications.filter(n => !n.is_read)
    : notifications

  const groupedNotifications = groupNotificationsByDate(filteredNotifications)

  return (
    <>
      <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <div className="relative">
            <div className="w-8 h-8 bg-white border border-gray-200 dark:border-gray-700 rounded-full flex items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <Bell className="h-4 w-4 text-muted-foreground" />
            </div>
            {unreadCount > 0 && (
              <div className="absolute -top-1 -right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                <span className="text-xs text-white font-medium">{unreadCount > 9 ? "9+" : unreadCount}</span>
              </div>
            )}
          </div>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="w-96 p-0 max-h-[80vh]"
          sideOffset={8}
        >
          <div className="flex items-center justify-between p-4 border-b bg-gray-50/50 dark:bg-gray-800/50">
            <div>
              <h3 className="font-semibold">Notifications</h3>
              {unreadCount > 0 && (
                <p className="text-xs text-muted-foreground">{unreadCount} new</p>
              )}
            </div>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllAsRead}
                className="text-xs h-8 px-3 text-primary hover:bg-primary/10"
                disabled={isLoading}
              >
                Mark all as read
              </Button>
            )}
          </div>

          <ScrollArea className="h-[400px]">
            {isLoading ? (
              <div className="p-6 text-center text-muted-foreground">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                <p className="text-sm">Loading notifications...</p>
              </div>
            ) : recentNotifications.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="font-medium mb-1">No notifications yet</p>
                <p className="text-xs">We&#39;ll notify you when something happens</p>
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {recentNotifications.map((notification) => (
                  <NotificationItem
                    key={notification._id}
                    notification={notification}
                    onClose={() => setIsDropdownOpen(false)}
                    isInDropdown
                  />
                ))}
              </div>
            )}
          </ScrollArea>

          {notifications.length > 5 && (
            <div className="p-3 border-t bg-gray-50/50 dark:bg-gray-800/50">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  setIsDropdownOpen(false)
                  setIsSheetOpen(true)
                }}
              >
                View all notifications
              </Button>
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-[500px] sm:w-[600px] p-0 bg-background">
          <SheetHeader className="p-6 pb-4 border-b">
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notifications
                  {unreadCount > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {unreadCount} New
                    </Badge>
                  )}
                </SheetTitle>
                <SheetDescription>
                  Stay updated with your tournaments and debates
                </SheetDescription>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="show-unread"
                  checked={showUnreadOnly}
                  onCheckedChange={setShowUnreadOnly}
                />
                <Label htmlFor="show-unread" className="text-sm">
                  Show only unread
                </Label>
              </div>

              {unreadCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMarkAllAsRead}
                  disabled={isLoading}
                  className="text-xs"
                >
                  <CheckCheck className="h-4 w-4 mr-2" />
                  Mark all as read
                </Button>
              )}
            </div>
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-200px)]">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p>Loading notifications...</p>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">
                  {showUnreadOnly ? "No unread notifications" : "No notifications yet"}
                </p>
                <p className="text-sm">
                  {showUnreadOnly
                    ? "All caught up! Check back later for new updates."
                    : "When you receive notifications, they'll appear here"
                  }
                </p>
              </div>
            ) : (
              <div className="p-6">
                {Object.entries(groupedNotifications).map(([dateGroup, groupNotifications]) => (
                  <div key={dateGroup} className="mb-8 last:mb-0">
                    <div className="flex items-center gap-3 mb-4">
                      <h3 className="font-medium text-muted-foreground">{dateGroup}</h3>
                      <Separator className="flex-1" />
                    </div>
                    <div className="space-y-3">
                      {groupNotifications.map((notification) => (
                        <NotificationItem
                          key={notification._id}
                          notification={notification}
                          onClose={() => setIsSheetOpen(false)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  )
}