export default {
  providers: [
    {
      // The deployment's own Convex site URL issues + verifies the auth JWTs.
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
