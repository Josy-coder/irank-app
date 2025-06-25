"use client"

import { useState } from "react"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
  Crown,
  Medal,
  BarChart3,
  Trophy,
} from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
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

function CurrentRankCard({ loading }: { loading: boolean }) {
  const { token } = useAuth()

  const rankData = useQuery(
    api.functions.volunteers.dashboard.getVolunteerRankAndPosition,
    token ? { token } : "skip"
  )

  if (loading || rankData === undefined) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Current Rank</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!rankData.currentRank) {
    return (
      <Card>
        <CardHeader className="pb-1.5">
          <CardTitle className="text-center text-lg font-medium">Current Rank</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center">
            <Trophy className="h-7 w-7 mx-auto text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground">No ranking data yet</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Current Rank</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3">
          <div className="text-3xl font-bold text-primary">#{rankData.currentRank}</div>
          {rankData.rankChange !== 0 && (
            <div className="flex items-center">
              {rankData.rankChange > 0 ? (
                <TrendingUpIcon className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDownIcon className="h-4 w-4 text-red-600" />
              )}
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Out of {rankData.totalVolunteers} active volunteers
        </p>
      </CardContent>
    </Card>
  )
}

function LeaderboardCard({ loading }: { loading: boolean }) {
  const { token } = useAuth()

  const leaderboard = useQuery(
    api.functions.volunteers.dashboard.getVolunteerLeaderboard,
    token ? { token } : "skip"
  )

  if (loading || leaderboard === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Leaderboard</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-2 w-16" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  if (!leaderboard || leaderboard.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-center font-medium">Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Medal className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No leaderboard data</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center text-lg font-medium">Leaderboard</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {leaderboard.map((volunteer, index) => (
          index === 0 ? (
            <div key={volunteer.volunteer_id} className="flex flex-col items-center">
              <div className="relative">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={volunteer.profile_image || undefined} />
                  <AvatarFallback className="text-lg">
                    {volunteer.volunteer_name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="rounded-full h-7 w-7 bg-green-500 absolute bottom-1 -right-1 flex items-center justify-center">
                  <Crown className="h-5 w-5 text-white" />
                </div>
              </div>
              <p className="mt-2 text-sm font-semibold text-center truncate">
                {volunteer.volunteer_name}
              </p>
              <p className="text-xs text-primary text-center">
                {volunteer.totalDebates} debates • {volunteer.avgFeedbackScore} rating
              </p>
            </div>
          ) : (

            <div key={volunteer.volunteer_id} className="flex items-center gap-3 py-1">
              <div className="relative">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={volunteer.profile_image ? `/api/storage/${volunteer.profile_image}` : undefined} />
                  <AvatarFallback className="text-xs">
                    {volunteer.volunteer_name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{volunteer.volunteer_name}</p>
                  {volunteer.rankChange > 0 ? (
                    <TrendingUpIcon className="h-3 w-3 text-green-600" />
                  ) : volunteer.rankChange < 0 ? (
                    <TrendingDownIcon className="h-3 w-3 text-red-600" />
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {volunteer.totalDebates} debates • {volunteer.avgFeedbackScore} rating
                </p>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium">#{volunteer.rank}</div>
              </div>
            </div>
          )
        ))}
      </CardContent>
    </Card>
  )
}

const chartConfig = {
  volunteer_performance: {
    label: "Volunteer Performance",
    color: "hsl(var(--chart-1))",
  },
  platform_average: {
    label: "Platform Average",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig

export default function VolunteerDashboard() {
  const { user, token } = useAuth()
  const [chartPeriod, setChartPeriod] = useState<"three_months" | "six_months" | "one_year">("three_months")

  const { greeting, message } = getGreeting()

  const dashboardStats = useQuery(
    api.functions.volunteers.dashboard.getVolunteerDashboardStats,
    token ? { token } : "skip"
  )

  const performanceData = useQuery(
    api.functions.volunteers.dashboard.getVolunteerPerformanceTrend,
    token ? { token, period: chartPeriod } : "skip"
  )

  const isLoading = dashboardStats === undefined

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{greeting}, {user?.name?.split(' ')[0] || 'Volunteer'}!</h1>
        <p className="text-muted-foreground text-sm">{message}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <div className="md:col-span-3">
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex flex-col custom:flex-row md:items-stretch space-y-3 md:space-y-0 md:space-x-3">
                  <StatCard
                    title="Total Rounds Judged"
                    value={dashboardStats?.totalRoundsJudged || 0}
                    subtitle="Lifetime"
                    percentage={dashboardStats?.roundsGrowth || 0}
                    loading={isLoading}
                  />
                </div>

                <div className="flex flex-col md:flex-row md:items-stretch space-y-3 md:space-y-0 md:space-x-3">
                  <div className="border-t md:border-t-0 md:border-l border-dashed border-foreground/30" />
                  <StatCard
                    title="Tournaments Attended"
                    value={dashboardStats?.tournamentsAttended || 0}
                    subtitle="This Year"
                    percentage={dashboardStats?.attendedGrowth || 0}
                    loading={isLoading}
                  />
                </div>

                <div className="flex flex-col md:flex-row md:items-stretch space-y-3 md:space-y-0 md:space-x-3">
                  <div className="border-t md:border-t-0 md:border-l border-dashed border-foreground/30" />
                  <StatCard
                    title="Upcoming Tournaments"
                    value={dashboardStats?.upcomingTournaments || 0}
                    subtitle="Next 30 Days"
                    percentage={dashboardStats?.upcomingGrowth || 0}
                    loading={isLoading}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-1">
          <CurrentRankCard loading={isLoading} />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <div className="md:col-span-3">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle>Performance Trend</CardTitle>
                <Select value={chartPeriod} onValueChange={(value: any) => setChartPeriod(value)}>
                  <SelectTrigger className="w-32 bg-muted">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="three_months">3 Months</SelectItem>
                    <SelectItem value="six_months">6 Months</SelectItem>
                    <SelectItem value="one_year">1 Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {performanceData === undefined ? (
                <Skeleton className="h-[200px] w-full" />
              ) : performanceData.length === 0 ? (
                <div className="h-[200px] flex items-center justify-center">
                  <div className="text-center">
                    <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">No performance data available</p>
                    <p className="text-xs text-muted-foreground">
                      Judge in tournaments to see your performance trend
                    </p>
                  </div>
                </div>
              ) : (
                <ChartContainer config={chartConfig} className="aspect-auto h-[200px] w-full">
                  <AreaChart
                    accessibilityLayer
                    data={performanceData}
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
                      tickFormatter={(value) => value}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent />}
                    />
                    <Area
                      dataKey="platform_average"
                      type="natural"
                      fill="var(--color-platform_average)"
                      fillOpacity={0.2}
                      stroke="var(--color-platform_average)"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                    />
                    <Area
                      dataKey="volunteer_performance"
                      type="natural"
                      fill="var(--color-volunteer_performance)"
                      fillOpacity={0.4}
                      stroke="var(--color-volunteer_performance)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-1">
          <LeaderboardCard loading={isLoading} />
        </div>
      </div>
    </div>
  )
}