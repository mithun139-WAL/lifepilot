import { PrismaAdapter } from "@auth/prisma-adapter";
import { type NextAuthOptions, DefaultSession } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import { db } from "@/lib/db";
import axios from "axios";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  session: {
    strategy: "jwt",
  },
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/calendar.events",
            access_type: "offline",
            prompt: "consent",
        },
      },
    }),
  ],
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    async jwt({ token, account }) {
      // On initial sign in
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
        return token;
      }

      // If token is still valid, return it
      if (token.expiresAt && Date.now() < token.expiresAt * 1000) {
        return token;
      }

      // If token expired, try to refresh
      if (token.refreshToken) {
        try {
          const params = new URLSearchParams();
          params.append("client_id", process.env.GOOGLE_CLIENT_ID!);
          params.append("client_secret", process.env.GOOGLE_CLIENT_SECRET!);
          params.append("grant_type", "refresh_token");
          params.append("refresh_token", token.refreshToken);

          const response = await axios.post(
            "https://oauth2.googleapis.com/token",
            params,
            { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
          );
          const refreshed = response.data;
          token.accessToken = refreshed.access_token;
          token.expiresAt = Math.floor(Date.now() / 1000) + refreshed.expires_in;
          // Only update refreshToken if Google returns a new one
          if (refreshed.refresh_token) {
            token.refreshToken = refreshed.refresh_token;
          }
        } catch (error) {
          console.error("Error refreshing Google access token", error);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.sub && session?.user) {
        session.user.id = token.sub;
      }
      session.accessToken = token.accessToken;
      session.refreshToken = token.refreshToken;
      session.expiresAt = token.expiresAt;

      return session;
    },
  },
  logger: {
    error(code, metadata) {
      console.error("AUTH ERROR:", code, metadata);
    },
  },
};