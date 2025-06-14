import { mutation, query } from "../../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../../_generated/api";
import { Id } from "../../_generated/dataModel";

export const getDashboardOverview = query({
  args: {
    token: v.string(),
    date_range: v.optional(v.object({
      start: v.number(),
      end: v.number(),
    })),
  },
  handler: async (ctx, args): Promise<{
    total_tournaments: number;
    active_tournaments: number;
    total_users: number;
    total_schools: number;
    total_debates: number;
    completion_rate: number;
    growth_metrics: {
      tournaments: number;
      users: number;
      schools: number;
    };
  }> => {

    if (args.token !== "shared") {
      const sessionResult = await ctx.runQuery(internal.functions.auth.verifySessionReadOnly, {
        token: args.token,
      });

      if (!sessionResult.valid || !sessionResult.user || sessionResult.user.role !== "admin") {
        throw new Error("Admin access required");
      }
    }

    const now = Date.now();
    const dateRange = args.date_range || {
      start: now - (30 * 24 * 60 * 60 * 1000),
      end: now,
    };

    const allTournaments = await ctx.db.query("tournaments").collect();
    const activeTournaments = allTournaments.filter(t =>
      t.status === "published" || t.status === "inProgress"
    );

    const tournamentsInRange = allTournaments.filter(t =>
      t.created_at >= dateRange.start && t.created_at <= dateRange.end
    );

    const allUsers = await ctx.db.query("users").collect();
    const usersInRange = allUsers.filter(u =>
      u.created_at >= dateRange.start && u.created_at <= dateRange.end
    );

    const allSchools = await ctx.db.query("schools").collect();
    const schoolsInRange = allSchools.filter(s =>
      s.created_at >= dateRange.start && s.created_at <= dateRange.end
    );

    const allDebates = await ctx.db.query("debates").collect();
    const completedDebates = allDebates.filter(d => d.status === "completed");

    const completionRate = allDebates.length > 0
      ? (completedDebates.length / allDebates.length) * 100
      : 0;

    const previousPeriodStart = dateRange.start - (dateRange.end - dateRange.start);
    const previousTournaments = allTournaments.filter(t =>
      t.created_at >= previousPeriodStart && t.created_at < dateRange.start
    );
    const previousUsers = allUsers.filter(u =>
      u.created_at >= previousPeriodStart && u.created_at < dateRange.start
    );
    const previousSchools = allSchools.filter(s =>
      s.created_at >= previousPeriodStart && s.created_at < dateRange.start
    );

    const calculateGrowth = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    return {
      total_tournaments: allTournaments.length,
      active_tournaments: activeTournaments.length,
      total_users: allUsers.length,
      total_schools: allSchools.length,
      total_debates: allDebates.length,
      completion_rate: Math.round(completionRate * 10) / 10,
      growth_metrics: {
        tournaments: Math.round(calculateGrowth(tournamentsInRange.length, previousTournaments.length) * 10) / 10,
        users: Math.round(calculateGrowth(usersInRange.length, previousUsers.length) * 10) / 10,
        schools: Math.round(calculateGrowth(schoolsInRange.length, previousSchools.length) * 10) / 10,
      },
    };
  },
});

export const getTournamentAnalytics = query({
  args: {
    token: v.string(),
    date_range: v.optional(v.object({
      start: v.number(),
      end: v.number(),
    })),
    league_id: v.optional(v.id("leagues")),
  },
  handler: async (ctx, args): Promise<{
    tournament_trends: Array<{
      date: string;
      total: number;
      completed: number;
      in_progress: number;
      published: number;
    }>;
    format_distribution: Array<{
      format: string;
      count: number;
      percentage: number;
    }>;
    completion_rates: Array<{
      month: string;
      rate: number;
    }>;
    virtual_vs_physical: {
      virtual: number;
      physical: number;
    };
    average_participants: number;
    geographic_distribution: Array<{
      country: string;
      tournaments: number;
      schools: number;
    }>;
  }> => {

    if (args.token !== "shared") {
      const sessionResult = await ctx.runQuery(internal.functions.auth.verifySessionReadOnly, {
        token: args.token,
      });

      if (!sessionResult.valid || !sessionResult.user || sessionResult.user.role !== "admin") {
        throw new Error("Admin access required");
      }
    }

    const now = Date.now();
    const dateRange = args.date_range || {
      start: now - (90 * 24 * 60 * 60 * 1000),
      end: now,
    };

    let tournaments = await ctx.db.query("tournaments").collect();

    if (args.league_id) {
      tournaments = tournaments.filter(t => t.league_id === args.league_id);
    }

    tournaments = tournaments.filter(t =>
      t.created_at >= dateRange.start && t.created_at <= dateRange.end
    );

    const dailyData: Record<string, { total: number; completed: number; in_progress: number; published: number }> = {};

    tournaments.forEach(tournament => {
      const date = new Date(tournament.created_at).toISOString().split('T')[0];
      if (!dailyData[date]) {
        dailyData[date] = { total: 0, completed: 0, in_progress: 0, published: 0 };
      }
      dailyData[date].total++;
      if (tournament.status === "completed") dailyData[date].completed++;
      if (tournament.status === "inProgress") dailyData[date].in_progress++;
      if (tournament.status === "published") dailyData[date].published++;
    });

    const tournament_trends = Object.entries(dailyData).map(([date, data]) => ({
      date,
      ...data,
    })).sort((a, b) => a.date.localeCompare(b.date));

    const formatCounts: Record<string, number> = {};
    tournaments.forEach(t => {
      formatCounts[t.format] = (formatCounts[t.format] || 0) + 1;
    });

    const format_distribution = Object.entries(formatCounts).map(([format, count]) => ({
      format,
      count,
      percentage: tournaments.length > 0 ? Math.round((count / tournaments.length) * 100 * 10) / 10 : 0,
    }));

    const monthlyCompletion: Record<string, { total: number; completed: number }> = {};
    tournaments.forEach(t => {
      const month = new Date(t.created_at).toISOString().slice(0, 7);
      if (!monthlyCompletion[month]) {
        monthlyCompletion[month] = { total: 0, completed: 0 };
      }
      monthlyCompletion[month].total++;
      if (t.status === "completed") {
        monthlyCompletion[month].completed++;
      }
    });

    const completion_rates = Object.entries(monthlyCompletion).map(([month, data]) => ({
      month,
      rate: data.total > 0 ? Math.round((data.completed / data.total) * 100 * 10) / 10 : 0,
    })).sort((a, b) => a.month.localeCompare(b.month));

    const virtual_vs_physical = {
      virtual: tournaments.filter(t => t.is_virtual).length,
      physical: tournaments.filter(t => !t.is_virtual).length,
    };

    const teamsData = await Promise.all(
      tournaments.map(async (tournament) => {
        const teams = await ctx.db
          .query("teams")
          .withIndex("by_tournament_id", (q) => q.eq("tournament_id", tournament._id))
          .collect();
        return teams.length;
      })
    );

    const average_participants = teamsData.length > 0
      ? Math.round((teamsData.reduce((sum, count) => sum + count, 0) / teamsData.length) * 10) / 10
      : 0;

    const schoolIds = new Set<Id<"schools">>();
    const teamsAll = await ctx.db.query("teams").collect();
    teamsAll.forEach(team => {
      if (team.school_id && tournaments.some(t => t._id === team.tournament_id)) {
        schoolIds.add(team.school_id);
      }
    });

    const schools = await Promise.all(
      Array.from(schoolIds).map(id => ctx.db.get(id))
    );

    const countryData: Record<string, { tournaments: Set<Id<"tournaments">>; schools: number }> = {};

    for (const school of schools) {
      if (!school) continue;

      if (!countryData[school.country]) {
        countryData[school.country] = { tournaments: new Set(), schools: 0 };
      }
      countryData[school.country].schools++;

      const schoolTeams = teamsAll.filter(t => t.school_id === school._id);
      schoolTeams.forEach(team => {
        if (tournaments.some(t => t._id === team.tournament_id)) {
          countryData[school.country].tournaments.add(team.tournament_id);
        }
      });
    }

    const geographic_distribution = Object.entries(countryData).map(([country, data]) => ({
      country,
      tournaments: data.tournaments.size,
      schools: data.schools,
    }));

    return {
      tournament_trends,
      format_distribution,
      completion_rates,
      virtual_vs_physical,
      average_participants,
      geographic_distribution,
    };
  },
});

export const getUserAnalytics = query({
  args: {
    token: v.string(),
    date_range: v.optional(v.object({
      start: v.number(),
      end: v.number(),
    })),
  },
  handler: async (ctx, args): Promise<{
    user_growth: Array<{
      date: string;
      students: number;
      volunteers: number;
      school_admins: number;
      admins: number;
      total: number;
    }>;
    role_distribution: Array<{
      role: string;
      count: number;
      percentage: number;
      verified_percentage: number;
    }>;
    engagement_metrics: {
      active_users: number;
      login_frequency: Array<{
        period: string;
        logins: number;
      }>;
      tournament_participation: Array<{
        role: string;
        participation_rate: number;
      }>;
    };
    geographic_distribution: Array<{
      country: string;
      users: number;
      schools: number;
    }>;
    retention_rates: Array<{
      cohort: string;
      retained_users: number;
      total_users: number;
      retention_rate: number;
    }>;
  }> => {
    if (args.token !== "shared") {
      const sessionResult = await ctx.runQuery(internal.functions.auth.verifySessionReadOnly, {
        token: args.token,
      });

      if (!sessionResult.valid || !sessionResult.user || sessionResult.user.role !== "admin") {
        throw new Error("Admin access required");
      }
    }

    const now = Date.now();
    const dateRange = args.date_range || {
      start: now - (90 * 24 * 60 * 60 * 1000),
      end: now,
    };

    const allUsers = await ctx.db.query("users").collect();
    const usersInRange = allUsers.filter(u =>
      u.created_at >= dateRange.start && u.created_at <= dateRange.end
    );

    const dailyGrowth: Record<string, { students: number; volunteers: number; school_admins: number; admins: number; total: number }> = {};

    usersInRange.forEach(user => {
      const date = new Date(user.created_at).toISOString().split('T')[0];
      if (!dailyGrowth[date]) {
        dailyGrowth[date] = { students: 0, volunteers: 0, school_admins: 0, admins: 0, total: 0 };
      }

      if (user.role === "student") dailyGrowth[date].students++;
      else if (user.role === "volunteer") dailyGrowth[date].volunteers++;
      else if (user.role === "school_admin") dailyGrowth[date].school_admins++;
      else if (user.role === "admin") dailyGrowth[date].admins++;

      dailyGrowth[date].total++;
    });

    const user_growth = Object.entries(dailyGrowth).map(([date, data]) => ({
      date,
      ...data,
    })).sort((a, b) => a.date.localeCompare(b.date));

    const roleCounts: Record<string, { total: number; verified: number }> = {};
    allUsers.forEach(user => {
      if (!roleCounts[user.role]) {
        roleCounts[user.role] = { total: 0, verified: 0 };
      }
      roleCounts[user.role].total++;
      if (user.verified) {
        roleCounts[user.role].verified++;
      }
    });

    const role_distribution = Object.entries(roleCounts).map(([role, data]) => ({
      role,
      count: data.total,
      percentage: allUsers.length > 0 ? Math.round((data.total / allUsers.length) * 100 * 10) / 10 : 0,
      verified_percentage: data.total > 0 ? Math.round((data.verified / data.total) * 100 * 10) / 10 : 0,
    }));

    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
    const activeUsers = allUsers.filter(u =>
      u.last_login_at && u.last_login_at >= thirtyDaysAgo
    ).length;

    const loginData: Record<string, number> = {};
    allUsers.forEach(user => {
      if (user.last_login_at && user.last_login_at >= thirtyDaysAgo) {
        const weeksAgo = Math.floor((now - user.last_login_at) / (7 * 24 * 60 * 60 * 1000));
        const period = `Week ${weeksAgo + 1}`;
        loginData[period] = (loginData[period] || 0) + 1;
      }
    });

    const login_frequency = Object.entries(loginData).map(([period, logins]) => ({
      period,
      logins,
    }));

    const teams = await ctx.db.query("teams").collect();
    const invitations = await ctx.db.query("tournament_invitations").collect();

    const participationByRole: Record<string, { participated: number; total: number }> = {};

    allUsers.forEach(user => {
      if (!participationByRole[user.role]) {
        participationByRole[user.role] = { participated: 0, total: 0 };
      }
      participationByRole[user.role].total++;

      const hasParticipated = teams.some(team => team.members.includes(user._id)) ||
        invitations.some(inv => inv.target_id === user._id && inv.status === "accepted");

      if (hasParticipated) {
        participationByRole[user.role].participated++;
      }
    });

    const tournament_participation = Object.entries(participationByRole).map(([role, data]) => ({
      role,
      participation_rate: data.total > 0 ? Math.round((data.participated / data.total) * 100 * 10) / 10 : 0,
    }));

    const schools = await ctx.db.query("schools").collect();
    const countryData: Record<string, { users: Set<Id<"users">>; schools: number }> = {};

    schools.forEach(school => {
      if (!countryData[school.country]) {
        countryData[school.country] = { users: new Set(), schools: 0 };
      }
      countryData[school.country].schools++;

      allUsers.forEach(user => {
        if (user.school_id === school._id) {
          countryData[school.country].users.add(user._id);
        }
      });
    });

    const geographic_distribution = Object.entries(countryData).map(([country, data]) => ({
      country,
      users: data.users.size,
      schools: data.schools,
    }));

    const cohortData: Record<string, { total: number; retained: number }> = {};
    const retentionPeriod = 30 * 24 * 60 * 60 * 1000;

    allUsers.forEach(user => {
      const cohort = new Date(user.created_at).toISOString().slice(0, 7);
      if (!cohortData[cohort]) {
        cohortData[cohort] = { total: 0, retained: 0 };
      }
      cohortData[cohort].total++;

      const retentionThreshold = user.created_at + retentionPeriod;
      if (user.last_login_at && user.last_login_at >= retentionThreshold) {
        cohortData[cohort].retained++;
      }
    });

    const retention_rates = Object.entries(cohortData)
      .filter(([_, data]) => data.total >= 10)
      .map(([cohort, data]) => ({
        cohort,
        retained_users: data.retained,
        total_users: data.total,
        retention_rate: Math.round((data.retained / data.total) * 100 * 10) / 10,
      }));

    return {
      user_growth,
      role_distribution,
      engagement_metrics: {
        active_users: activeUsers,
        login_frequency,
        tournament_participation,
      },
      geographic_distribution,
      retention_rates,
    };
  },
});

export const getFinancialAnalytics = query({
  args: {
    token: v.string(),
    date_range: v.optional(v.object({
      start: v.number(),
      end: v.number(),
    })),
    currency: v.optional(v.union(v.literal("RWF"), v.literal("USD"))),
  },
  handler: async (ctx, args): Promise<{
    revenue_trends: Array<{
      date: string;
      revenue: number;
      transactions: number;
    }>;
    payment_distribution: Array<{
      method: string;
      count: number;
      amount: number;
      percentage: number;
    }>;
    tournament_revenue: Array<{
      tournament_name: string;
      revenue: number;
      teams_count: number;
      fee_per_team: number;
    }>;
    outstanding_payments: {
      total_amount: number;
      count: number;
      by_tournament: Array<{
        tournament_name: string;
        amount: number;
        count: number;
      }>;
    };
    waiver_usage: {
      total_waivers: number;
      total_amount_waived: number;
      by_tournament: Array<{
        tournament_name: string;
        waivers_used: number;
        amount_waived: number;
      }>;
    };
    regional_revenue: Array<{
      country: string;
      revenue: number;
      tournaments: number;
    }>;
  }> => {

    if (args.token !== "shared") {
      const sessionResult = await ctx.runQuery(internal.functions.auth.verifySessionReadOnly, {
        token: args.token,
      });

      if (!sessionResult.valid || !sessionResult.user || sessionResult.user.role !== "admin") {
        throw new Error("Admin access required");
      }
    }

    const now = Date.now();
    const dateRange = args.date_range || {
      start: now - (90 * 24 * 60 * 60 * 1000),
      end: now,
    };

    const payments = await ctx.db.query("payments").collect();
    const filteredPayments = payments.filter(p =>
      p.created_at >= dateRange.start && p.created_at <= dateRange.end &&
      (!args.currency || p.currency === args.currency)
    );

    const tournaments = await ctx.db.query("tournaments").collect();
    const teams = await ctx.db.query("teams").collect();

    const dailyRevenue: Record<string, { revenue: number; transactions: number }> = {};

    filteredPayments.forEach(payment => {
      if (payment.status === "completed") {
        const date = new Date(payment.created_at).toISOString().split('T')[0];
        if (!dailyRevenue[date]) {
          dailyRevenue[date] = { revenue: 0, transactions: 0 };
        }
        dailyRevenue[date].revenue += payment.amount;
        dailyRevenue[date].transactions++;
      }
    });

    const revenue_trends = Object.entries(dailyRevenue).map(([date, data]) => ({
      date,
      ...data,
    })).sort((a, b) => a.date.localeCompare(b.date));

    const paymentMethods: Record<string, { count: number; amount: number }> = {};

    filteredPayments.forEach(payment => {
      if (payment.status === "completed") {
        if (!paymentMethods[payment.method]) {
          paymentMethods[payment.method] = { count: 0, amount: 0 };
        }
        paymentMethods[payment.method].count++;
        paymentMethods[payment.method].amount += payment.amount;
      }
    });

    const totalPaymentAmount = Object.values(paymentMethods).reduce((sum, data) => sum + data.amount, 0);

    const payment_distribution = Object.entries(paymentMethods).map(([method, data]) => ({
      method,
      count: data.count,
      amount: data.amount,
      percentage: totalPaymentAmount > 0 ? Math.round((data.amount / totalPaymentAmount) * 100 * 10) / 10 : 0,
    }));

    const tournamentRevenue: Record<Id<"tournaments">, { revenue: number; teams_count: number; fee: number }> = {};

    filteredPayments.forEach(payment => {
      if (payment.status === "completed" && payment.tournament_id) {
        if (!tournamentRevenue[payment.tournament_id]) {
          const tournament = tournaments.find(t => t._id === payment.tournament_id);
          const tournamentTeams = teams.filter(t => t.tournament_id === payment.tournament_id);
          tournamentRevenue[payment.tournament_id] = {
            revenue: 0,
            teams_count: tournamentTeams.length,
            fee: tournament?.fee || 0,
          };
        }
        tournamentRevenue[payment.tournament_id].revenue += payment.amount;
      }
    });

    const tournament_revenue = Object.entries(tournamentRevenue).map(([tournamentId, data]) => {
      const tournament = tournaments.find(t => t._id === tournamentId);
      return {
        tournament_name: tournament?.name || "Unknown Tournament",
        revenue: data.revenue,
        teams_count: data.teams_count,
        fee_per_team: data.fee,
      };
    });

    const pendingPayments = payments.filter(p => p.status === "pending");
    const outstandingByTournament: Record<Id<"tournaments">, { amount: number; count: number }> = {};

    pendingPayments.forEach(payment => {
      if (payment.tournament_id) {
        if (!outstandingByTournament[payment.tournament_id]) {
          outstandingByTournament[payment.tournament_id] = { amount: 0, count: 0 };
        }
        outstandingByTournament[payment.tournament_id].amount += payment.amount;
        outstandingByTournament[payment.tournament_id].count++;
      }
    });

    const outstanding_payments = {
      total_amount: pendingPayments.reduce((sum, p) => sum + p.amount, 0),
      count: pendingPayments.length,
      by_tournament: Object.entries(outstandingByTournament).map(([tournamentId, data]) => {
        const tournament = tournaments.find(t => t._id === tournamentId);
        return {
          tournament_name: tournament?.name || "Unknown Tournament",
          amount: data.amount,
          count: data.count,
        };
      }),
    };

    const waivedTeams = teams.filter(t => t.payment_status === "waived");
    const waiverByTournament: Record<Id<"tournaments">, { count: number; amount: number }> = {};

    waivedTeams.forEach(team => {
      const tournament = tournaments.find(t => t._id === team.tournament_id);
      if (tournament && tournament.fee) {
        if (!waiverByTournament[team.tournament_id]) {
          waiverByTournament[team.tournament_id] = { count: 0, amount: 0 };
        }
        waiverByTournament[team.tournament_id].count++;
        waiverByTournament[team.tournament_id].amount += tournament.fee;
      }
    });

    const waiver_usage = {
      total_waivers: waivedTeams.length,
      total_amount_waived: Object.values(waiverByTournament).reduce((sum, data) => sum + data.amount, 0),
      by_tournament: Object.entries(waiverByTournament).map(([tournamentId, data]) => {
        const tournament = tournaments.find(t => t._id === tournamentId);
        return {
          tournament_name: tournament?.name || "Unknown Tournament",
          waivers_used: data.count,
          amount_waived: data.amount,
        };
      }),
    };

    const schools = await ctx.db.query("schools").collect();
    const regionalRevenue: Record<string, { revenue: number; tournaments: Set<Id<"tournaments">> }> = {};

    filteredPayments.forEach(payment => {
      if (payment.status === "completed" && payment.school_id) {
        const school = schools.find(s => s._id === payment.school_id);
        if (school) {
          if (!regionalRevenue[school.country]) {
            regionalRevenue[school.country] = { revenue: 0, tournaments: new Set() };
          }
          regionalRevenue[school.country].revenue += payment.amount;
          if (payment.tournament_id) {
            regionalRevenue[school.country].tournaments.add(payment.tournament_id);
          }
        }
      }
    });

    const regional_revenue = Object.entries(regionalRevenue).map(([country, data]) => ({
      country,
      revenue: data.revenue,
      tournaments: data.tournaments.size,
    }));

    return {
      revenue_trends,
      payment_distribution,
      tournament_revenue,
      outstanding_payments,
      waiver_usage,
      regional_revenue,
    };
  },
});

export const getPerformanceAnalytics = query({
  args: {
    token: v.string(),
    date_range: v.optional(v.object({
      start: v.number(),
      end: v.number(),
    })),
    tournament_id: v.optional(v.id("tournaments")),
  },
  handler: async (ctx, args): Promise<{
    judge_performance: {
      feedback_trends: Array<{
        period: string;
        average_rating: number;
        total_feedback: number;
      }>;
      bias_detection: Array<{
        judge_name: string;
        bias_reports: number;
        total_assignments: number;
        bias_rate: number;
      }>;
      consistency_scores: Array<{
        judge_name: string;
        consistency: number;
        debates_judged: number;
      }>;
    };
    debate_quality: {
      fact_check_usage: Array<{
        tournament: string;
        fact_checks: number;
        debates: number;
        usage_rate: number;
      }>;
      argument_complexity: Array<{
        tournament: string;
        avg_arguments: number;
        avg_rebuttals: number;
        quality_score: number;
      }>;
    };
    team_performance: Array<{
      school_name: string;
      win_rate: number;
      tournaments_participated: number;
      avg_speaker_score: number;
    }>;
    speaker_performance: Array<{
      speaker_rank_range: string;
      count: number;
      percentage: number;
    }>;
    efficiency_metrics: {
      avg_tournament_duration: number;
      round_completion_times: Array<{
        round_type: string;
        avg_duration: number;
      }>;
      judge_response_times: Array<{
        period: string;
        avg_response_time: number;
      }>;
    };
  }> => {
    if (args.token !== "shared") {
      const sessionResult = await ctx.runQuery(internal.functions.auth.verifySessionReadOnly, {
        token: args.token,
      });

      if (!sessionResult.valid || !sessionResult.user || sessionResult.user.role !== "admin") {
        throw new Error("Admin access required");
      }
    }

    let tournaments = await ctx.db.query("tournaments").collect();
    if (args.tournament_id) {
      tournaments = tournaments.filter(t => t._id === args.tournament_id);
    }

    const debates = await ctx.db.query("debates").collect();
    const judgingScores = await ctx.db.query("judging_scores").collect();
    const judgeFeedback = await ctx.db.query("judge_feedback").collect();
    const users = await ctx.db.query("users").collect();
    const teams = await ctx.db.query("teams").collect();
    const schools = await ctx.db.query("schools").collect();
    const rounds = await ctx.db.query("rounds").collect();

    const feedbackByPeriod: Record<string, { total: number; sum: number }> = {};

    judgeFeedback.forEach(feedback => {
      const month = new Date(feedback.submitted_at).toISOString().slice(0, 7);
      if (!feedbackByPeriod[month]) {
        feedbackByPeriod[month] = { total: 0, sum: 0 };
      }
      feedbackByPeriod[month].total++;
      feedbackByPeriod[month].sum += (feedback.clarity + feedback.fairness + feedback.knowledge + feedback.helpfulness) / 4;
    });

    const feedback_trends = Object.entries(feedbackByPeriod).map(([period, data]) => ({
      period,
      average_rating: data.total > 0 ? Math.round((data.sum / data.total) * 10) / 10 : 0,
      total_feedback: data.total,
    })).sort((a, b) => a.period.localeCompare(b.period));

    const judgeStats: Record<Id<"users">, { bias_reports: number; total_assignments: number; name: string }> = {};

    judgingScores.forEach(score => {
      if (!judgeStats[score.judge_id]) {
        const judge = users.find(u => u._id === score.judge_id);
        judgeStats[score.judge_id] = {
          bias_reports: 0,
          total_assignments: 0,
          name: judge?.name || "Unknown Judge",
        };
      }
      judgeStats[score.judge_id].total_assignments++;

      const hasBias = score.speaker_scores?.some(s => s.bias_detected) || false;
      if (hasBias) {
        judgeStats[score.judge_id].bias_reports++;
      }
    });

    const bias_detection = Object.values(judgeStats).map(stats => ({
      judge_name: stats.name,
      bias_reports: stats.bias_reports,
      total_assignments: stats.total_assignments,
      bias_rate: stats.total_assignments > 0 ? Math.round((stats.bias_reports / stats.total_assignments) * 100 * 10) / 10 : 0,
    })).filter(j => j.total_assignments >= 5);

    const judgeConsistency: Record<Id<"users">, { scores: number[]; name: string }> = {};

    judgingScores.forEach(score => {
      if (!judgeConsistency[score.judge_id]) {
        const judge = users.find(u => u._id === score.judge_id);
        judgeConsistency[score.judge_id] = {
          scores: [],
          name: judge?.name || "Unknown Judge",
        };
      }

      if (score.speaker_scores) {
        const avgScore = score.speaker_scores.reduce((sum, s) => sum + s.score, 0) / score.speaker_scores.length;
        judgeConsistency[score.judge_id].scores.push(avgScore);
      }
    });

    const consistency_scores = Object.values(judgeConsistency).map(data => {
      if (data.scores.length < 3) return null;

      const mean = data.scores.reduce((sum, s) => sum + s, 0) / data.scores.length;
      const variance = data.scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / data.scores.length;
      const standardDeviation = Math.sqrt(variance);

      const consistency = Math.max(0, 100 - (standardDeviation * 10));

      return {
        judge_name: data.name,
        consistency: Math.round(consistency * 10) / 10,
        debates_judged: data.scores.length,
      };
    }).filter(Boolean) as Array<{
      judge_name: string;
      consistency: number;
      debates_judged: number;
    }>;

    const factCheckByTournament: Record<Id<"tournaments">, { fact_checks: number; debates: number }> = {};

    debates.forEach(debate => {
      if (!factCheckByTournament[debate.tournament_id]) {
        factCheckByTournament[debate.tournament_id] = { fact_checks: 0, debates: 0 };
      }
      factCheckByTournament[debate.tournament_id].debates++;
      factCheckByTournament[debate.tournament_id].fact_checks += debate.fact_checks?.length || 0;
    });

    const fact_check_usage = Object.entries(factCheckByTournament).map(([tournamentId, data]) => {
      const tournament = tournaments.find(t => t._id === tournamentId);
      return {
        tournament: tournament?.name || "Unknown Tournament",
        fact_checks: data.fact_checks,
        debates: data.debates,
        usage_rate: data.debates > 0 ? Math.round((data.fact_checks / data.debates) * 10) / 10 : 0,
      };
    });

    const argumentByTournament: Record<Id<"tournaments">, { arguments: number[]; rebuttals: number[]; debates: number }> = {};

    debates.forEach(debate => {
      if (!argumentByTournament[debate.tournament_id]) {
        argumentByTournament[debate.tournament_id] = { arguments: [], rebuttals: [], debates: 0 };
      }
      argumentByTournament[debate.tournament_id].debates++;

      if (debate.argument_flow) {
        const mainArgs = debate.argument_flow.filter(arg => arg.type === "main").length;
        const rebuttals = debate.argument_flow.filter(arg => arg.type === "rebuttal").length;

        argumentByTournament[debate.tournament_id].arguments.push(mainArgs);
        argumentByTournament[debate.tournament_id].rebuttals.push(rebuttals);
      }
    });

    const argument_complexity = Object.entries(argumentByTournament).map(([tournamentId, data]) => {
      const tournament = tournaments.find(t => t._id === tournamentId);
      const avgArgs = data.arguments.length > 0 ? data.arguments.reduce((sum, a) => sum + a, 0) / data.arguments.length : 0;
      const avgRebuttals = data.rebuttals.length > 0 ? data.rebuttals.reduce((sum, r) => sum + r, 0) / data.rebuttals.length : 0;

      const quality_score = Math.min(100, (avgArgs * 10) + (avgRebuttals * 15));

      return {
        tournament: tournament?.name || "Unknown Tournament",
        avg_arguments: Math.round(avgArgs * 10) / 10,
        avg_rebuttals: Math.round(avgRebuttals * 10) / 10,
        quality_score: Math.round(quality_score * 10) / 10,
      };
    });

    const teamPerformance: Record<Id<"schools">, { wins: number; total: number; speaker_scores: number[]; tournaments: Set<Id<"tournaments">> }> = {};

    const results = await ctx.db.query("tournament_results").collect();

    results.forEach(result => {
      if (result.result_type === "team" && result.team_id) {
        const team = teams.find(t => t._id === result.team_id);
        if (team?.school_id) {
          if (!teamPerformance[team.school_id]) {
            teamPerformance[team.school_id] = { wins: 0, total: 0, speaker_scores: [], tournaments: new Set() };
          }
          teamPerformance[team.school_id].wins += result.wins || 0;
          teamPerformance[team.school_id].total += (result.wins || 0) + (result.losses || 0);
          teamPerformance[team.school_id].tournaments.add(team.tournament_id);
        }
      }

      if (result.result_type === "speaker" && result.speaker_team_id) {
        const team = teams.find(t => t._id === result.speaker_team_id);
        if (team?.school_id && result.average_speaker_score) {
          if (!teamPerformance[team.school_id]) {
            teamPerformance[team.school_id] = { wins: 0, total: 0, speaker_scores: [], tournaments: new Set() };
          }
          teamPerformance[team.school_id].speaker_scores.push(result.average_speaker_score);
        }
      }
    });

    const team_performance = Object.entries(teamPerformance).map(([schoolId, data]) => {
      const school = schools.find(s => s._id === schoolId);
      const winRate = data.total > 0 ? (data.wins / data.total) * 100 : 0;
      const avgSpeakerScore = data.speaker_scores.length > 0
        ? data.speaker_scores.reduce((sum, s) => sum + s, 0) / data.speaker_scores.length
        : 0;

      return {
        school_name: school?.name || "Unknown School",
        win_rate: Math.round(winRate * 10) / 10,
        tournaments_participated: data.tournaments.size,
        avg_speaker_score: Math.round(avgSpeakerScore * 10) / 10,
      };
    }).filter(p => p.tournaments_participated > 0);

    const speakerResults = results.filter(r => r.result_type === "speaker");
    const speakerDistribution: Record<string, number> = {};

    speakerResults.forEach(result => {
      if (result.speaker_rank) {
        let rankRange: string;
        if (result.speaker_rank <= 10) {
          rankRange = "Top 10";
        } else if (result.speaker_rank <= 25) {
          rankRange = "Top 25";
        } else if (result.speaker_rank <= 50) {
          rankRange = "Top 50";
        } else if (result.speaker_rank <= 100) {
          rankRange = "Top 100";
        } else {
          rankRange = "Below 100";
        }
        speakerDistribution[rankRange] = (speakerDistribution[rankRange] || 0) + 1;
      }
    });

    const totalSpeakers = speakerResults.length;
    const speaker_performance = Object.entries(speakerDistribution).map(([rankRange, count]) => ({
      speaker_rank_range: rankRange,
      count,
      percentage: totalSpeakers > 0 ? Math.round((count / totalSpeakers) * 100 * 10) / 10 : 0,
    }));

    const completedTournaments = tournaments.filter(t => t.status === "completed");
    const totalDuration = completedTournaments.reduce((sum, t) => sum + (t.end_date - t.start_date), 0);
    const avg_tournament_duration = completedTournaments.length > 0
      ? Math.round((totalDuration / completedTournaments.length) / (24 * 60 * 60 * 1000) * 10) / 10
      : 0;

    const roundTypeData: Record<string, number[]> = {};

    rounds.forEach(round => {
      if (round.status === "completed") {
        const duration = round.end_time - round.start_time;
        const durationHours = duration / (60 * 60 * 1000);

        if (!roundTypeData[round.type]) {
          roundTypeData[round.type] = [];
        }
        roundTypeData[round.type].push(durationHours);
      }
    });

    const round_completion_times = Object.entries(roundTypeData).map(([type, durations]) => ({
      round_type: type,
      avg_duration: durations.length > 0
        ? Math.round((durations.reduce((sum, d) => sum + d, 0) / durations.length) * 10) / 10
        : 0,
    }));

    const responseTimeByPeriod: Record<string, number[]> = {};

    judgingScores.forEach(score => {
      const month = new Date(score.submitted_at).toISOString().slice(0, 7);
      if (!responseTimeByPeriod[month]) {
        responseTimeByPeriod[month] = [];
      }

      const debate = debates.find(d => d._id === score.debate_id);
      if (debate && debate.start_time) {
        const responseTime = (score.submitted_at - debate.start_time) / (60 * 60 * 1000);
        if (responseTime > 0 && responseTime < 24 * 7) {
          responseTimeByPeriod[month].push(responseTime);
        }
      }
    });

    const judge_response_times = Object.entries(responseTimeByPeriod).map(([period, times]) => ({
      period,
      avg_response_time: times.length > 0
        ? Math.round((times.reduce((sum, t) => sum + t, 0) / times.length) * 10) / 10
        : 0,
    })).sort((a, b) => a.period.localeCompare(b.period));

    return {
      judge_performance: {
        feedback_trends,
        bias_detection,
        consistency_scores,
      },
      debate_quality: {
        fact_check_usage,
        argument_complexity,
      },
      team_performance,
      speaker_performance,
      efficiency_metrics: {
        avg_tournament_duration,
        round_completion_times,
        judge_response_times,
      },
    };
  },
});

export const incrementViewCount = mutation({
  args: {
    access_token: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const reportShare = await ctx.db
      .query("report_shares")
      .withIndex("by_access_token", (q) => q.eq("access_token", args.access_token))
      .first();

    if (!reportShare) {
      throw new Error("Invalid access token");
    }

    if (reportShare.expires_at < Date.now()) {
      throw new Error("Report access has expired");
    }

    if (reportShare.allowed_views && reportShare.view_count >= reportShare.allowed_views) {
      throw new Error("Maximum views exceeded");
    }

    await ctx.db.patch(reportShare._id, {
      view_count: reportShare.view_count + 1,
    });
  },
});

export const generateShareableReport = mutation({
  args: {
    token: v.string(),
    report_config: v.object({
      title: v.string(),
      sections: v.array(v.string()),
      date_range: v.optional(v.object({
        start: v.number(),
        end: v.number(),
      })),
      filters: v.optional(v.object({
        tournament_id: v.optional(v.id("tournaments")),
        league_id: v.optional(v.id("leagues")),
        currency: v.optional(v.union(v.literal("RWF"), v.literal("USD"))),
      })),
    }),
    access_settings: v.object({
      expires_at: v.optional(v.number()),
      allowed_views: v.optional(v.number()),
      visible_to_roles: v.array(v.string()),
    }),
  },
  handler: async (ctx, args): Promise<{
    share_url: string;
    access_token: string;
    expires_at: number;
  }> => {
    const sessionResult = await ctx.runMutation(internal.functions.auth.verifySession, {
      token: args.token,
    });

    if (!sessionResult.valid || !sessionResult.user || sessionResult.user.role !== "admin") {
      throw new Error("Admin access required");
    }

    const accessToken = Array.from({ length: 32 }, () =>
      Math.random().toString(36).charAt(2)
    ).join('');

    const expiresAt = args.access_settings.expires_at ||
      (Date.now() + (30 * 24 * 60 * 60 * 1000));

    const reportShareId = await ctx.db.insert("report_shares", {
      report_type: "tournament",
      report_id: JSON.stringify({
        config: args.report_config,
      }),
      access_token: accessToken,
      created_by: sessionResult.user.id,
      expires_at: expiresAt,
      allowed_views: args.access_settings.allowed_views,
      view_count: 0,
      created_at: Date.now(),
    });

    await ctx.runMutation(internal.functions.audit.createAuditLog, {
      user_id: sessionResult.user.id,
      action: "system_setting_changed",
      resource_type: "report_shares",
      resource_id: reportShareId,
      description: `Created shareable analytics report: ${args.report_config.title}`,
    });

    const shareUrl = `${process.env.FRONTEND_SITE_URL}/reports/${accessToken}`;

    return {
      share_url: shareUrl,
      access_token: accessToken,
      expires_at: expiresAt,
    };
  },
});

export const exportAnalyticsData = query({
  args: {
    token: v.string(),
    export_format: v.union(v.literal("csv"), v.literal("excel"), v.literal("pdf")),
    sections: v.array(v.string()),
    date_range: v.optional(v.object({
      start: v.number(),
      end: v.number(),
    })),
    filters: v.optional(v.object({
      tournament_id: v.optional(v.id("tournaments")),
      league_id: v.optional(v.id("leagues")),
      currency: v.optional(v.union(v.literal("RWF"), v.literal("USD"))),
    })),
  },
  handler: async (ctx, args): Promise<Record<string, any>> => {

      const sessionResult = await ctx.runQuery(internal.functions.auth.verifySessionReadOnly, {
        token: args.token,
      });

      if (!sessionResult.valid || !sessionResult.user || sessionResult.user.role !== "admin") {
        throw new Error("Admin access required");
      }

    const exportData: Record<string, any> = {};

    if (args.sections.includes("overview")) {
      exportData.overview = await ctx.runQuery(api.functions.admin.analytics.getDashboardOverview, {
        token: args.token,
        date_range: args.date_range,
      });
    }

    if (args.sections.includes("tournaments")) {
      exportData.tournaments = await ctx.runQuery(api.functions.admin.analytics.getTournamentAnalytics, {
        token: args.token,
        date_range: args.date_range,
        league_id: args.filters?.league_id,
      });
    }

    if (args.sections.includes("users")) {
      exportData.users = await ctx.runQuery(api.functions.admin.analytics.getUserAnalytics, {
        token: args.token,
        date_range: args.date_range,
      });
    }

    if (args.sections.includes("financial")) {
      exportData.financial = await ctx.runQuery(api.functions.admin.analytics.getFinancialAnalytics, {
        token: args.token,
        date_range: args.date_range,
        currency: args.filters?.currency,
      });
    }

    if (args.sections.includes("performance")) {
      exportData.performance = await ctx.runQuery(api.functions.admin.analytics.getPerformanceAnalytics, {
        token: args.token,
        date_range: args.date_range,
        tournament_id: args.filters?.tournament_id,
      });
    }

    return exportData;
  },
});