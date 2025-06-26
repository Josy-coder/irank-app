"use client"

import React, { useMemo, useEffect, Suspense, useState, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
  Pie,
  PieChart,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis
} from "recharts"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  TrendingUp,
  TrendingDown,
  Users,
  Trophy,
  BarChart3,
  Activity,
  Building,
  AlertTriangle,
  Eye,
  Clock,
  ExternalLink,
  Share2
} from "lucide-react"
import AppLoader from "@/components/app-loader";

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
                    loading = false
                  }: {
  title: string
  value: string | number
  subtitle: string
  trend?: number
  icon: React.ElementType
  loading?: boolean
}) {
  if (loading) {
    return (
      <Card>
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
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold">{value}</p>
              {trend !== undefined && (
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
                     loading = false
                   }: {
  title: string
  description?: string
  children: React.ReactNode
  loading?: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {loading ? <ChartSkeleton /> : children}
      </CardContent>
    </Card>
  )
}

function AccessInfoBanner({ accessInfo }: { accessInfo: any }) {
  return (
    <Alert className="mb-6">
      <div className="flex items-center justify-between md:justify-start gap-2">
        <Eye className="h-4 w-4 hidden md:block" />
        <AlertDescription className="flex flex-col md:flex-row items-center justify-between w-full">
          <div className="flex flex-col md:flex-row items-center justify-between w-full">
            <div className="flex flex-col md:flex-row items-center gap-4">
              <span>This is a shared analytics report</span>
              {accessInfo.views_remaining && (
                <>
                  <Badge variant="default">
            <span className="text-xs text-muted-foreground">
              {accessInfo.views_remaining} views remaining
            </span>
                  </Badge>
                </>
              )}
              {accessInfo.expires_at && (
                <>
                  <Badge variant="outline">
            <span className="text-xs text-muted-foreground">
              Expires: {new Date(accessInfo.expires_at).toLocaleDateString()}
            </span>
                  </Badge>
                </>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href)
                toast.success("Report link copied to clipboard!")
              }}
            >
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
          </div>
        </AlertDescription>
      </div>
    </Alert>
  )
}

function ErrorDisplay({ error }: { error: string }) {
  const router = useRouter();
  const getErrorDetails = (errorMessage: string) => {
    if (errorMessage.includes("Maximum views exceeded")) {
      return {
        title: "Maximum Views Reached",
        description: "This report has reached its maximum view limit. Please contact the report owner for a new link.",
        icon: Eye,
      }
    }

    if (errorMessage.includes("expired") || errorMessage.includes("Report access has expired")) {
      return {
        title: "Report Expired",
        description: "This report link has expired. Please request a new report link from the owner.",
        icon: Clock,
      }
    }

    if (errorMessage.includes("Invalid access token")) {
      return {
        title: "Invalid Report Link",
        description: "This report link is invalid or malformed. Please check the URL and try again.",
        icon: AlertTriangle,
      }
    }

    return {
      title: "Unable to Load Report",
      description: "There was an error loading this report. Please try again or contact support if the issue persists.",
      icon: AlertTriangle,
    }
  }

  const { title, description, icon: Icon } = getErrorDetails(error)

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <Icon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-xl font-semibold mb-2">{title}</h1>
        <p className="text-muted-foreground mb-4">{description}</p>
        <div className="flex gap-2 justify-center">
          <Button variant="outline" onClick={() => router.push('/')}>
            Go Back
          </Button>
        </div>
      </div>
    </div>
  )
}

function PublicReports() {
  const params = useParams()
  const searchParams = useSearchParams()
  const token = params.token as string
  const viewIncrementedRef = useRef(false)
  const [reportError, setReportError] = useState<string | null>(null)

  const sections = useMemo(() => {
    const sectionsParam = searchParams.get('sections')
    return sectionsParam ? sectionsParam.split(',') : []
  }, [searchParams])

  const reportData = useQuery(
    api.functions.analytics.getSharedReportData,
    token ? { access_token: token } : "skip"
  )

  const incrementViewCount = useMutation(api.functions.admin.analytics.incrementViewCount)

  useEffect(() => {
    if (reportData && !reportData.success) {
      setReportError(reportData.error || "Unknown error occurred")
      return
    }

    if (reportData?.success && reportError) {
      setReportError(null)
    }
  }, [reportData, reportError])

  useEffect(() => {
    if (token && reportData?.success && !viewIncrementedRef.current) {
      viewIncrementedRef.current = true
      incrementViewCount({ access_token: token }).catch((error) => {
        console.error("Failed to increment view count:", error)
      })
    }
  }, [token, reportData, incrementViewCount])

  const tournamentTrendsConfig = {
    total: { label: "Total", color: "hsl(var(--chart-1))" },
    completed: { label: "Completed", color: "hsl(var(--chart-2))" },
    in_progress: { label: "In Progress", color: "hsl(var(--chart-3))" },
    published: { label: "Published", color: "hsl(var(--chart-4))" },
  } satisfies ChartConfig

  const formatDistributionConfig = useMemo(() => {
    const config: ChartConfig = {}
    reportData?.sections?.tournaments?.format_distribution?.forEach((item: any, index: number) => {
      config[item.format] = {
        label: item.format,
        color: CHART_COLORS[index % CHART_COLORS.length],
      }
    })
    return config
  }, [reportData?.sections?.tournaments?.format_distribution])

  const userGrowthConfig = {
    students: { label: "Students", color: "hsl(var(--chart-1))" },
    volunteers: { label: "Volunteers", color: "hsl(var(--chart-2))" },
    school_admins: { label: "School Admins", color: "hsl(var(--chart-3))" },
    admins: { label: "Admins", color: "hsl(var(--chart-4))" },
    total: { label: "Total", color: "hsl(var(--chart-5))" },
  } satisfies ChartConfig

  const revenueConfig = {
    revenue: { label: "Revenue", color: "hsl(var(--chart-1))" },
    transactions: { label: "Transactions", color: "hsl(var(--chart-2))" },
  } satisfies ChartConfig


  if (!token) {
    return <ErrorDisplay error="Invalid access token" />
  }

  if (reportError) {
    return <ErrorDisplay error={reportError} />
  }

  if (!reportData) {
    return <AppLoader />
  }

  if (!reportData.success) {
    return <ErrorDisplay error={reportData.error || "Unknown error"} />
  }

  if (!reportData.title) {
    return <ErrorDisplay error="Report not found" />
  }

  const { overview, tournaments, users, financial, performance } = reportData.sections || {}

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-primary">{reportData.title}</h1>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <BarChart3 className="h-3 w-3" />
                Analytics Report
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Clock className="h-3 w-3" />
                {reportData.generated_at ? new Date(reportData.generated_at).toLocaleTimeString() : "N/A"}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8 space-y-8">
        <AccessInfoBanner accessInfo={reportData.access_info} />

        {(sections.length === 0 || sections.includes('overview')) && overview && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold mb-2">Overview</h2>
              <Separator />
            </div>

            <div className="grid grid-cols-1 custom:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Total Tournaments"
                value={overview.total_tournaments?.toLocaleString() || "0"}
                subtitle="All time"
                trend={overview.growth_metrics?.tournaments}
                icon={Trophy}
              />
              <StatCard
                title="Active Tournaments"
                value={overview.active_tournaments?.toLocaleString() || "0"}
                subtitle="Currently running"
                icon={Activity}
              />
              <StatCard
                title="Total Users"
                value={overview.total_users?.toLocaleString() || "0"}
                subtitle="Platform users"
                trend={overview.growth_metrics?.users}
                icon={Users}
              />
              <StatCard
                title="Total Schools"
                value={overview.total_schools?.toLocaleString() || "0"}
                subtitle="Registered schools"
                trend={overview.growth_metrics?.schools}
                icon={Building}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartCard
                title="Total Debates"
                description="All time debate count"
              >
                <div className="text-center py-8">
                  <div className="text-4xl font-bold text-primary">
                    {overview.total_debates?.toLocaleString() || "0"}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Total debates hosted on the platform
                  </p>
                </div>
              </ChartCard>

              <ChartCard
                title="Completion Rate"
                description="Tournament completion percentage"
              >
                <div className="text-center py-8">
                  <div className="text-4xl font-bold text-primary">
                    {overview.completion_rate || 0}%
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Average tournament completion rate
                  </p>
                </div>
              </ChartCard>
            </div>
          </div>
        )}
        {(sections.length === 0 || sections.includes('tournaments')) && tournaments && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold mb-2">Tournament Analytics</h2>
              <Separator />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {tournaments.tournament_trends && (
                <ChartCard
                  title="Tournament Trends"
                  description="Daily tournament creation and completion"
                >
                  <ChartContainer config={tournamentTrendsConfig} className="min-h-[300px] w-full">
                    <AreaChart data={tournaments.tournament_trends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(value) => new Date(value).toLocaleDateString()}
                      />
                      <YAxis />
                      <ChartTooltip
                        content={<ChartTooltipContent />}
                        labelFormatter={(value) => new Date(value).toLocaleDateString()}
                      />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Area
                        type="monotone"
                        dataKey="total"
                        stackId="1"
                        stroke="var(--color-total)"
                        fill="var(--color-total)"
                        fillOpacity={0.6}
                      />
                      <Area
                        type="monotone"
                        dataKey="completed"
                        stackId="1"
                        stroke="var(--color-completed)"
                        fill="var(--color-completed)"
                        fillOpacity={0.6}
                      />
                      <Area
                        type="monotone"
                        dataKey="in_progress"
                        stackId="1"
                        stroke="var(--color-in_progress)"
                        fill="var(--color-in_progress)"
                        fillOpacity={0.6}
                      />
                    </AreaChart>
                  </ChartContainer>
                </ChartCard>
              )}

              {tournaments.format_distribution && (
                <ChartCard
                  title="Format Distribution"
                  description="Tournament formats usage"
                >
                  <ChartContainer config={formatDistributionConfig} className="min-h-[300px] w-full">
                    <PieChart>
                      <Pie
                        data={tournaments.format_distribution}
                        dataKey="count"
                        nameKey="format"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ format, percentage }) => `${format}: ${percentage}%`}
                      >
                        {tournaments.format_distribution.map((item: any, index: number) => (
                          <Cell key={`cell-${item}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                    </PieChart>
                  </ChartContainer>
                </ChartCard>
              )}

              {tournaments.completion_rates && (
                <ChartCard
                  title="Completion Rates"
                  description="Monthly tournament completion trends"
                >
                  <ChartContainer config={{ rate: { label: "Completion Rate", color: "hsl(var(--chart-1))" } }} className="min-h-[300px] w-full">
                    <LineChart data={tournaments.completion_rates}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <ChartTooltip
                        content={<ChartTooltipContent />}
                        formatter={(value) => [`${value}%`, "Completion Rate"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="rate"
                        stroke="var(--color-rate)"
                        strokeWidth={2}
                        dot={{ fill: "var(--color-rate)" }}
                      />
                    </LineChart>
                  </ChartContainer>
                </ChartCard>
              )}

              {tournaments.virtual_vs_physical && (
                <ChartCard
                  title="Virtual vs Physical"
                  description="Tournament format preference"
                >
                  <ChartContainer
                    config={{
                      virtual: { label: "Virtual", color: "hsl(var(--chart-1))" },
                      physical: { label: "Physical", color: "hsl(var(--chart-2))" }
                    }}
                    className="min-h-[300px] w-full"
                  >
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Virtual", value: tournaments.virtual_vs_physical.virtual },
                          { name: "Physical", value: tournaments.virtual_vs_physical.physical }
                        ]}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        <Cell fill="hsl(var(--chart-1))" />
                        <Cell fill="hsl(var(--chart-2))" />
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                    </PieChart>
                  </ChartContainer>
                </ChartCard>
              )}
            </div>

            {tournaments.geographic_distribution && (
              <ChartCard
                title="Geographic Distribution"
                description="Tournament distribution by country"
              >
                <ChartContainer
                  config={{
                    tournaments: { label: "Tournaments", color: "hsl(var(--chart-1))" },
                    schools: { label: "Schools", color: "hsl(var(--chart-2))" }
                  }}
                  className="min-h-[300px] w-full"
                >
                  <BarChart data={tournaments.geographic_distribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="country" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="tournaments" fill="var(--color-tournaments)" />
                    <Bar dataKey="schools" fill="var(--color-schools)" />
                  </BarChart>
                </ChartContainer>
              </ChartCard>
            )}
          </div>
        )}

        {(sections.length === 0 || sections.includes('users')) && users && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold mb-2">User Analytics</h2>
              <Separator />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {users.user_growth && (
                <ChartCard
                  title="User Growth"
                  description="Daily user registration trends"
                >
                  <ChartContainer config={userGrowthConfig} className="min-h-[300px] w-full">
                    <AreaChart data={users.user_growth}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(value) => new Date(value).toLocaleDateString()}
                      />
                      <YAxis />
                      <ChartTooltip
                        content={<ChartTooltipContent />}
                        labelFormatter={(value) => new Date(value).toLocaleDateString()}
                      />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Area
                        type="monotone"
                        dataKey="students"
                        stackId="1"
                        stroke="var(--color-students)"
                        fill="var(--color-students)"
                        fillOpacity={0.6}
                      />
                      <Area
                        type="monotone"
                        dataKey="volunteers"
                        stackId="1"
                        stroke="var(--color-volunteers)"
                        fill="var(--color-volunteers)"
                        fillOpacity={0.6}
                      />
                      <Area
                        type="monotone"
                        dataKey="school_admins"
                        stackId="1"
                        stroke="var(--color-school_admins)"
                        fill="var(--color-school_admins)"
                        fillOpacity={0.6}
                      />
                      <Area
                        type="monotone"
                        dataKey="admins"
                        stackId="1"
                        stroke="var(--color-admins)"
                        fill="var(--color-admins)"
                        fillOpacity={0.6}
                      />
                    </AreaChart>
                  </ChartContainer>
                </ChartCard>
              )}

              {users.role_distribution && (
                <ChartCard
                  title="Role Distribution"
                  description="User distribution by role"
                >
                  <ChartContainer
                    config={users.role_distribution.reduce((acc: ChartConfig, role: any, index: number) => {
                      acc[role.role] = {
                        label: role.role.replace('_', ' '),
                        color: CHART_COLORS[index % CHART_COLORS.length]
                      }
                      return acc
                    }, {})}
                    className="min-h-[300px] w-full"
                  >
                    <PieChart>
                      <Pie
                        data={users.role_distribution}
                        dataKey="count"
                        nameKey="role"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ role, percentage }) => `${role.replace('_', ' ')}: ${percentage}%`}
                      >
                        {users.role_distribution.map((item: any, index: number) => (
                          <Cell key={`cell-${item}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                    </PieChart>
                  </ChartContainer>
                </ChartCard>
              )}

              {users.geographic_distribution && (
                <ChartCard
                  title="Geographic Distribution"
                  description="User distribution by country"
                >
                  <ChartContainer
                    config={{
                      users: { label: "Users", color: "hsl(var(--chart-1))" },
                      schools: { label: "Schools", color: "hsl(var(--chart-2))" }
                    }}
                    className="min-h-[300px] w-full"
                  >
                    <BarChart data={users.geographic_distribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="country" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Bar dataKey="users" fill="var(--color-users)" />
                      <Bar dataKey="schools" fill="var(--color-schools)" />
                    </BarChart>
                  </ChartContainer>
                </ChartCard>
              )}

              {users.retention_rates && (
                <ChartCard
                  title="Retention Rates"
                  description="User retention by cohort"
                >
                  <ChartContainer
                    config={{
                      retention_rate: { label: "Retention Rate", color: "hsl(var(--chart-1))" }
                    }}
                    className="min-h-[300px] w-full"
                  >
                    <BarChart data={users.retention_rates}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="cohort" />
                      <YAxis />
                      <ChartTooltip
                        content={<ChartTooltipContent />}
                        formatter={(value) => [`${value}%`, "Retention Rate"]}
                      />
                      <Bar dataKey="retention_rate" fill="var(--color-retention_rate)" />
                    </BarChart>
                  </ChartContainer>
                </ChartCard>
              )}
            </div>
          </div>
        )}

        {(sections.length === 0 || sections.includes('financial')) && financial && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold mb-2">Financial Analytics</h2>
              <Separator />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {financial.revenue_trends && (
                <ChartCard
                  title="Revenue Trends"
                  description="Daily revenue and transaction volume"
                >
                  <ChartContainer config={revenueConfig} className="min-h-[300px] w-full">
                    <AreaChart data={financial.revenue_trends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(value) => new Date(value).toLocaleDateString()}
                      />
                      <YAxis />
                      <ChartTooltip
                        content={<ChartTooltipContent />}
                        labelFormatter={(value) => new Date(value).toLocaleDateString()}
                      />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="var(--color-revenue)"
                        fill="var(--color-revenue)"
                        fillOpacity={0.6}
                      />
                    </AreaChart>
                  </ChartContainer>
                </ChartCard>
              )}

              {financial.payment_distribution && (
                <ChartCard
                  title="Payment Methods"
                  description="Payment method distribution"
                >
                  <ChartContainer
                    config={financial.payment_distribution.reduce((acc: ChartConfig, method: any, index: number) => {
                      acc[method.method] = {
                        label: method.method,
                        color: CHART_COLORS[index % CHART_COLORS.length]
                      }
                      return acc
                    }, {})}
                    className="min-h-[300px] w-full"
                  >
                    <PieChart>
                      <Pie
                        data={financial.payment_distribution}
                        dataKey="amount"
                        nameKey="method"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ method, percentage }) => `${method}: ${percentage}%`}
                      >
                        {financial.payment_distribution.map((item: any, index: number) => (
                          <Cell key={`cell-${item}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                    </PieChart>
                  </ChartContainer>
                </ChartCard>
              )}

              {financial.tournament_revenue && (
                <ChartCard
                  title="Tournament Revenue"
                  description="Revenue by tournament"
                >
                  <ChartContainer
                    config={{
                      revenue: { label: "Revenue", color: "hsl(var(--chart-1))" }
                    }}
                    className="min-h-[300px] w-full"
                  >
                    <BarChart data={financial.tournament_revenue.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="tournament_name"
                        angle={-45}
                        textAnchor="end"
                        height={100}
                      />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="revenue" fill="var(--color-revenue)" />
                    </BarChart>
                  </ChartContainer>
                </ChartCard>
              )}

              {financial.regional_revenue && (
                <ChartCard
                  title="Regional Revenue"
                  description="Revenue distribution by country"
                >
                  <ChartContainer
                    config={{
                      revenue: { label: "Revenue", color: "hsl(var(--chart-1))" }
                    }}
                    className="min-h-[300px] w-full"
                  >
                    <BarChart data={financial.regional_revenue}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="country" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="revenue" fill="var(--color-revenue)" />
                    </BarChart>
                  </ChartContainer>
                </ChartCard>
              )}
            </div>
          </div>
        )}

        {(sections.length === 0 || sections.includes('performance')) && performance && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold mb-2">Performance Analytics</h2>
              <Separator />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {performance.judge_performance?.feedback_trends && (
                <ChartCard
                  title="Judge Feedback Trends"
                  description="Average judge ratings over time"
                >
                  <ChartContainer
                    config={{
                      average_rating: { label: "Average Rating", color: "hsl(var(--chart-1))" }
                    }}
                    className="min-h-[300px] w-full"
                  >
                    <LineChart data={performance.judge_performance.feedback_trends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis domain={[0, 5]} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line
                        type="monotone"
                        dataKey="average_rating"
                        stroke="var(--color-average_rating)"
                        strokeWidth={2}
                        dot={{ fill: "var(--color-average_rating)" }}
                      />
                    </LineChart>
                  </ChartContainer>
                </ChartCard>
              )}

              {performance.team_performance && (
                <ChartCard
                  title="Team Performance"
                  description="School performance metrics"
                >
                  <ChartContainer
                    config={{
                      win_rate: { label: "Win Rate", color: "hsl(var(--chart-1))" }
                    }}
                    className="min-h-[300px] w-full"
                  >
                    <BarChart data={performance.team_performance.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="school_name"
                        angle={-45}
                        textAnchor="end"
                        height={100}
                      />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="win_rate" fill="var(--color-win_rate)" />
                    </BarChart>
                  </ChartContainer>
                </ChartCard>
              )}

              {performance.speaker_performance && (
                <ChartCard
                  title="Speaker Rankings"
                  description="Speaker performance distribution"
                >
                  <ChartContainer
                    config={performance.speaker_performance.reduce((acc: ChartConfig, rank: any, index: number) => {
                      acc[rank.speaker_rank_range] = {
                        label: rank.speaker_rank_range,
                        color: CHART_COLORS[index % CHART_COLORS.length]
                      }
                      return acc
                    }, {})}
                    className="min-h-[300px] w-full"
                  >
                    <PieChart>
                      <Pie
                        data={performance.speaker_performance}
                        dataKey="count"
                        nameKey="speaker_rank_range"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ speaker_rank_range, percentage }) => `${speaker_rank_range}: ${percentage}%`}
                      >
                        {performance.speaker_performance.map((item: any, index: number) => (
                          <Cell key={`cell-${item}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                    </PieChart>
                  </ChartContainer>
                </ChartCard>
              )}

              {performance.debate_quality?.fact_check_usage && (
                <ChartCard
                  title="Fact Check Usage"
                  description="AI fact-checking utilization by tournament"
                >
                  <ChartContainer
                    config={{
                      usage_rate: { label: "Usage Rate", color: "hsl(var(--chart-1))" }
                    }}
                    className="min-h-[300px] w-full"
                  >
                    <BarChart data={performance.debate_quality.fact_check_usage.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="tournament"
                        angle={-45}
                        textAnchor="end"
                        height={100}
                      />
                      <YAxis />
                      <ChartTooltip
                        content={<ChartTooltipContent />}
                        formatter={(value) => [`${value}`, "Fact Checks per Debate"]}
                      />
                      <Bar dataKey="usage_rate" fill="var(--color-usage_rate)" />
                    </BarChart>
                  </ChartContainer>
                </ChartCard>
              )}

              {performance.efficiency_metrics?.judge_response_times && (
                <ChartCard
                  title="Judge Response Times"
                  description="Average time for judges to submit ballots"
                >
                  <ChartContainer
                    config={{
                      avg_response_time: { label: "Response Time (hours)", color: "hsl(var(--chart-1))" }
                    }}
                    className="min-h-[300px] w-full"
                  >
                    <LineChart data={performance.efficiency_metrics.judge_response_times}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis />
                      <ChartTooltip
                        content={<ChartTooltipContent />}
                        formatter={(value) => [`${value} hours`, "Avg Response Time"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="avg_response_time"
                        stroke="var(--color-avg_response_time)"
                        strokeWidth={2}
                        dot={{ fill: "var(--color-avg_response_time)" }}
                      />
                    </LineChart>
                  </ChartContainer>
                </ChartCard>
              )}

              {performance.judge_performance?.bias_detection && (
                <ChartCard
                  title="Bias Detection"
                  description="Judge bias detection rates"
                >
                  <ChartContainer
                    config={{
                      bias_rate: { label: "Bias Rate (%)", color: "hsl(var(--chart-1))" }
                    }}
                    className="min-h-[300px] w-full"
                  >
                    <BarChart data={performance.judge_performance.bias_detection.filter((judge: any) => judge.bias_rate > 0).slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="judge_name"
                        angle={-45}
                        textAnchor="end"
                        height={100}
                      />
                      <YAxis />
                      <ChartTooltip
                        content={<ChartTooltipContent />}
                        formatter={(value) => [`${value}%`, "Bias Rate"]}
                      />
                      <Bar dataKey="bias_rate" fill="var(--color-bias_rate)" />
                    </BarChart>
                  </ChartContainer>
                </ChartCard>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {performance.efficiency_metrics && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Tournament Efficiency</CardTitle>
                    <CardDescription>Average duration metrics</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">
                          {performance.efficiency_metrics.avg_tournament_duration || 0}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Average tournament duration (days)
                        </p>
                      </div>
                      {performance.efficiency_metrics.round_completion_times && (
                        <div className="space-y-2">
                          {performance.efficiency_metrics.round_completion_times.map((round: any, index: number) => (
                            <div key={index} className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground capitalize">
                                {round.round_type}
                              </span>
                              <span className="text-sm font-medium">
                                {round.avg_duration.toFixed(1)}h
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {performance.judge_performance?.consistency_scores && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Judge Consistency</CardTitle>
                    <CardDescription>Top performing judges</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {performance.judge_performance.consistency_scores.slice(0, 5).map((judge: any, index: number) => (
                        <div key={index} className="flex justify-between items-center">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{judge.judge_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {judge.debates_judged} debates
                            </p>
                          </div>
                          <Badge variant="outline">
                            {judge.consistency.toFixed(1)}%
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {performance.debate_quality?.argument_complexity && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Argument Quality</CardTitle>
                    <CardDescription>Debate complexity metrics</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {performance.debate_quality.argument_complexity.slice(0, 3).map((tournament: any, index: number) => (
                        <div key={index} className="space-y-2">
                          <p className="text-sm font-medium truncate" title={tournament.tournament}>
                            {tournament.tournament}
                          </p>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Args:</span>
                              <span>{tournament.avg_arguments}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Rebuttals:</span>
                              <span>{tournament.avg_rebuttals}</span>
                            </div>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full"
                              style={{ width: `${Math.min(tournament.quality_score, 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        <div className="mt-12 pt-8 border-t">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <BarChart3 className="h-4 w-4" />
              <span>iRankHub Analytics — a product by iDebate Rwanda</span>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>Generated: {reportData.generated_at ? new Date(reportData.generated_at).toLocaleDateString() : "N/A"}</span>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2"
                onClick={() => window.open('https://debaterwanda.org', '_blank')}
              >
                <ExternalLink className="h-3 w-3" />
                Visit iDebate Rwanda
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PublicReportsPage() {
  return (
    <Suspense fallback={<AppLoader />}>
      <PublicReports />
    </Suspense>
  )
}