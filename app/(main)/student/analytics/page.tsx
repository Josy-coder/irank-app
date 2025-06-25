"use client"

import React, { useState, useMemo, useCallback } from "react"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent
} from "@/components/ui/chart"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Line,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  RadialBar,
  RadialBarChart,
} from "recharts"
import DateRangePicker from "@/components/date-range-picker"
import { useAuth } from "@/hooks/use-auth"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  TrendingUp,
  TrendingDown,
  Users,
  Trophy,
  Download,
  Target,
  Star,
  Minus,
  AlertTriangle,
  ChevronDown,
  Camera,
  FileText,
  FileSpreadsheet,
  Shield,
  Zap,
  Brain,
  Eye,
  Lightbulb,
  Crown,
  Medal,
  User,
  Activity,
  UserCheck,
  Swords,
  School,
  TrendingUpIcon,
  Heart,
  CheckCircle,
  Clock,
  Flame,
  PersonStanding
} from "lucide-react";
import * as XLSX from 'xlsx'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem } from "@/components/ui/dropdown-menu"

interface DateTimeRange {
  from?: Date
  to?: Date
}

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
]

function StatCard({
                    title,
                    value,
                    subtitle,
                    trend,
                    icon: Icon,
                    loading = false,
                    className
                  }: {
  title: string
  value: string | number
  subtitle: string
  trend?: number | null
  icon: React.ElementType
  loading?: boolean
  className?: string
}) {
  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-12 w-12 rounded-lg" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold">{value}</p>
              {trend !== undefined && trend !== null && (
                <Badge variant={trend >= 0 ? "default" : "destructive"} className="gap-1">
                  {trend >= 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {Math.abs(trend).toFixed(1)}%
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <div className="p-3 bg-primary/10 rounded-lg">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ChartSkeleton({ height = "h-[300px]" }: { height?: string }) {
  return (
    <div className={cn("w-full", height)}>
      <Skeleton className="h-full w-full" />
    </div>
  )
}

function ChartCard({
                     title,
                     description,
                     children,
                     loading = false,
                     className,
                     chartId,
                     onCopyImage
                   }: {
  title: string
  description?: string
  children: React.ReactNode
  loading?: boolean
  className?: string
  chartId?: string
  onCopyImage?: (chartId: string) => void
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {chartId && onCopyImage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onCopyImage(chartId)}>
                <Camera className="h-4 w-4 mr-2" />
                Copy as Image
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </CardHeader>
      <CardContent id={chartId}>
        {loading ? <ChartSkeleton /> : children}
      </CardContent>
    </Card>
  )
}

function InsightCard({ insight, loading }: { insight?: any; loading: boolean }) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!insight) return null

  const getInsightIcon = (type: string) => {
    switch (type) {
      case "achievement":
        return Trophy
      case "improvement":
        return TrendingUp
      case "concern":
        return AlertTriangle
      case "opportunity":
        return Lightbulb
      default:
        return Eye
    }
  }

  const getInsightColor = (type: string) => {
    switch (type) {
      case "achievement":
        return "text-green-600 bg-green-600/10"
      case "improvement":
        return "text-blue-600 bg-blue-600/10"
      case "concern":
        return "text-red-600 bg-red-600/10"
      case "opportunity":
        return "text-orange-600 bg-orange-600/10"
      default:
        return "text-gray-600 bg-gray-600/10"
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "border-red-200 bg-red-50"
      case "medium":
        return "border-orange-200 bg-orange-50"
      case "low":
        return "border-blue-200 bg-blue-50"
      default:
        return "border-gray-200 bg-gray-50"
    }
  }

  const Icon = getInsightIcon(insight.type)
  const colorClass = getInsightColor(insight.type)
  const priorityClass = getPriorityColor(insight.priority)

  return (
    <Card className={cn("border-l-4", priorityClass)}>
      <CardContent className="p-4">
        <div className="flex gap-3">
          <div className={cn("p-2 rounded-full", colorClass)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="font-semibold text-sm">{insight.title}</h4>
              <Badge variant="outline" className="text-xs">
                {insight.confidence}% confidence
              </Badge>
              <Badge variant={insight.priority === "high" ? "destructive" : insight.priority === "medium" ? "default" : "secondary"} className="text-xs capitalize">
                {insight.priority}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-3">{insight.description}</p>
            {insight.actionable_suggestions?.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Recommendations:</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {insight.actionable_suggestions.slice(0, 3).map((suggestion: string, index: number) => (
                    <li key={index} className="flex items-start gap-1">
                      <span className="text-primary">•</span>
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function PartnerCard({ partner, loading }: { partner?: any; loading: boolean }) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-6 w-12" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!partner) return null

  const getChemistryColor = (score: number) => {
    if (score >= 80) return "text-green-600 bg-green-600/10"
    if (score >= 60) return "text-blue-600 bg-blue-600/10"
    if (score >= 40) return "text-orange-600 bg-orange-600/10"
    return "text-red-600 bg-red-600/10"
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback>
              {partner.partner_name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-sm truncate">{partner.partner_name}</h4>
              <Badge variant="outline" className={cn("gap-1", getChemistryColor(partner.chemistry_score))}>
                <Heart className="h-3 w-3" />
                {partner.chemistry_score}%
              </Badge>
            </div>
            <div className="flex items-center gap-4 mt-1">
              <span className="text-xs text-muted-foreground">
                Tournaments: {partner.tournaments_together}
              </span>
              <span className="text-xs text-muted-foreground">
                Win Rate: {partner.win_rate_together}%
              </span>
            </div>
            {partner.best_performance && (
              <div className="mt-2">
                <p className="text-xs font-medium">
                  Best Together: #{partner.best_performance.team_rank} in {partner.best_performance.tournament_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  Combined Points: {partner.best_performance.combined_speaker_points}
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function RivalCard({ rival, loading }: { rival?: any; loading: boolean }) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-6 w-12" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!rival) return null

  const getRivalryColor = (strength: number) => {
    if (strength >= 80) return "text-red-600 bg-red-600/10"
    if (strength >= 60) return "text-orange-600 bg-orange-600/10"
    if (strength >= 40) return "text-blue-600 bg-blue-600/10"
    return "text-gray-600 bg-gray-600/10"
  }

  const getPerformanceIndicator = (yourRank: number, theirRank: number) => {
    if (yourRank < theirRank) return { icon: TrendingUp, color: "text-green-600", text: "Leading" }
    if (yourRank > theirRank) return { icon: TrendingDown, color: "text-red-600", text: "Behind" }
    return { icon: Minus, color: "text-gray-600", text: "Even" }
  }

  const indicator = getPerformanceIndicator(rival.comparative_performance.your_avg_rank, rival.comparative_performance.their_avg_rank)

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback>
              {rival.student_name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-sm truncate">{rival.student_name}</h4>
              <Badge variant="outline" className={cn("gap-1", getRivalryColor(rival.rivalry_strength))}>
                <Swords className="h-3 w-3" />
                {rival.rivalry_strength}%
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{rival.school_name}</p>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1">
                <indicator.icon className={cn("h-3 w-3", indicator.color)} />
                <span className="text-xs font-medium">{indicator.text}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                H2H: {rival.head_to_head_record.wins}W-{rival.head_to_head_record.losses}L
              </span>
            </div>
            <div className="mt-2 text-xs">
              <span className="text-muted-foreground">Avg Rank: </span>
              <span className="font-medium">You #{rival.comparative_performance.your_avg_rank}</span>
              <span className="text-muted-foreground"> vs </span>
              <span className="font-medium">Them #{rival.comparative_performance.their_avg_rank}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function GoalCard({ goal, loading }: { goal?: any; loading: boolean }) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-2 w-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!goal) return null

  const getTimelineColor = (targetDate: number) => {
    const now = Date.now()
    const daysLeft = Math.ceil((targetDate - now) / (24 * 60 * 60 * 1000))
    if (daysLeft < 0) return "text-red-600"
    if (daysLeft < 30) return "text-orange-600"
    return "text-green-600"
  }

  const timelineColor = getTimelineColor(goal.target_date)
  const daysLeft = Math.ceil((goal.target_date - Date.now()) / (24 * 60 * 60 * 1000))

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">{goal.title}</h4>
            <div className="flex items-center gap-1">
              <Clock className={cn("h-3 w-3", timelineColor)} />
              <span className={cn("text-xs", timelineColor)}>
                {daysLeft > 0 ? `${daysLeft}d left` : "Overdue"}
              </span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{goal.description}</p>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span>Progress</span>
              <span>{goal.progress_percentage}%</span>
            </div>
            <Progress value={goal.progress_percentage} className="h-2" />
          </div>
          {goal.milestones && goal.milestones.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium">Milestones:</p>
              {goal.milestones.slice(0, 2).map((milestone: any, index: number) => (
                <div key={index} className="flex items-center gap-2 text-xs">
                  <CheckCircle className={cn("h-3 w-3", milestone.completed ? "text-green-600" : "text-gray-400")} />
                  <span className={milestone.completed ? "line-through text-muted-foreground" : ""}>
                    {milestone.milestone}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function StudentAnalyticsPage() {
  const { token, user } = useAuth()
  const [dateRange, setDateRange] = useState<DateTimeRange | undefined>({
    from: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
    to: new Date(),
  })
  const [activeTab, setActiveTab] = useState("overview")

  const performanceData = useQuery(
    api.functions.student.analytics.getStudentPerformanceAnalytics,
    token && user?.role === "student" ? {
      token,
      date_range: dateRange ? {
        start: dateRange.from?.getTime() || Date.now() - (365 * 24 * 60 * 60 * 1000),
        end: dateRange.to?.getTime() || Date.now(),
      } : undefined,
      compare_to_previous_period: true,
    } : "skip"
  )

  const engagementData = useQuery(
    api.functions.student.analytics.getStudentEngagementAnalytics,
    token && user?.role === "student" && activeTab === "engagement" ? {
      token,
      date_range: dateRange ? {
        start: dateRange.from?.getTime() || Date.now() - (365 * 24 * 60 * 60 * 1000),
        end: dateRange.to?.getTime() || Date.now(),
      } : undefined,
    } : "skip"
  )

  const competitiveData = useQuery(
    api.functions.student.analytics.getStudentCompetitiveIntelligence,
    token && user?.role === "student" && activeTab === "competitive" ? {
      token,
    } : "skip"
  )

  const performanceTrendsConfig = useMemo(() => ({
    speaker_rank: { label: "Speaker Rank", color: "hsl(var(--chart-1))" },
    team_rank: { label: "Team Rank", color: "hsl(var(--chart-2))" },
    avg_score: { label: "Avg Score", color: "hsl(var(--chart-3))" },
  } as ChartConfig), [])

  const engagementConfig = useMemo(() => ({
    tournaments: { label: "Tournaments", color: "hsl(var(--chart-1))" },
    judging: { label: "Judging", color: "hsl(var(--chart-2))" },
    practice: { label: "Practice", color: "hsl(var(--chart-3))" },
    community: { label: "Community", color: "hsl(var(--chart-4))" },
  } as ChartConfig), [])

  const handleCopyChartImage = useCallback(async (chartId: string) => {
    try {
      const element = document.getElementById(chartId)
      if (!element) {
        toast.error("Chart not found")
        return
      }

      const canvas = await html2canvas(element, {
        backgroundColor: 'white',
        scale: 2,
        logging: false,
        useCORS: true,
      })

      canvas.toBlob(async (blob) => {
        if (blob) {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ])
          toast.success("Chart copied to clipboard as image!")
        }
      }, 'image/png')
    } catch (error) {
      console.error('Error copying chart:', error)
      toast.error("Failed to copy chart image")
    }
  }, [])

  const exportToExcel = useCallback(async () => {
    if (!performanceData) {
      toast.error("No data available for export")
      return
    }

    try {
      const workbook = XLSX.utils.book_new()

      if (performanceData.performance_trends) {
        const trendsWS = XLSX.utils.json_to_sheet(performanceData.performance_trends.map(trend => ({
          tournament_name: trend.tournament_name,
          date: new Date(trend.date).toLocaleDateString(),
          speaker_rank: trend.speaker_rank,
          speaker_points: trend.speaker_points,
          team_rank: trend.team_rank,
          avg_score: trend.avg_score,
        })))
        XLSX.utils.book_append_sheet(workbook, trendsWS, "Performance Trends")
      }

      if (performanceData.partner_analysis) {
        const partnersWS = XLSX.utils.json_to_sheet(performanceData.partner_analysis.map(partner => ({
          partner_name: partner.partner_name,
          tournaments_together: partner.tournaments_together,
          win_rate_together: partner.win_rate_together,
          chemistry_score: partner.chemistry_score,
        })))
        XLSX.utils.book_append_sheet(workbook, partnersWS, "Partner Analysis")
      }

      if (performanceData.tournament_analysis) {
        const tournamentsWS = XLSX.utils.json_to_sheet(performanceData.tournament_analysis.best_formats)
        XLSX.utils.book_append_sheet(workbook, tournamentsWS, "Tournament Analysis")
      }

      const timestamp = new Date().toISOString().split('T')[0]
      const filename = `student-analytics-${timestamp}.xlsx`

      XLSX.writeFile(workbook, filename)
      toast.success("Excel file downloaded successfully!")
    } catch (error) {
      console.error('Error exporting to Excel:', error)
      toast.error("Failed to export Excel file")
    }
  }, [performanceData])

  const exportToPDF = useCallback(async () => {
    if (!performanceData) {
      toast.error("No data available for export")
      return
    }

    try {
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 20
      let yPosition = margin

      pdf.setFontSize(24)
      pdf.setFont('helvetica', 'bold')
      pdf.text('Student Analytics Report', pageWidth / 2, yPosition, { align: 'center' })

      yPosition += 15
      pdf.setFontSize(12)
      pdf.setFont('helvetica', 'normal')
      const reportPeriod = `${dateRange?.from?.toLocaleDateString()} - ${dateRange?.to?.toLocaleDateString()}`
      pdf.text(`Report Period: ${reportPeriod}`, pageWidth / 2, yPosition, { align: 'center' })

      yPosition += 10
      pdf.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, yPosition, { align: 'center' })
      yPosition += 20

      const chartElements = Array.from(document.querySelectorAll('[id$="-chart"]'))

      for (let i = 0; i < chartElements.length; i++) {
        const element = chartElements[i] as HTMLElement
        if (yPosition > pageHeight - 100) {
          pdf.addPage()
          yPosition = margin
        }

        try {
          const canvas = await html2canvas(element, {
            backgroundColor: 'white',
            scale: 1,
            logging: false,
          })

          const imgData = canvas.toDataURL('image/png')
          const imgWidth = pageWidth - (margin * 2)
          const imgHeight = (canvas.height * imgWidth) / canvas.width

          if (yPosition + imgHeight > pageHeight - margin) {
            pdf.addPage()
            yPosition = margin
          }

          pdf.addImage(imgData, 'PNG', margin, yPosition, imgWidth, imgHeight)
          yPosition += imgHeight + 10
        } catch (error) {
          console.error('Error adding chart to PDF:', error)
        }
      }

      const timestamp = new Date().toISOString().split('T')[0]
      const filename = `student-analytics-${timestamp}.pdf`

      pdf.save(filename)
      toast.success("PDF report downloaded successfully!")
    } catch (error) {
      console.error('Error exporting to PDF:', error)
      toast.error("Failed to export PDF report")
    }
  }, [dateRange])

  const exportToCSV = useCallback(() => {
    if (!performanceData) {
      toast.error("No data available for export")
      return
    }

    try {
      let csvContent = "data:text/csv;charset=utf-8,"

      if (performanceData.performance_trends) {
        csvContent += "Performance Trends\n"
        csvContent += "Tournament,Date,Speaker Rank,Speaker Points,Team Rank,Avg Score\n"
        performanceData.performance_trends.forEach((trend: any) => {
          csvContent += `${trend.tournament_name},${new Date(trend.date).toLocaleDateString()},${trend.speaker_rank},${trend.speaker_points},${trend.team_rank},${trend.avg_score}\n`
        })
        csvContent += "\n"
      }

      if (performanceData.partner_analysis) {
        csvContent += "Partner Analysis\n"
        csvContent += "Partner,Tournaments Together,Win Rate,Chemistry Score\n"
        performanceData.partner_analysis.forEach((partner: any) => {
          csvContent += `${partner.partner_name},${partner.tournaments_together},${partner.win_rate_together},${partner.chemistry_score}\n`
        })
        csvContent += "\n"
      }

      const encodedUri = encodeURI(csvContent)
      const link = document.createElement("a")
      link.setAttribute("href", encodedUri)
      link.setAttribute("download", `student-analytics-${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast.success("CSV file downloaded successfully!")
    } catch (error) {
      console.error('Error exporting to CSV:', error)
      toast.error("Failed to export CSV file")
    }
  }, [performanceData])

  if (!token || !user || user.role !== "student") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-xl font-semibold mb-2">Access Denied</h1>
          <p className="text-muted-foreground">Only students can access this analytics dashboard.</p>
        </div>
      </div>
    )
  }

  const isLoading = performanceData === undefined

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">
        Track your debate journey with personalized insights and performance analytics
      </p>

      <Card>
        <div className="flex bg-brown rounded-t-md flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-6">
          <div>
            <DateRangePicker
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              placeholder="Select date range"
              className="bg-background rounded-md"
            />
          </div>

          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="default" size="sm" className="gap-2 hover:bg-background hover:text-black">
                  <Download className="h-4 w-4" />
                  Export
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="text-xs">
                <DropdownMenuItem onClick={exportToCSV}>
                  <FileText className="h-4 w-4" />
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToExcel}>
                  <FileSpreadsheet className="h-4 w-4" />
                  Export as Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToPDF}>
                  <FileText className="h-4 w-4" />
                  Export as PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="hidden md:grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="engagement">Engagement</TabsTrigger>
              <TabsTrigger value="competitive">Competitive</TabsTrigger>
            </TabsList>

            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t z-50">
              <div className="flex overflow-x-auto">
                <button
                  onClick={() => setActiveTab("overview")}
                  className={cn(
                    "flex-1 min-w-0 flex flex-col items-center gap-1 py-2 px-1 text-xs transition-colors",
                    activeTab === "overview"
                      ? "text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <User className="h-4 w-4 shrink-0" />
                  <span className="truncate text-[10px]">Overview</span>
                </button>

                <button
                  onClick={() => setActiveTab("engagement")}
                  className={cn(
                    "flex-1 min-w-0 flex flex-col items-center gap-1 py-2 px-1 text-xs transition-colors",
                    activeTab === "engagement"
                      ? "text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Activity className="h-4 w-4 shrink-0" />
                  <span className="truncate text-[10px]">Engagement</span>
                </button>

                <button
                  onClick={() => setActiveTab("competitive")}
                  className={cn(
                    "flex-1 min-w-0 flex flex-col items-center gap-1 py-2 px-1 text-xs transition-colors",
                    activeTab === "competitive"
                      ? "text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Swords className="h-4 w-4 shrink-0" />
                  <span className="truncate text-[10px]">Competitive</span>
                </button>
              </div>
            </div>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Current Rank"
                  value={performanceData?.personal_performance?.current_rank ? `#${performanceData.personal_performance.current_rank}` : "N/A"}
                  subtitle="Latest tournament ranking"
                  icon={Trophy}
                  loading={isLoading}
                />
                <StatCard
                  title="Best Rank"
                  value={performanceData?.personal_performance?.best_rank ? `#${performanceData.personal_performance.best_rank}` : "N/A"}
                  subtitle="Personal best achievement"
                  icon={Crown}
                  loading={isLoading}
                />
                <StatCard
                  title="Avg Speaker Score"
                  value={performanceData?.personal_performance?.avg_speaker_score?.toFixed(1) || "0.0"}
                  subtitle="Average across tournaments"
                  icon={Star}
                  loading={isLoading}
                />
                <StatCard
                  title="Win Rate"
                  value={`${performanceData?.personal_performance?.win_rate?.toFixed(1) || 0}%`}
                  subtitle="Tournament win percentage"
                  icon={Target}
                  loading={isLoading}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <ChartCard
                  title="Performance Trends"
                  description="Your ranking progression over time"
                  loading={isLoading}
                  className="lg:col-span-2"
                  chartId="performance-trends-chart"
                  onCopyImage={handleCopyChartImage}
                >
                  {performanceData?.performance_trends && (
                    <ChartContainer config={performanceTrendsConfig} className="min-h-[300px] w-full">
                      <LineChart data={performanceData.performance_trends.slice().reverse()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="tournament_name"
                          angle={-45}
                          textAnchor="end"
                          height={100}
                          fontSize={12}
                        />
                        <YAxis reversed />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Line
                          type="monotone"
                          dataKey="speaker_rank"
                          stroke="var(--color-speaker_rank)"
                          strokeWidth={3}
                          dot={{ fill: "var(--color-speaker_rank)", strokeWidth: 2, r: 4 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="team_rank"
                          stroke="var(--color-team_rank)"
                          strokeWidth={2}
                          dot={{ fill: "var(--color-team_rank)", strokeWidth: 2, r: 3 }}
                        />
                      </LineChart>
                    </ChartContainer>
                  )}
                </ChartCard>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Performance Summary</CardTitle>
                    <CardDescription>Your debate statistics</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="space-y-4">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Total Tournaments</span>
                          <span className="font-semibold">
                            {performanceData?.personal_performance?.total_tournaments || 0}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Total Wins</span>
                          <span className="font-semibold">
                            {performanceData?.personal_performance?.total_wins || 0}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Consistency Score</span>
                          <span className="font-semibold">
                            {performanceData?.personal_performance?.consistency_score?.toFixed(1) || 0}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Points Earned</span>
                          <span className="font-semibold">
                            {performanceData?.personal_performance?.points_earned || 0}
                          </span>
                        </div>
                        <div className="pt-2 border-t">
                          <div className="flex items-center gap-2">
                            <Medal className="h-4 w-4 text-amber-600" />
                            <span className="text-sm font-medium">
                              Regional Rank: #{performanceData?.peer_comparison?.regional_ranking || "N/A"}
                            </span>
                          </div>
                          <div className="mt-1">
                            <span className="text-xs text-muted-foreground">
                              {performanceData?.peer_comparison?.percentile || 0}th percentile
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Best Partners</CardTitle>
                    <CardDescription>Your most successful debate partnerships</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {isLoading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                          <PartnerCard key={i} loading={true} />
                        ))
                      ) : (
                        performanceData?.partner_analysis?.slice(0, 3)?.map((partner) => (
                          <PartnerCard key={partner.partner_id} partner={partner} loading={false} />
                        )) || (
                          <div className="text-center py-6 text-muted-foreground">
                            <Users className="h-8 w-8 mx-auto mb-2" />
                            <p>No partnership data available</p>
                          </div>
                        )
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">AI Insights</CardTitle>
                    <CardDescription>Personalized analysis and recommendations</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {isLoading ? (
                        Array.from({ length: 2 }).map((_, i) => (
                          <InsightCard key={i} loading={true} />
                        ))
                      ) : (
                        performanceData?.insights?.slice(0, 2)?.map((insight, index) => (
                          <InsightCard key={index} insight={insight} loading={false} />
                        )) || (
                          <div className="text-center py-6 text-muted-foreground">
                            <Brain className="h-8 w-8 mx-auto mb-2" />
                            <p>No insights available yet</p>
                          </div>
                        )
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartCard
                  title="Tournament Format Performance"
                  description="Your success in different debate formats"
                  loading={isLoading}
                  chartId="format-performance-chart"
                  onCopyImage={handleCopyChartImage}
                >
                  {performanceData?.tournament_analysis?.best_formats && (
                    <ChartContainer config={{
                      avg_rank: { label: "Average Rank", color: "hsl(var(--chart-1))" },
                      participation_count: { label: "Tournaments", color: "hsl(var(--chart-2))" },
                    }} className="min-h-[300px] w-full">
                      <BarChart data={performanceData.tournament_analysis.best_formats}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="format"
                          angle={-45}
                          textAnchor="end"
                          height={100}
                        />
                        <YAxis />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Bar dataKey="avg_rank" fill="var(--color-avg_rank)" />
                      </BarChart>
                    </ChartContainer>
                  )}
                </ChartCard>

                <ChartCard
                  title="Growth Trajectory"
                  description="Your skill development over time"
                  loading={isLoading}
                  chartId="growth-trajectory-chart"
                  onCopyImage={handleCopyChartImage}
                >
                  {performanceData?.growth_trajectory?.skill_development && (
                    <ChartContainer config={performanceData.growth_trajectory.skill_development.reduce((acc: ChartConfig, skill: any, index: number) => {
                      acc[skill.skill] = {
                        label: skill.skill,
                        color: CHART_COLORS[index % CHART_COLORS.length]
                      }
                      return acc
                    }, {})} className="min-h-[300px] w-full">
                      <RadialBarChart data={performanceData.growth_trajectory.skill_development} innerRadius="30%" outerRadius="80%">
                        <RadialBar dataKey="current_level" cornerRadius={10} fill="var(--color-current_level)" />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <ChartLegend content={<ChartLegendContent />} />
                      </RadialBarChart>
                    </ChartContainer>
                  )}
                </ChartCard>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Judge Feedback Analysis</CardTitle>
                  <CardDescription>What judges say about your performances</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-3/4" />
                      </div>
                      <div className="space-y-3">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-3/4" />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-semibold text-sm text-green-600 mb-3 flex items-center gap-2">
                          <Zap className="h-4 w-4" />
                          Strengths
                        </h4>
                        {performanceData?.judge_feedback_analysis?.strengths?.length > 0 ? (
                          <div className="space-y-2">
                            {performanceData.judge_feedback_analysis.strengths.slice(0, 4).map((strength, index) => (
                              <div key={index} className="flex justify-between items-center">
                                <span className="text-sm capitalize">{strength.area}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">
                                    {strength.frequency}x
                                  </span>
                                  {strength.improvement_rate > 0 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{strength.improvement_rate.toFixed(1)}%
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No strengths identified yet</p>
                        )}
                      </div>

                      <div>
                        <h4 className="font-semibold text-sm text-orange-600 mb-3 flex items-center gap-2">
                          <Target className="h-4 w-4" />
                          Areas to Improve
                        </h4>
                        {performanceData?.judge_feedback_analysis?.weaknesses?.length > 0 ? (
                          <div className="space-y-2">
                            {performanceData.judge_feedback_analysis.weaknesses.slice(0, 4).map((weakness, index) => (
                              <div key={index} className="flex justify-between items-center">
                                <span className="text-sm capitalize">{weakness.area}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">
                                    {weakness.frequency}x
                                  </span>
                                  <Badge
                                    variant={weakness.priority === "high" ? "destructive" : weakness.priority === "medium" ? "default" : "secondary"}
                                    className="text-xs capitalize"
                                  >
                                    {weakness.priority}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No areas for improvement identified</p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="engagement" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Tournaments"
                  value={engagementData?.participation_metrics?.tournaments_participated || 0}
                  subtitle="Participated this period"
                  icon={Trophy}
                  loading={!engagementData}
                />
                <StatCard
                  title="Debates Completed"
                  value={engagementData?.participation_metrics?.debates_completed || 0}
                  subtitle="Individual debates"
                  icon={PersonStanding}
                  loading={!engagementData}
                />
                <StatCard
                  title="Judging Hours"
                  value={engagementData?.participation_metrics?.volunteer_hours || 0}
                  subtitle="Community contribution"
                  icon={UserCheck}
                  loading={!engagementData}
                />
                <StatCard
                  title="Engagement Score"
                  value={`${engagementData?.participation_metrics?.engagement_score || 0}%`}
                  subtitle="Overall activity level"
                  icon={Flame}
                  loading={!engagementData}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartCard
                  title="Activity Timeline"
                  description="Your debate activities over time"
                  loading={!engagementData}
                  chartId="activity-timeline-chart"
                  onCopyImage={handleCopyChartImage}
                >
                  {engagementData?.activity_timeline && (
                    <ChartContainer config={engagementConfig} className="min-h-[300px] w-full">
                      <AreaChart data={engagementData.activity_timeline.map(activity => ({
                        date: new Date(activity.date).toLocaleDateString(),
                        [activity.activity_type]: activity.points_earned,
                        activity_type: activity.activity_type,
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Area
                          type="monotone"
                          dataKey="tournaments"
                          stackId="1"
                          stroke="var(--color-tournaments)"
                          fill="var(--color-tournaments)"
                          fillOpacity={0.6}
                        />
                        <Area
                          type="monotone"
                          dataKey="judging"
                          stackId="1"
                          stroke="var(--color-judging)"
                          fill="var(--color-judging)"
                          fillOpacity={0.6}
                        />
                      </AreaChart>
                    </ChartContainer>
                  )}
                </ChartCard>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Learning Progress</CardTitle>
                    <CardDescription>Skills and knowledge acquired</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!engagementData ? (
                      <div className="space-y-3">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-semibold text-sm mb-2">Skills Acquired</h4>
                          {engagementData.learning_progress.skills_acquired.length > 0 ? (
                            <div className="space-y-2">
                              {engagementData.learning_progress.skills_acquired.map((skill, index) => (
                                <div key={index} className="flex justify-between items-center">
                                  <span className="text-sm">{skill.skill}</span>
                                  <div className="flex items-center gap-2">
                                    <Progress value={skill.proficiency_level} className="w-16 h-2" />
                                    <span className="text-xs text-muted-foreground">
                                      {skill.proficiency_level}%
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">No skills tracked yet</p>
                          )}
                        </div>

                        <div className="border-t pt-4">
                          <h4 className="font-semibold text-sm mb-2">Debate Formats</h4>
                          {engagementData.learning_progress.debate_formats_experience.length > 0 ? (
                            <div className="space-y-2">
                              {engagementData.learning_progress.debate_formats_experience.map((format, index) => (
                                <div key={index} className="flex justify-between items-center">
                                  <span className="text-sm">{format.format}</span>
                                  <div className="flex items-center gap-2">
                                    <Badge variant={format.skill_level === "advanced" ? "default" : format.skill_level === "intermediate" ? "secondary" : "outline"}>
                                      {format.skill_level}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {format.tournaments_participated}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">No format experience yet</p>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Current Goals</CardTitle>
                    <CardDescription>Your active improvement targets</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {!engagementData ? (
                        Array.from({ length: 2 }).map((_, i) => (
                          <GoalCard key={i} loading={true} />
                        ))
                      ) : engagementData.goal_tracking.current_goals.length > 0 ? (
                        engagementData.goal_tracking.current_goals.map((goal) => (
                          <GoalCard key={goal.goal_id} goal={goal} loading={false} />
                        ))
                      ) : (
                        <div className="text-center py-6 text-muted-foreground">
                          <Target className="h-8 w-8 mx-auto mb-2" />
                          <p>No active goals set</p>
                          <p className="text-xs">Set goals to track your progress</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Social Connections</CardTitle>
                    <CardDescription>Your debate network and relationships</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!engagementData ? (
                      <div className="space-y-3">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-semibold text-sm mb-2">Network Overview</h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="text-center">
                              <div className="text-2xl font-bold text-primary">
                                {engagementData.social_connections.debate_network.length}
                              </div>
                              <p className="text-xs text-muted-foreground">Connections</p>
                            </div>
                            <div className="text-center">
                              <div className="text-2xl font-bold text-primary">
                                {engagementData.social_connections.community_involvement.event_attendance}
                              </div>
                              <p className="text-xs text-muted-foreground">Events</p>
                            </div>
                          </div>
                        </div>

                        <div className="border-t pt-4">
                          <h4 className="font-semibold text-sm mb-2">Top Connections</h4>
                          {engagementData.social_connections.debate_network.slice(0, 3).map((connection, index) => (
                            <div key={index} className="flex justify-between items-center py-1">
                              <div>
                                <span className="text-sm font-medium">{connection.name}</span>
                                <p className="text-xs text-muted-foreground capitalize">{connection.connection_type}</p>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {connection.relationship_strength}%
                              </Badge>
                            </div>
                          ))}
                        </div>

                        {engagementData.social_connections.community_involvement.leadership_roles.length > 0 && (
                          <div className="border-t pt-4">
                            <h4 className="font-semibold text-sm mb-2">Leadership Roles</h4>
                            {engagementData.social_connections.community_involvement.leadership_roles.map((role, index) => (
                              <Badge key={index} variant="secondary" className="mr-2 mb-2">
                                {role}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Goal Recommendations</CardTitle>
                  <CardDescription>Suggested targets based on your progress</CardDescription>
                </CardHeader>
                <CardContent>
                  {!engagementData ? (
                    <div className="space-y-3">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {engagementData.goal_tracking.recommendations.map((rec, index) => (
                        <div key={index} className="p-4 border rounded-lg">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-semibold text-sm">{rec.title}</h4>
                            <div className="flex gap-2">
                              <Badge variant="outline" className="text-xs capitalize">
                                {rec.goal_type.replace('_', ' ')}
                              </Badge>
                              <Badge
                                variant={rec.difficulty === "challenging" ? "destructive" : rec.difficulty === "moderate" ? "default" : "secondary"}
                                className="text-xs"
                              >
                                {rec.difficulty}
                              </Badge>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{rec.description}</p>
                          <p className="text-xs text-muted-foreground">
                            Timeline: {rec.estimated_timeline}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="competitive" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Regional Rank"
                  value={performanceData?.peer_comparison?.regional_ranking ? `#${performanceData.peer_comparison.regional_ranking}` : "N/A"}
                  subtitle="Among regional debaters"
                  icon={School}
                  loading={!competitiveData && !performanceData}
                />
                <StatCard
                  title="School Rank"
                  value={performanceData?.peer_comparison?.school_ranking ? `#${performanceData.peer_comparison.school_ranking}` : "N/A"}
                  subtitle="Within your school"
                  icon={Users}
                  loading={!competitiveData && !performanceData}
                />
                <StatCard
                  title="Rivals Tracked"
                  value={competitiveData?.rival_analysis?.length || 0}
                  subtitle="Active competitive relationships"
                  icon={Swords}
                  loading={!competitiveData}
                />
                <StatCard
                  title="Success Probability"
                  value={competitiveData?.tournament_intelligence?.[0]?.success_probability ? `${competitiveData.tournament_intelligence[0].success_probability}%` : "N/A"}
                  subtitle="Next tournament prediction"
                  icon={TrendingUpIcon}
                  loading={!competitiveData}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Top Rivals</CardTitle>
                    <CardDescription>Your most competitive matchups</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {!competitiveData ? (
                        Array.from({ length: 3 }).map((_, i) => (
                          <RivalCard key={i} loading={true} />
                        ))
                      ) : competitiveData.rival_analysis.length > 0 ? (
                        competitiveData.rival_analysis.slice(0, 4).map((rival) => (
                          <RivalCard key={rival.student_id} rival={rival} loading={false} />
                        ))
                      ) : (
                        <div className="text-center py-6 text-muted-foreground">
                          <Swords className="h-8 w-8 mx-auto mb-2" />
                          <p>No rivals identified yet</p>
                          <p className="text-xs">Compete in more tournaments to build rivalries</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">School Comparison</CardTitle>
                    <CardDescription>How your school stacks up against others</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!competitiveData ? (
                      <div className="space-y-3">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Your Contribution</span>
                          <span className="font-semibold">
                            {competitiveData.school_comparison.your_school_position.your_contribution}%
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">School Ranking</span>
                          <span className="font-semibold">
                            #{competitiveData.school_comparison.your_school_position.ranking_among_peers}
                          </span>
                        </div>

                        <div className="border-t pt-4">
                          <h4 className="font-semibold text-sm mb-2">Peer Schools</h4>
                          {competitiveData.school_comparison.peer_schools.slice(0, 3).map((school, index) => (
                            <div key={index} className="flex justify-between items-center py-1">
                              <div>
                                <span className="text-sm font-medium">{school.school_name}</span>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span>Avg Rank: #{school.avg_student_rank}</span>
                                  <span>•</span>
                                  <span>{school.top_performers} top performers</span>
                                </div>
                              </div>
                              <Badge
                                variant={school.competitive_threat === "high" ? "destructive" : school.competitive_threat === "medium" ? "default" : "secondary"}
                                className="text-xs capitalize"
                              >
                                {school.competitive_threat}
                              </Badge>
                            </div>
                          ))}
                        </div>

                        {competitiveData.school_comparison.your_school_position.areas_of_strength.length > 0 && (
                          <div className="border-t pt-4">
                            <h4 className="font-semibold text-sm text-green-600 mb-2">Strengths</h4>
                            {competitiveData.school_comparison.your_school_position.areas_of_strength.map((strength, index) => (
                              <Badge key={index} variant="outline" className="mr-2 mb-2 text-green-600">
                                {strength}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {competitiveData.school_comparison.your_school_position.improvement_potential.length > 0 && (
                          <div className="border-t pt-4">
                            <h4 className="font-semibold text-sm text-orange-600 mb-2">Improvement Areas</h4>
                            {competitiveData.school_comparison.your_school_position.improvement_potential.map((area, index) => (
                              <Badge key={index} variant="outline" className="mr-2 mb-2 text-orange-600">
                                {area}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Tournament Intelligence</CardTitle>
                    <CardDescription>Strategic insights for upcoming competitions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!competitiveData ? (
                      <div className="space-y-4">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                      </div>
                    ) : competitiveData.tournament_intelligence.length > 0 ? (
                      <div className="space-y-4">
                        {competitiveData.tournament_intelligence.slice(0, 3).map((tournament, index) => (
                          <div key={index} className="p-4 border rounded-lg">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-semibold text-sm">{tournament.tournament_name}</h4>
                              <div className="flex gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {tournament.format}
                                </Badge>
                                <Badge
                                  variant={tournament.competition_level === "advanced" ? "destructive" : tournament.competition_level === "intermediate" ? "default" : "secondary"}
                                  className="text-xs"
                                >
                                  {tournament.competition_level}
                                </Badge>
                              </div>
                            </div>

                            <div className="flex items-center gap-4 mb-3 text-sm">
                              <span className="text-muted-foreground">
                                Best Rank: #{tournament.your_best_rank}
                              </span>
                              <span className="text-muted-foreground">
                                Success Rate: {tournament.success_probability}%
                              </span>
                            </div>

                            {tournament.strategic_insights.length > 0 && (
                              <div className="mb-3">
                                <p className="text-xs font-medium mb-1">Strategic Insights:</p>
                                <ul className="text-xs text-muted-foreground space-y-1">
                                  {tournament.strategic_insights.slice(0, 2).map((insight, insightIndex) => (
                                    <li key={insightIndex} className="flex items-start gap-1">
                                      <span className="text-primary">•</span>
                                      {insight}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {tournament.recommended_preparation.length > 0 && (
                              <div>
                                <p className="text-xs font-medium mb-1">Preparation Tips:</p>
                                <ul className="text-xs text-muted-foreground space-y-1">
                                  {tournament.recommended_preparation.slice(0, 2).map((prep, prepIndex) => (
                                    <li key={prepIndex} className="flex items-start gap-1">
                                      <span className="text-blue-600">•</span>
                                      {prep}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">
                        <Brain className="h-8 w-8 mx-auto mb-2" />
                        <p>No tournament intelligence available</p>
                        <p className="text-xs">Participate in more tournaments to generate insights</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Judge Preferences</CardTitle>
                    <CardDescription>How different judges score your performances</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!competitiveData ? (
                      <div className="space-y-3">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                      </div>
                    ) : competitiveData.judge_preferences.length > 0 ? (
                      <div className="space-y-4">
                        {competitiveData.judge_preferences.slice(0, 4).map((judge, index) => (
                          <div key={index} className="p-3 border rounded-lg">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-semibold text-sm">{judge.judge_name}</h4>
                              <div className="flex gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {judge.your_avg_score}/30
                                </Badge>
                                <Badge
                                  variant={judge.judge_scoring_pattern === "generous" ? "default" : judge.judge_scoring_pattern === "strict" ? "destructive" : "secondary"}
                                  className="text-xs"
                                >
                                  {judge.judge_scoring_pattern}
                                </Badge>
                              </div>
                            </div>

                            <p className="text-xs text-muted-foreground mb-2">
                              Judged you {judge.times_judged_you} times
                            </p>

                            {judge.preference_indicators.length > 0 && (
                              <div className="mb-2">
                                <p className="text-xs font-medium mb-1">Indicators:</p>
                                {judge.preference_indicators.map((indicator, indicatorIndex) => (
                                  <Badge key={indicatorIndex} variant="outline" className="mr-1 mb-1 text-xs">
                                    {indicator}
                                  </Badge>
                                ))}
                              </div>
                            )}

                            {judge.preparation_tips.length > 0 && (
                              <div>
                                <p className="text-xs font-medium mb-1">Tips:</p>
                                <ul className="text-xs text-muted-foreground space-y-1">
                                  {judge.preparation_tips.slice(0, 2).map((tip, tipIndex) => (
                                    <li key={tipIndex} className="flex items-start gap-1">
                                      <span className="text-primary">•</span>
                                      {tip}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">
                        <UserCheck className="h-8 w-8 mx-auto mb-2" />
                        <p>No judge preference data</p>
                        <p className="text-xs">Build a judging history to see patterns</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <ChartCard
                title="Peer Performance Comparison"
                description="How you rank against students with similar experience"
                loading={!performanceData}
                chartId="peer-comparison-chart"
                onCopyImage={handleCopyChartImage}
              >
                {performanceData?.peer_comparison?.similar_experience_comparison && (
                  <ChartContainer config={{
                    your_value: { label: "Your Performance", color: "hsl(var(--chart-1))" },
                    peer_average: { label: "Peer Average", color: "hsl(var(--chart-2))" },
                  }} className="min-h-[300px] w-full">
                    <BarChart data={performanceData.peer_comparison.similar_experience_comparison}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="metric"
                        angle={-45}
                        textAnchor="end"
                        height={100}
                      />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Bar dataKey="your_value" fill="var(--color-your_value)" />
                      <Bar dataKey="peer_average" fill="var(--color-peer_average)" />
                    </BarChart>
                  </ChartContainer>
                )}
              </ChartCard>
            </TabsContent>
          </Tabs>
        </div>
      </Card>
    </div>
  )
}