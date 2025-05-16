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
import type * as ResendOTP from "../ResendOTP.js";
import type * as auth from "../auth.js";
import type * as functions_audit from "../functions/audit.js";
import type * as functions_leagues from "../functions/leagues.js";
import type * as functions_schools from "../functions/schools.js";
import type * as functions_sync from "../functions/sync.js";
import type * as functions_tournament from "../functions/tournament.js";
import type * as functions_users from "../functions/users.js";
import type * as http from "../http.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  ResendOTP: typeof ResendOTP;
  auth: typeof auth;
  "functions/audit": typeof functions_audit;
  "functions/leagues": typeof functions_leagues;
  "functions/schools": typeof functions_schools;
  "functions/sync": typeof functions_sync;
  "functions/tournament": typeof functions_tournament;
  "functions/users": typeof functions_users;
  http: typeof http;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
