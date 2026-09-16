import { convexAuth } from "@convex-dev/auth/server";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";

// Anonymous auth: every visitor gets an identity with no sign-up, so the app has
// a real per-owner identity (owner-scoping) while judges can still open the live
// URL without an account. The client signs in anonymously on load.
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Anonymous],
});
