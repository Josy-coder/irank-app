"use client"

import { useState } from "react"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  TrendingUpIcon,
  TrendingDownIcon,
  Shield,
  GraduationCap,
  Building,
  UserCheck,
} from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"
import getGreeting from "@/lib/greeting";

interface StatCardProps {
  title: string
  value: string | number
  subtitle: string
  percentage: number
  loading?: boolean
}

function StatCard({ title, value, subtitle, percentage, loading }: StatCardProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-3 w-20" />
      </div>
    )
  }

  return (
    <div className="space-y-2 w-full">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        <Badge
              variant="secondary"
              className={cn(
                "flex items-center gap-1",
                percentage > 0
                  ? "text-green-600"
                  : percentage < 0
                  ? "text-red-600"
                  : "text-foreground"
              )}
            >
              {percentage > 0 ? (
                <TrendingUpIcon className="h-3 w-3 text-green-600" />
              ) : percentage < 0 ? (
                <TrendingDownIcon className="h-3 w-3 text-red-600" />
              ) : null}
              <span
                className={cn(
                  "text-xs font-medium",
                  "block md:hidden lg:block",
                  percentage > 0
                    ? "text-green-600"
                    : percentage < 0
                    ? "text-red-600"
                    : "text-foreground"
                )}
              >
                {percentage > 0 ? "+" : ""}
                {percentage.toFixed(1)}%
              </span>
            </Badge>
      </div>
      <div className="text-2xl font-bold text-primary">{value}</div>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </div>
  )
}

const chartConfig = {
  registrations: {
    label: "Registrations",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig

export default function AdminDashboard() {
  const { user, token } = useAuth()
  const [chartPeriod, setChartPeriod] = useState<"this_month" | "last_month" | "three_months" | "six_months">("this_month")

  const { greeting, message } = getGreeting()

  const dashboardStats = useQuery(
    api.functions.admin.dashboard.getDashboardStats,
    token ? { admin_token: token } : "skip"
  )

  const tournamentData = useQuery(
    api.functions.admin.dashboard.getTournamentRegistrations,
    token ? { admin_token: token, period: chartPeriod } : "skip"
  )

  const isLoading = dashboardStats === undefined

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{greeting}, {user?.name?.split(' ')[0] || 'Admin'}!</h1>
        <p className="text-muted-foreground text-sm">{message}</p>
      </div>

      <div>
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="flex flex-col custom:flex-row md:items-stretch space-y-3 md:space-y-0 md:space-x-3">
                <StatCard
                  title="No. of Users"
                  value={dashboardStats?.totalUsers || 0}
                  subtitle="Approved Users"
                  percentage={dashboardStats?.userGrowth || 0}
                  loading={isLoading}
                />
              </div>
              <div className="flex flex-col md:flex-row md:items-stretch space-y-3 md:space-y-0 md:space-x-3">
                <div className="border-t md:border-t-0 md:border-l border-dashed border-foreground/30" />
                <StatCard
                  title="New User Reg."
                  value={dashboardStats?.newRegistrations || 0}
                  subtitle="Last 30 Days"
                  percentage={dashboardStats?.registrationGrowth || 0}
                  loading={isLoading}
                />
              </div>

              <div className="flex flex-col md:flex-row md:items-stretch space-y-3 md:space-y-0 md:space-x-3">
                <div className="border-t md:border-t-0 md:border-l border-dashed border-foreground/30" />
                <StatCard
                  title="No. of Tournaments"
                  value={dashboardStats?.totalTournaments || 0}
                  subtitle="Past and Upcoming"
                  percentage={dashboardStats?.tournamentGrowth || 0}
                  loading={isLoading}
                />
              </div>

              <div className="flex flex-col md:flex-row md:items-stretch space-y-3 md:space-y-0 md:space-x-3">
                <div className="border-t md:border-t-0 md:border-l border-dashed border-foreground/30" />
                <StatCard
                  title="Upcom. Tournaments"
                  value={dashboardStats?.upcomingTournaments || 0}
                  subtitle="Next 30 days"
                  percentage={dashboardStats?.upcomingGrowth || 0}
                  loading={isLoading}
                />
              </div>

            </div>
          </CardContent>

        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-4">
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Users Per Category</CardTitle>
            </CardHeader>
            <CardContent className="space-y-[14.6px]">
              {isLoading ? (
                <div className="space-y-[14.6px]">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-8 ml-auto" />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted rounded">
                      <Shield className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-sm">Admin</span>
                    <span className="ml-auto text-sm">{dashboardStats?.usersByRole.admin || 0}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted rounded">
                      <GraduationCap className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-sm text-sm">Students</span>
                    <span className="ml-auto text-sm">{dashboardStats?.usersByRole.students || 0}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted rounded">
                      <Building className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-sm text-sm">Schools</span>
                    <span className="ml-auto text-sm">{dashboardStats?.usersByRole.schools || 0}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted rounded">
                      <UserCheck className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-sm text-sm">Volunteers</span>
                    <span className="ml-auto text-sm">{dashboardStats?.usersByRole.volunteers || 0}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="col-span-1 md:col-span-2 lg:col-span-3">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle>Tournament Registrations</CardTitle>
                <Select value={chartPeriod} onValueChange={(value: any) => setChartPeriod(value)}>
                  <SelectTrigger className="w-32 bg-muted">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="this_month">This Month</SelectItem>
                    <SelectItem value="last_month">Last Month</SelectItem>
                    <SelectItem value="three_months">3 Months</SelectItem>
                    <SelectItem value="six_months">6 Months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {tournamentData === undefined ? (
                <Skeleton className="h-[155px] w-full" />
              ) : (
                <ChartContainer config={chartConfig} className="aspect-auto h-[155px] w-full">
                  <AreaChart
                    accessibilityLayer
                    data={tournamentData}
                    margin={{
                      left: 12,
                      right: 12,
                    }}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tickFormatter={(value) => value.slice(0, 3)}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent indicator="dot" />}
                    />
                    <Area
                      dataKey="registrations"
                      type="natural"
                      fill="var(--color-registrations)"
                      fillOpacity={0.4}
                      stroke="var(--color-registrations)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}