import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.hourly(
  "cleanup expired auth data",
  { minuteUTC: 0 },
  internal.functions.auth.cleanupExpired,
);

crons.interval(
  "cleanup expired notifications",
  { hours: 6 },
  internal.functions.notifications.cleanupExpiredNotifications,
);

crons.daily(
  "cleanup inactive subscriptions",
  { hourUTC: 2, minuteUTC: 0 },
  internal.functions.notifications.cleanupInactiveSubscriptions,
  { days: 30 },
);


crons.cron(
  "monthly audit logs cleanup",
  "0 1 28-31 * *",
  internal.functions.audit.monthlyAuditCleanup,
);

crons.daily(
  "daily cleanup check",
  { hourUTC: 1, minuteUTC: 0 },
  internal.functions.audit.conditionalMonthlyCleanup,
);

export default crons;