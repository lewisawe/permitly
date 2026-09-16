/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as cases from "../cases.js";
import type * as crons from "../crons.js";
import type * as email from "../email.js";
import type * as firecrawl from "../firecrawl.js";
import type * as health from "../health.js";
import type * as http from "../http.js";
import type * as llm from "../llm.js";
import type * as permits from "../permits.js";
import type * as portalHtml from "../portalHtml.js";
import type * as runner from "../runner.js";
import type * as seed from "../seed.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  cases: typeof cases;
  crons: typeof crons;
  email: typeof email;
  firecrawl: typeof firecrawl;
  health: typeof health;
  http: typeof http;
  llm: typeof llm;
  permits: typeof permits;
  portalHtml: typeof portalHtml;
  runner: typeof runner;
  seed: typeof seed;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  staticHosting: import("@convex-dev/static-hosting/_generated/component.js").ComponentApi<"staticHosting">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
