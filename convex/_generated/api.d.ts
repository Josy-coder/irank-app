/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as files from "../files.js";
import type * as functions_admin_analytics from "../functions/admin/analytics.js";
import type * as functions_admin_ballots from "../functions/admin/ballots.js";
import type * as functions_admin_dashboard from "../functions/admin/dashboard.js";
import type * as functions_admin_invitations from "../functions/admin/invitations.js";
import type * as functions_admin_leagues from "../functions/admin/leagues.js";
import type * as functions_admin_teams from "../functions/admin/teams.js";
import type * as functions_admin_tournaments from "../functions/admin/tournaments.js";
import type * as functions_admin_users from "../functions/admin/users.js";
import type * as functions_alerts from "../functions/alerts.js";
import type * as functions_analytics from "../functions/analytics.js";
import type * as functions_audit from "../functions/audit.js";
import type * as functions_auth from "../functions/auth.js";
import type * as functions_ballots from "../functions/ballots.js";
import type * as functions_email from "../functions/email.js";
import type * as functions_invitations from "../functions/invitations.js";
import type * as functions_leagues from "../functions/leagues.js";
import type * as functions_notifications from "../functions/notifications.js";
import type * as functions_pairings from "../functions/pairings.js";
import type * as functions_rankings from "../functions/rankings.js";
import type * as functions_school_dashboard from "../functions/school/dashboard.js";
import type * as functions_school_students from "../functions/school/students.js";
import type * as functions_schools from "../functions/schools.js";
import type * as functions_student_dashboard from "../functions/student/dashboard.js";
import type * as functions_student_teams from "../functions/student/teams.js";
import type * as functions_teams from "../functions/teams.js";
import type * as functions_tournaments from "../functions/tournaments.js";
import type * as functions_users from "../functions/users.js";
import type * as functions_volunteers_ballots from "../functions/volunteers/ballots.js";
import type * as functions_volunteers_dashboard from "../functions/volunteers/dashboard.js";
import type * as lib_password from "../lib/password.js";
import type * as lib_push_service from "../lib/push_service.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  files: typeof files;
  "functions/admin/analytics": typeof functions_admin_analytics;
  "functions/admin/ballots": typeof functions_admin_ballots;
  "functions/admin/dashboard": typeof functions_admin_dashboard;
  "functions/admin/invitations": typeof functions_admin_invitations;
  "functions/admin/leagues": typeof functions_admin_leagues;
  "functions/admin/teams": typeof functions_admin_teams;
  "functions/admin/tournaments": typeof functions_admin_tournaments;
  "functions/admin/users": typeof functions_admin_users;
  "functions/alerts": typeof functions_alerts;
  "functions/analytics": typeof functions_analytics;
  "functions/audit": typeof functions_audit;
  "functions/auth": typeof functions_auth;
  "functions/ballots": typeof functions_ballots;
  "functions/email": typeof functions_email;
  "functions/invitations": typeof functions_invitations;
  "functions/leagues": typeof functions_leagues;
  "functions/notifications": typeof functions_notifications;
  "functions/pairings": typeof functions_pairings;
  "functions/rankings": typeof functions_rankings;
  "functions/school/dashboard": typeof functions_school_dashboard;
  "functions/school/students": typeof functions_school_students;
  "functions/schools": typeof functions_schools;
  "functions/student/dashboard": typeof functions_student_dashboard;
  "functions/student/teams": typeof functions_student_teams;
  "functions/teams": typeof functions_teams;
  "functions/tournaments": typeof functions_tournaments;
  "functions/users": typeof functions_users;
  "functions/volunteers/ballots": typeof functions_volunteers_ballots;
  "functions/volunteers/dashboard": typeof functions_volunteers_dashboard;
  "lib/password": typeof lib_password;
  "lib/push_service": typeof lib_push_service;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
