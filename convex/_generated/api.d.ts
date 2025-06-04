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
import type * as actions_email from "../actions/email.js";
import type * as files from "../files.js";
import type * as functions_admin_dashboard from "../functions/admin/dashboard.js";
import type * as functions_admin_leagues from "../functions/admin/leagues.js";
import type * as functions_admin_tournaments from "../functions/admin/tournaments.js";
import type * as functions_admin_users from "../functions/admin/users.js";
import type * as functions_audit from "../functions/audit.js";
import type * as functions_auth from "../functions/auth.js";
import type * as functions_leagues from "../functions/leagues.js";
import type * as functions_schools from "../functions/schools.js";
import type * as functions_tournaments from "../functions/tournaments.js";
import type * as functions_users from "../functions/users.js";
import type * as lib_password from "../lib/password.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  "actions/email": typeof actions_email;
  files: typeof files;
  "functions/admin/dashboard": typeof functions_admin_dashboard;
  "functions/admin/leagues": typeof functions_admin_leagues;
  "functions/admin/tournaments": typeof functions_admin_tournaments;
  "functions/admin/users": typeof functions_admin_users;
  "functions/audit": typeof functions_audit;
  "functions/auth": typeof functions_auth;
  "functions/leagues": typeof functions_leagues;
  "functions/schools": typeof functions_schools;
  "functions/tournaments": typeof functions_tournaments;
  "functions/users": typeof functions_users;
  "lib/password": typeof lib_password;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
