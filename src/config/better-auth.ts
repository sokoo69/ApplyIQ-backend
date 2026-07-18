import { betterAuth } from "better-auth";
import { jwt } from "better-auth/plugins";

/**
 * Configure Better Auth with Google OAuth
 * Note: Since we are using standard Mongoose for our custom routes (Register/Login), 
 * BetterAuth handles the Google OAuth flow here.
 */
export const auth = betterAuth({
  // Configure JWT plugin
  plugins: [
    jwt({
      jwt: {
        secret: process.env.JWT_SECRET as string,
        expiresIn: "7d"
      }
    })
  ],
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    }
  },
  // In a full implementation, you'd configure the database adapter here 
  // to sync Better Auth users with the MongoDB database. 
});
