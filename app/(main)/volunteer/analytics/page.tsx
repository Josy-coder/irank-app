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
  Bar,
  BarChart,
  Line,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
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
  Calendar,
  AlertTriangle,
  BarChart2,
  ChevronDown,
  Camera,
  FileText,
  FileSpreadsheet,
  Shield,
  Award,
  Brain,
  Eye,
  Lightbulb,
  Crown,
  Activity,
  BookOpen,
  Gavel,
  Clock,
  Flame,
  Timer,
  MessageSquare,
  ThumbsUp,
  GraduationCap,
  MapPin,
  Users2,
} from "lucide-react";
import * as XLSX from 'xlsx'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem } from "@/components/ui/dropdown-menu"

interface DateTimeRange {
  from?: Date
  to?: Date
}

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

function AchievementCard({ achievement, loading }: { achievement?: any; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 p-3 border rounded-lg">
        <Skeleton className="h-8 w-8 rounded" />
        <div className="space-y-1">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    )
  }

  if (!achievement) return null

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case "legendary":
        return "from-yellow-400 to-orange-500"
      case "epic":
        return "from-purple-400 to-pink-500"
      case "rare":
        return "from-blue-400 to-cyan-500"
      default:
        return "from-gray-400 to-gray-500"
    }
  }

  return (
    <div className={cn(
      "flex items-center gap-3 p-3 border rounded-lg bg-gradient-to-r",
      getRarityColor(achievement.rarity),
      "text-white"
    )}>
      <div className="p-2 rounded bg-white/20">
        <Award className="h-5 w-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-sm text-white">
          {achievement.achievement}
        </h4>
        <p className="text-xs text-white/80">
          {achievement.description}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-white/90">
            +{achievement.points_earned} XP
          </span>
          <span className="text-xs text-white/70">
            {new Date(achievement.date_earned).toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  )
}

function PeerCard({ peer, loading }: { peer?: any; loading: boolean }) {
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

  if (!peer) return null

  const getSimilarityColor = (score: number) => {
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
              {peer.peer_name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-sm truncate">{peer.peer_name}</h4>
              <Badge variant="outline" className={cn("gap-1", getSimilarityColor(peer.similarity_score))}>
                <Users2 className="h-3 w-3" />
                {peer.similarity_score}%
              </Badge>
            </div>
            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
              <span>Debates: {peer.comparative_metrics.debates_judged.theirs}</span>
              <span>Quality: {peer.comparative_metrics.quality_rating.theirs}/5</span>
            </div>
            <div className="mt-2">
              <p className="text-xs font-medium text-muted-foreground">Learning Opportunities:</p>
              <div className="mt-1">
                {peer.learning_opportunities.slice(0, 2).map((opportunity: string, index: number) => (
                  <Badge key={index} variant="secondary" className="mr-1 mb-1 text-xs">
                    {opportunity.split(' ').slice(0, 3).join(' ')}...
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function VolunteerAnalyticsPage() {
  const { token, user } = useAuth()
  const [dateRange, setDateRange] = useState<DateTimeRange | undefined>({
    from: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
    to: new Date(),
  })
  const [activeTab, setActiveTab] = useState("judging")

  const judgingData = useQuery(
    api.functions.volunteers.analytics.getVolunteerJudgingAnalytics,
    token && user?.role === "volunteer" ? {
      token,
      date_range: dateRange ? {
        start: dateRange.from?.getTime() || Date.now() - (365 * 24 * 60 * 60 * 1000),
        end: dateRange.to?.getTime() || Date.now(),
      } : undefined,
      compare_to_previous_period: true,
    } : "skip"
  )

  const engagementData = useQuery(
    api.functions.volunteers.analytics.getVolunteerEngagementAnalytics,
    token && user?.role === "volunteer" && activeTab === "engagement" ? {
      token,
      date_range: dateRange ? {
        start: dateRange.from?.getTime() || Date.now() - (365 * 24 * 60 * 60 * 1000),
        end: dateRange.to?.getTime() || Date.now(),
      } : undefined,
    } : "skip"
  )

  const benchmarkingData = useQuery(
    api.functions.volunteers.analytics.getVolunteerCompetitiveBenchmarking,
    token && user?.role === "volunteer" && activeTab === "benchmarking" ? {
      token,
    } : "skip"
  )

  const judgingTrendsConfig = useMemo(() => ({
    debates_judged: { label: "Debates Judged", color: "hsl(var(--chart-1))" },
    avg_quality_rating: { label: "Quality Rating", color: "hsl(var(--chart-2))" },
    avg_response_time: { label: "Response Time (hrs)", color: "hsl(var(--chart-3))" },
  } as ChartConfig), [])

  const activityConfig = useMemo(() => ({
    hours_committed: { label: "Hours Committed", color: "hsl(var(--chart-1))" },
    hours_delivered: { label: "Hours Delivered", color: "hsl(var(--chart-2))" },
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
    if (!judgingData) {
      toast.error("No data available for export")
      return
    }

    try {
      const workbook = XLSX.utils.book_new()

      if (judgingData.judging_trends) {
        const trendsWS = XLSX.utils.json_to_sheet(judgingData.judging_trends)
        XLSX.utils.book_append_sheet(workbook, trendsWS, "Judging Trends")
      }

      if (judgingData.tournament_contributions) {
        const contributionsWS = XLSX.utils.json_to_sheet(judgingData.tournament_contributions.map(tc => ({
          tournament_name: tc.tournament_name,
          role: tc.role,
          debates_judged: tc.debates_judged,
          contribution_score: tc.contribution_score,
          organizer_rating: tc.organizer_rating,
        })))
        XLSX.utils.book_append_sheet(workbook, contributionsWS, "Tournament Contributions")
      }

      if (judgingData.expertise_development) {
        const expertiseWS = XLSX.utils.json_to_sheet(judgingData.expertise_development.format_expertise)
        XLSX.utils.book_append_sheet(workbook, expertiseWS, "Format Expertise")
      }

      const timestamp = new Date().toISOString().split('T')[0]
      const filename = `volunteer-analytics-${timestamp}.xlsx`

      XLSX.writeFile(workbook, filename)
      toast.success("Excel file downloaded successfully!")
    } catch (error) {
      console.error('Error exporting to Excel:', error)
      toast.error("Failed to export Excel file")
    }
  }, [judgingData])

  const exportToPDF = useCallback(async () => {
    if (!judgingData) {
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
      pdf.text('Volunteer Analytics Report', pageWidth / 2, yPosition, { align: 'center' })

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
      const filename = `volunteer-analytics-${timestamp}.pdf`

      pdf.save(filename)
      toast.success("PDF report downloaded successfully!")
    } catch (error) {
      console.error('Error exporting to PDF:', error)
      toast.error("Failed to export PDF report")
    }
  }, [dateRange])

  const exportToCSV = useCallback(() => {
    if (!judgingData) {
      toast.error("No data available for export")
      return
    }

    try {
      let csvContent = "data:text/csv;charset=utf-8,"

      if (judgingData.judging_trends) {
        csvContent += "Judging Trends\n"
        csvContent += "Period,Debates Judged,Quality Rating,Response Time,Tournaments,Feedback Provided\n"
        judgingData.judging_trends.forEach((trend: any) => {
          csvContent += `${trend.period},${trend.debates_judged},${trend.avg_quality_rating},${trend.avg_response_time},${trend.tournaments_participated},${trend.feedback_provided}\n`
        })
        csvContent += "\n"
      }

      if (judgingData.tournament_contributions) {
        csvContent += "Tournament Contributions\n"
        csvContent += "Tournament,Role,Debates Judged,Contribution Score,Organizer Rating\n"
        judgingData.tournament_contributions.forEach((tc: any) => {
          csvContent += `${tc.tournament_name},${tc.role},${tc.debates_judged},${tc.contribution_score},${tc.organizer_rating}\n`
        })
        csvContent += "\n"
      }

      const encodedUri = encodeURI(csvContent)
      const link = document.createElement("a")
      link.setAttribute("href", encodedUri)
      link.setAttribute("download", `volunteer-analytics-${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast.success("CSV file downloaded successfully!")
    } catch (error) {
      console.error('Error exporting to CSV:', error)
      toast.error("Failed to export CSV file")
    }
  }, [judgingData])

  if (!token || !user || user.role !== "volunteer") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-xl font-semibold mb-2">Access Denied</h1>
          <p className="text-muted-foreground">Only volunteers can access this analytics dashboard.</p>
        </div>
      </div>
    )
  }

  const isLoading = judgingData === undefined

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">
        Track your judging excellence and community impact as a volunteer
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
              <TabsTrigger value="judging">Judging</TabsTrigger>
              <TabsTrigger value="engagement">Engagement</TabsTrigger>
              <TabsTrigger value="benchmarking">Benchmarking</TabsTrigger>
            </TabsList>

            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t z-50">
              <div className="flex overflow-x-auto">
                <button
                  onClick={() => setActiveTab("judging")}
                  className={cn(
                    "flex-1 min-w-0 flex flex-col items-center gap-1 py-2 px-1 text-xs transition-colors",
                    activeTab === "judging"
                      ? "text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Gavel className="h-4 w-4 shrink-0" />
                  <span className="truncate text-[10px]">Judging</span>
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
                  onClick={() => setActiveTab("benchmarking")}
                  className={cn(
                    "flex-1 min-w-0 flex flex-col items-center gap-1 py-2 px-1 text-xs transition-colors",
                    activeTab === "benchmarking"
                      ? "text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <BarChart2 className="h-4 w-4 shrink-0" />
                  <span className="truncate text-[10px]">Benchmarking</span>
                </button>
              </div>
            </div>

            <TabsContent value="judging" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Debates Judged"
                  value={judgingData?.judging_performance?.total_debates_judged || 0}
                  subtitle="Total judging assignments"
                  icon={Gavel}
                  loading={isLoading}
                />
                <StatCard
                  title="Quality Rating"
                  value={judgingData?.judging_performance?.avg_judging_quality?.toFixed(1) || "0.0"}
                  subtitle="Average out of 5.0"
                  icon={Star}
                  loading={isLoading}
                />
                <StatCard
                  title="Consistency Score"
                  value={`${judgingData?.judging_performance?.consistency_score?.toFixed(1) || 0}%`}
                  subtitle="Scoring consistency"
                  icon={Target}
                  loading={isLoading}
                />
                <StatCard
                  title="Response Time"
                  value={`${judgingData?.judging_performance?.response_time_avg?.toFixed(1) || 0}h`}
                  subtitle="Average ballot submission"
                  icon={Timer}
                  loading={isLoading}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <ChartCard
                  title="Judging Performance Trends"
                  description="Your judging metrics over time"
                  loading={isLoading}
                  className="lg:col-span-2"
                  chartId="judging-trends-chart"
                  onCopyImage={handleCopyChartImage}
                >
                  {judgingData?.judging_trends && (
                    <ChartContainer config={judgingTrendsConfig} className="min-h-[300px] w-full">
                      <LineChart data={judgingData.judging_trends}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="period" />
                        <YAxis />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Line
                          type="monotone"
                          dataKey="debates_judged"
                          stroke="var(--color-debates_judged)"
                          strokeWidth={3}
                          dot={{ fill: "var(--color-debates_judged)", strokeWidth: 2, r: 4 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="avg_quality_rating"
                          stroke="var(--color-avg_quality_rating)"
                          strokeWidth={2}
                          dot={{ fill: "var(--color-avg_quality_rating)", strokeWidth: 2, r: 3 }}
                        />
                      </LineChart>
                    </ChartContainer>
                  )}
                </ChartCard>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Experience Level</CardTitle>
                    <CardDescription>Your judging expertise classification</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="space-y-4">
                        <Skeleton className="h-8 w-32" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-primary capitalize">
                            {judgingData?.judging_performance?.experience_level || "Novice"}
                          </div>
                          <p className="text-sm text-muted-foreground">Current Level</p>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Tournaments</span>
                            <span className="font-semibold">
                              {judgingData?.judging_performance?.total_tournaments || 0}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Feedback Quality</span>
                            <span className="font-semibold">
                              {judgingData?.judging_performance?.feedback_quality_score?.toFixed(0) || 0}%
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Bias Incidents</span>
                            <span className="font-semibold">
                              {judgingData?.judging_performance?.bias_detection_incidents || 0}
                            </span>
                          </div>
                        </div>

                        <div className="pt-2 border-t">
                          <div className="flex items-center gap-2">
                            <GraduationCap className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium">
                              Quality Percentile: {judgingData?.comparative_analysis?.quality_percentile || 0}%
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
                    <CardTitle className="text-lg">Tournament Contributions</CardTitle>
                    <CardDescription>Your impact across tournaments</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {isLoading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                          <div key={i} className="flex items-center gap-4 p-3 border rounded">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-4 w-16" />
                          </div>
                        ))
                      ) : judgingData?.tournament_contributions?.length ? (
                        judgingData.tournament_contributions.slice(0, 5).map((tournament) => (
                          <div key={tournament.tournament_id} className="flex items-center justify-between p-3 border rounded hover:bg-muted/50">
                            <div className="flex-1">
                              <h4 className="font-semibold text-sm">{tournament.tournament_name}</h4>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Badge variant="secondary" className="capitalize text-xs">
                                  {tournament.role.replace('_', ' ')}
                                </Badge>
                                <span>{tournament.debates_judged} debates</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-semibold">
                                {tournament.contribution_score}/100
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Rating: {tournament.organizer_rating}/5
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-6 text-muted-foreground">
                          <Trophy className="h-8 w-8 mx-auto mb-2" />
                          <p>No tournament contributions yet</p>
                          <p className="text-xs">Start judging to see your impact</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Format Expertise</CardTitle>
                    <CardDescription>Your specialization across debate formats</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="space-y-3">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                      </div>
                    ) : judgingData?.expertise_development?.format_expertise?.length ? (
                      <div className="space-y-4">
                        {judgingData.expertise_development.format_expertise.slice(0, 4).map((format, index) => (
                          <div key={index} className="space-y-2">
                            <div className="flex justify-between items-center">
                              <h4 className="font-semibold text-sm">{format.format}</h4>
                              <Badge variant="outline" className="text-xs">
                                {format.debates_judged} debates
                              </Badge>
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Proficiency</span>
                                <span>{format.proficiency_level}%</span>
                              </div>
                              <Progress value={format.proficiency_level} className="h-2" />
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Specialization Score</span>
                              <span className="font-medium">{format.specialization_score}/100</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">
                        <BookOpen className="h-8 w-8 mx-auto mb-2" />
                        <p>No format expertise yet</p>
                        <p className="text-xs">Judge different formats to build expertise</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Feedback Analysis</CardTitle>
                  <CardDescription>Your feedback giving and receiving patterns</CardDescription>
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
                          <MessageSquare className="h-4 w-4" />
                          Feedback Quality Metrics
                        </h4>
                        {judgingData?.feedback_analysis?.feedback_received?.length > 0 ? (
                          <div className="space-y-3">
                            {judgingData.feedback_analysis.feedback_received.map((category, index) => (
                              <div key={index} className="flex justify-between items-center">
                                <span className="text-sm capitalize">{category.rating_category}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">
                                    {category.avg_score}/5
                                  </span>
                                  {category.improvement_trend !== 0 && (
                                    <Badge variant={category.improvement_trend > 0 ? "default" : "secondary"} className="text-xs">
                                      {category.improvement_trend > 0 ? "+" : ""}{category.improvement_trend.toFixed(1)}%
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No feedback received yet</p>
                        )}
                      </div>

                      <div>
                        <h4 className="font-semibold text-sm text-blue-600 mb-3 flex items-center gap-2">
                          <ThumbsUp className="h-4 w-4" />
                          Common Feedback Themes
                        </h4>
                        {judgingData?.feedback_analysis?.common_feedback_themes?.length > 0 ? (
                          <div className="space-y-2">
                            {judgingData.feedback_analysis.common_feedback_themes.slice(0, 6).map((theme, index) => (
                              <div key={index} className="flex justify-between items-center">
                                <span className="text-sm capitalize">{theme.theme}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">
                                    {theme.frequency}x
                                  </span>
                                  <Badge
                                    variant={theme.sentiment === "positive" ? "default" : theme.sentiment === "negative" ? "destructive" : "secondary"}
                                    className="text-xs"
                                  >
                                    {theme.sentiment}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No feedback themes identified</p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Community Impact</CardTitle>
                    <CardDescription>Your contribution to the debate community</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="space-y-4">
                        <Skeleton className="h-8 w-24" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-center">
                          <div>
                            <div className="text-2xl font-bold text-primary">
                              {judgingData?.community_impact?.schools_served || 0}
                            </div>
                            <p className="text-xs text-muted-foreground">Schools Served</p>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-primary">
                              {judgingData?.community_impact?.students_mentored || 0}
                            </div>
                            <p className="text-xs text-muted-foreground">Students Evaluated</p>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Judges Trained</span>
                            <span className="font-semibold">{judgingData?.community_impact?.judges_trained || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Workshops Conducted</span>
                            <span className="font-semibold">{judgingData?.community_impact?.workshops_conducted || 0}</span>
                          </div>
                        </div>

                        {judgingData?.community_impact?.recognition_received?.length > 0 && (
                          <div className="border-t pt-4">
                            <h4 className="font-semibold text-sm mb-2">Recent Recognition</h4>
                            {judgingData.community_impact.recognition_received.map((recognition, index) => (
                              <div key={index} className="p-3 bg-muted/50 rounded-lg">
                                <h5 className="font-medium text-sm">{recognition.title}</h5>
                                <p className="text-xs text-muted-foreground">{recognition.description}</p>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(recognition.date).toLocaleDateString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {judgingData?.community_impact?.leadership_roles?.length > 0 && (
                          <div className="border-t pt-4">
                            <h4 className="font-semibold text-sm mb-2">Leadership Roles</h4>
                            {judgingData.community_impact.leadership_roles.map((role, index) => (
                              <div key={index} className="flex justify-between items-center p-2 border rounded">
                                <div>
                                  <span className="font-medium text-sm">{role.role}</span>
                                  <p className="text-xs text-muted-foreground">{role.organization}</p>
                                </div>
                                <Badge variant="secondary" className="text-xs">
                                  Impact: {role.impact_score}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">AI Insights</CardTitle>
                    <CardDescription>Personalized recommendations for improvement</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {isLoading ? (
                        Array.from({ length: 2 }).map((_, i) => (
                          <InsightCard key={i} loading={true} />
                        ))
                      ) : (
                        judgingData?.insights?.slice(0, 3)?.map((insight, index) => (
                          <InsightCard key={index} insight={insight} loading={false} />
                        )) || (
                          <div className="text-center py-6 text-muted-foreground">
                            <Brain className="h-8 w-8 mx-auto mb-2" />
                            <p>No insights available yet</p>
                            <p className="text-xs">Complete more judging assignments to get insights</p>
                          </div>
                        )
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="engagement" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Volunteer Hours"
                  value={engagementData?.activity_metrics?.total_volunteer_hours?.toFixed(1) || "0.0"}
                  subtitle="Total time contributed"
                  icon={Clock}
                  loading={!engagementData}
                />
                <StatCard
                  title="Tournaments Supported"
                  value={engagementData?.activity_metrics?.tournaments_supported || 0}
                  subtitle="Events participated in"
                  icon={Trophy}
                  loading={!engagementData}
                />
                <StatCard
                  title="Engagement Score"
                  value={`${engagementData?.activity_metrics?.engagement_score || 0}%`}
                  subtitle="Overall activity level"
                  icon={Flame}
                  loading={!engagementData}
                />
                <StatCard
                  title="Volunteer Streak"
                  value={`${engagementData?.activity_metrics?.volunteer_streak || 0}d`}
                  subtitle="Days since last activity"
                  icon={Calendar}
                  loading={!engagementData}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartCard
                  title="Monthly Commitment vs Delivery"
                  description="How well you meet your time commitments"
                  loading={!engagementData}
                  chartId="commitment-chart"
                  onCopyImage={handleCopyChartImage}
                >
                  {engagementData?.availability_patterns?.monthly_commitment && (
                    <ChartContainer config={activityConfig} className="min-h-[300px] w-full">
                      <BarChart data={engagementData.availability_patterns.monthly_commitment}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Bar dataKey="hours_committed" fill="var(--color-hours_committed)" />
                        <Bar dataKey="hours_delivered" fill="var(--color-hours_delivered)" />
                      </BarChart>
                    </ChartContainer>
                  )}
                </ChartCard>

                <ChartCard
                  title="Weekly Availability Pattern"
                  description="Your judging preferences by day of week"
                  loading={!engagementData}
                  chartId="weekly-availability-chart"
                  onCopyImage={handleCopyChartImage}
                >
                  {engagementData?.availability_patterns?.weekly_availability && (
                    <ChartContainer config={{
                      available_hours: { label: "Hours Available", color: "hsl(var(--chart-1))" },
                      preference_score: { label: "Preference Score", color: "hsl(var(--chart-2))" },
                    }} className="min-h-[300px] w-full">
                      <BarChart data={engagementData.availability_patterns.weekly_availability}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="day" />
                        <YAxis />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Bar dataKey="available_hours" fill="var(--color-available_hours)" />
                      </BarChart>
                    </ChartContainer>
                  )}
                </ChartCard>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Crown className="h-5 w-5 text-yellow-500" />
                      Volunteer Level Progress
                    </CardTitle>
                    <CardDescription>Your achievement level and experience points</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!engagementData ? (
                      <div className="space-y-4">
                        <Skeleton className="h-8 w-32" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-2xl font-bold">Level {engagementData.recognition_tracking.volunteer_level.current_level}</h3>
                            <p className="text-sm text-muted-foreground">
                              {engagementData.recognition_tracking.volunteer_level.experience_points.toLocaleString()} XP
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">Next Level</p>
                            <p className="text-xs text-muted-foreground">
                              {engagementData.recognition_tracking.volunteer_level.points_to_next_level.toLocaleString()} XP to go
                            </p>
                          </div>
                        </div>
                        <Progress
                          value={(engagementData.recognition_tracking.volunteer_level.experience_points / (engagementData.recognition_tracking.volunteer_level.experience_points + engagementData.recognition_tracking.volunteer_level.points_to_next_level)) * 100}
                          className="h-3"
                        />
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Level Benefits:</p>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            {engagementData.recognition_tracking.volunteer_level.level_benefits.slice(0, 3).map((benefit, index) => (
                              <li key={index} className="flex items-center gap-2">
                                <Star className="h-3 w-3 text-primary" />
                                {benefit}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Leaderboard Positions</CardTitle>
                    <CardDescription>Your ranking among volunteers</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!engagementData ? (
                      <div className="space-y-3">
                        <Skeleton className="h-8 w-16" />
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-primary">
                            #{engagementData.recognition_tracking.leaderboard_positions.monthly_rank}
                          </div>
                          <p className="text-sm text-muted-foreground">Monthly Rank</p>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Yearly Rank</span>
                            <span className="font-semibold">#{engagementData.recognition_tracking.leaderboard_positions.yearly_rank}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>All-Time Rank</span>
                            <span className="font-semibold">#{engagementData.recognition_tracking.leaderboard_positions.all_time_rank}</span>
                          </div>
                        </div>

                        <div className="border-t pt-4">
                          <h4 className="font-semibold text-sm mb-2">Category Rankings</h4>
                          {engagementData.recognition_tracking.leaderboard_positions.category_rankings.map((category, index) => (
                            <div key={index} className="flex justify-between items-center py-1">
                              <span className="text-sm capitalize">{category.category}</span>
                              <Badge variant="outline" className="text-xs">
                                #{category.rank} / {category.total_participants}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Achievements Earned</CardTitle>
                    <CardDescription>Milestones you&#39;ve accomplished</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {!engagementData ? (
                        Array.from({ length: 3 }).map((_, i) => (
                          <AchievementCard key={i} loading={true} />
                        ))
                      ) : engagementData.recognition_tracking.achievements_earned.length > 0 ? (

                        engagementData.recognition_tracking.achievements_earned
                          .slice(0, 4)
                          .map((achievement) => (
                            <AchievementCard key={`${achievement.achievement}-${achievement.date_earned}`} achievement={achievement} loading={false} />
                          ))
                      ) : (
                        <div className="text-center py-6 text-muted-foreground">
                          <Award className="h-8 w-8 mx-auto mb-2" />
                          <p className="text-sm">No achievements earned yet</p>
                          <p className="text-xs">Keep volunteering to unlock achievements!</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="benchmarking" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Percentile Rank"
                  value={`${benchmarkingData?.benchmark_comparison?.ranking_position?.percentile || 0}%`}
                  subtitle="Among all volunteers"
                  icon={Crown}
                  loading={!benchmarkingData}
                />
                <StatCard
                  title="Experience Level"
                  value={benchmarkingData?.benchmark_comparison?.ranking_position?.tier || "Novice"}
                  subtitle="Current classification"
                  icon={Star}
                  loading={!benchmarkingData}
                  className="capitalize"
                />
                <StatCard
                  title="Similar Peers"
                  value={benchmarkingData?.peer_analysis?.length || 0}
                  subtitle="Volunteers like you"
                  icon={Users2}
                  loading={!benchmarkingData}
                />
                <StatCard
                  title="Learning Paths"
                  value={benchmarkingData?.excellence_pathways?.length || 0}
                  subtitle="Available to you"
                  icon={MapPin}
                  loading={!benchmarkingData}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Similar Volunteers</CardTitle>
                    <CardDescription>Connect with peers at your level</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {!benchmarkingData ? (
                        Array.from({ length: 3 }).map((_, i) => (
                          <PeerCard key={i} loading={true} />
                        ))
                      ) : benchmarkingData.peer_analysis?.length > 0 ? (
                        benchmarkingData.peer_analysis.slice(0, 4).map((peer) => (
                          <PeerCard key={peer.peer_id} peer={peer} loading={false} />
                        ))
                      ) : (
                        <div className="text-center py-6 text-muted-foreground">
                          <Users2 className="h-8 w-8 mx-auto mb-2" />
                          <p className="text-sm">No similar volunteers found</p>
                          <p className="text-xs">Complete more activities to find peers</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Mentorship Opportunities</CardTitle>
                  <CardDescription>Connect with mentors and mentees in the community</CardDescription>
                </CardHeader>
                <CardContent>
                  {!benchmarkingData ? (
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
                        <h4 className="font-semibold text-sm text-blue-600 mb-3 flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Available Mentors
                        </h4>
                        {benchmarkingData.mentorship_opportunities?.potential_mentors?.length > 0 ? (
                          <div className="space-y-3">
                            {benchmarkingData.mentorship_opportunities.potential_mentors.slice(0, 3).map((mentor, index) => (
                              <div key={index} className="flex items-center gap-3 p-3 border rounded hover:bg-muted/50">
                                <Avatar>
                                  <AvatarFallback>
                                    {mentor.mentor_name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <h5 className="font-semibold text-sm">{mentor.mentor_name}</h5>
                                  <p className="text-xs text-muted-foreground">
                                    {mentor.success_rate} • {mentor.expertise_areas.join(', ')}
                                  </p>
                                </div>
                                <Button size="sm" variant="outline" className="text-xs">
                                  Connect
                                </Button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No mentors available currently</p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </Card>
    </div>
  )
}