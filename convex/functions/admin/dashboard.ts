import { query } from "../../_generated/server";
import { v } from "convex/values";
import { internal } from "../../_generated/api";

export const getDashboardStats = query({
  args: {
    admin_token: v.string(),
  },
  handler: async (ctx, args) => {
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySessionReadOnly, {
      token: args.admin_token,
    });

    if (!sessionResult.valid || sessionResult.user?.role !== "admin") {
      throw new Error("Admin access required");
    }

    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

    const allUsers = await ctx.db.query("users").collect();
    const verifiedUsers = allUsers.filter(u => u.verified);
    const recentUsers = allUsers.filter(u => u.created_at && u.created_at > thirtyDaysAgo);

    const sixtyDaysAgo = now - (60 * 24 * 60 * 60 * 1000);
    const previousPeriodUsers = allUsers.filter(u =>
      u.created_at && u.created_at > sixtyDaysAgo && u.created_at <= thirtyDaysAgo
    );

    const allTournaments = await ctx.db.query("tournaments").collect();
    const upcomingTournaments = allTournaments.filter(t => t.start_date > now);
    const upcomingNext30Days = upcomingTournaments.filter(t =>
      t.start_date <= now + (30 * 24 * 60 * 60 * 1000)
    );

    const userGrowth = previousPeriodUsers.length > 0
      ? ((recentUsers.length - previousPeriodUsers.length) / previousPeriodUsers.length) * 100
      : recentUsers.length > 0 ? 100 : 0;

    const previousTournaments = allTournaments.filter(t =>
      t.created_at && t.created_at > sixtyDaysAgo && t.created_at <= thirtyDaysAgo
    );
    const recentTournaments = allTournaments.filter(t =>
      t.created_at && t.created_at > thirtyDaysAgo
    );

    const tournamentGrowth = previousTournaments.length > 0
      ? ((recentTournaments.length - previousTournaments.length) / previousTournaments.length) * 100
      : recentTournaments.length > 0 ? 100 : 0;

    const previousUpcoming = allTournaments.filter(t =>
      t.start_date > thirtyDaysAgo && t.start_date <= now
    ).length;

    const upcomingGrowth = previousUpcoming > 0
      ? ((upcomingNext30Days.length - previousUpcoming) / previousUpcoming) * 100
      : upcomingNext30Days.length > 0 ? 100 : 0;

    const usersByRole = {
      admin: verifiedUsers.filter(u => u.role === "admin").length,
      students: verifiedUsers.filter(u => u.role === "student").length,
      schools: verifiedUsers.filter(u => u.role === "school_admin").length,
      volunteers: verifiedUsers.filter(u => u.role === "volunteer").length,
    };

    return {
      totalUsers: verifiedUsers.length,
      userGrowth,
      newRegistrations: recentUsers.length,
      registrationGrowth: userGrowth,
      totalTournaments: allTournaments.length,
      tournamentGrowth,
      upcomingTournaments: upcomingNext30Days.length,
      upcomingGrowth,
      usersByRole,
    };
  },
});

export const getTournamentRegistrations = query({
  args: {
    admin_token: v.string(),
    period: v.union(
      v.literal("this_month"),
      v.literal("last_month"),
      v.literal("three_months"),
      v.literal("six_months")
    ),
  },
  handler: async (ctx, args) => {
    const sessionResult = await ctx.runQuery(internal.functions.auth.verifySessionReadOnly, {
      token: args.admin_token,
    });

    if (!sessionResult.valid || sessionResult.user?.role !== "admin") {
      throw new Error("Admin access required");
    }

    const now = Date.now();
    let startDate: number;
    let dataPoints: { date: string; registrations: number }[] = [];

    const teams = await ctx.db.query("teams").collect();

    switch (args.period) {
      case "this_month":
        startDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
        dataPoints = generateDailyData(teams, startDate, now);
        break;
      case "last_month":
        const lastMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
        const lastMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth(), 0);
        startDate = lastMonth.getTime();
        dataPoints = generateDailyData(teams, startDate, lastMonthEnd.getTime());
        break;
      case "three_months":
        startDate = now - (90 * 24 * 60 * 60 * 1000);
        dataPoints = generateWeeklyData(teams, startDate, now);
        break;
      case "six_months":
        startDate = now - (180 * 24 * 60 * 60 * 1000);
        dataPoints = generateMonthlyData(teams, startDate, now);
        break;
    }

    return dataPoints;
  },
});

function generateDailyData(teams: any[], startDate: number, endDate: number) {
  const dataPoints = [];

  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dayEnd = dayStart + (24 * 60 * 60 * 1000) - 1;

    const registrations = teams.filter(t =>
      t.created_at >= dayStart && t.created_at <= dayEnd
    ).length;

    dataPoints.push({
      date: d.getDate().toString(),
      registrations
    });
  }

  return dataPoints;
}

function generateWeeklyData(teams: any[], startDate: number, endDate: number) {
  const dataPoints = [];

  const start = new Date(startDate);
  const end = new Date(endDate);

  let weekNum = 1;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 7)) {
    const weekStart = d.getTime();
    const weekEnd = weekStart + (7 * 24 * 60 * 60 * 1000) - 1;

    const registrations = teams.filter(t =>
      t.created_at >= weekStart && t.created_at <= Math.min(weekEnd, end.getTime())
    ).length;

    dataPoints.push({
      date: `Week ${weekNum}`,
      registrations
    });
    weekNum++;
  }

  return dataPoints;
}

function generateMonthlyData(teams: any[], startDate: number, endDate: number) {
  const dataPoints = [];

  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start.getFullYear(), start.getMonth(), 1); d <= end; d.setMonth(d.getMonth() + 1)) {
    const monthStart = d.getTime();
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).getTime();

    const registrations = teams.filter(t =>
      t.created_at >= monthStart && t.created_at <= Math.min(monthEnd, end.getTime())
    ).length;

    dataPoints.push({
      date: d.toLocaleDateString('en-US', { month: 'short' }),
      registrations
    });
  }

  return dataPoints;
}