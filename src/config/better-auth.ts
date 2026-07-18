import { betterAuth } from "better-auth";
import { jwt } from "better-auth/plugins";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { db } from "./db";
import { Db, ObjectId } from "mongodb";

/**
 * Configure Better Auth with Google OAuth
 * Role system: job_seeker (default) | admin (set manually in DB)
 */
export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET as string,
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:8000/api/v1/auth",
  trustedOrigins: [
    process.env.FRONTEND_ORIGIN || "http://localhost:3000",
    "http://localhost:3000",
  ],
  advanced: {
    defaultCookieAttributes: {
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      secure: process.env.NODE_ENV === "production",
    }
  },
  database: mongodbAdapter(db as unknown as Db, {
    usePlural: true,
  }),
  // Hook: after every new user is created, stamp role = 'job_seeker'
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          try {
            await (db as unknown as Db)
              .collection("users")
              .updateOne(
                { _id: new ObjectId(user.id) },
                { $set: { role: "job_seeker" } }
              );
          } catch (e) {
            console.error("Failed to set default role:", e);
          }
        },
      },
    },
  },
  plugins: [jwt()],
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    }
  },
  emailAndPassword: {
    enabled: true,
  }
});
