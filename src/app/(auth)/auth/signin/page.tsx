"use client";

/**
 * src/app/(auth)/auth/signin/page.tsx
 *
 * WHY THIS CHANGED:
 * Previously we called next-auth's signIn("credentials", ...) which:
 * 1. POSTed to Next.js /api/auth/callback/credentials
 * 2. Next.js verified the password via the authorize() adapter
 * 3. next-auth set an encrypted HttpOnly session cookie
 *
 * Now we call FastAPI directly:
 * 1. POST /auth/login → get { access_token, refresh_token }
 * 2. GET  /auth/me   → get user profile (check onboarding_complete)
 * 3. Store tokens via tokenStore.setTokens() (localStorage + plain cookie)
 * 4. Redirect based on onboarding_complete
 *
 * Google OAuth is removed — FastAPI has no OAuth2 endpoint yet.
 * TODO: re-add Google sign-in once FastAPI OAuth2 flow is implemented.
 */

import Image from "next/image";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { apiClient } from "@/lib/apiClient";
import { setTokens } from "@/lib/tokenStore";

const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type SignInFormData = z.infer<typeof signInSchema>;

function SignInForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const error = searchParams.get("error");
  const verified = searchParams.get("verified");
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: SignInFormData) => {
    setIsLoading(true);
    setFormError(null);

    try {
      // Step 1: Exchange credentials for JWT tokens
      const loginResult = await apiClient.post<{
        access_token: string;
        refresh_token: string;
      }>("/auth/login", {
        email: data.email,
        password: data.password,
      });

      // Step 2: Persist tokens so apiClient auto-injects them from here on
      setTokens(loginResult.access_token, loginResult.refresh_token);

      // Step 3: Fetch user profile to decide where to redirect
      const meResult = await apiClient.get<{ user: { onboarding_complete: boolean } }>(
        "/auth/me",
        { token: loginResult.access_token }
      );

      // Step 4: Redirect based on onboarding status
      if (!meResult.user.onboarding_complete) {
        router.push("/onboarding");
      } else {
        // Honor the callbackUrl if it's a safe relative path, otherwise default
        const safe =
          callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")
            ? callbackUrl
            : "/dashboard";
        router.push(safe);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An error occurred. Please try again.";
      setFormError(message.includes("422") ? "Invalid email or password" : message);
    } finally {
      setIsLoading(false);
    }
  };

  const getErrorMessage = () => {
    if (formError) return formError;
    if (error === "OAuthAccountNotLinked") {
      return "Account already exists with a different sign-in method.";
    }
    if (error === "InvalidToken") {
      return "Invalid or expired verification link.";
    }
    if (error === "TokenExpired") {
      return "Verification link has expired. Please request a new one.";
    }
    if (error === "VerificationFailed") {
      return "Email verification failed. Please try again.";
    }
    if (error) {
      return "Failed to sign in.";
    }
    return null;
  };

  const errorMessage = getErrorMessage();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 to-black dark:from-slate-950 dark:to-black flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white/5 dark:bg-white/5 backdrop-blur-xl p-8 text-white border border-cyan-400/30 shadow-[0_0_40px_rgba(59,130,246,0.5)] rounded-3xl">
        <div className="flex justify-center mb-6">
          <Image
            src="/AI_coach_icon.png"
            alt="LifePilot Logo"
            width={84}
            height={84}
            className="mx-auto"
          />
        </div>

        <h1 className="text-3xl font-bold text-center mb-2 text-cyan-400">
          Welcome to LifePilot
        </h1>
        <p className="text-sm text-center mb-6 text-slate-400">
          Sign in to continue your learning journey
        </p>

        {verified && (
          <div className="mb-4 p-3 bg-green-500/20 border border-green-500/50 rounded-lg text-green-300 text-sm text-center">
            Email verified successfully! You can now sign in.
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm text-center">
            {errorMessage}
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mb-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-300">Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="your@email.com"
                      {...field}
                      disabled={isLoading}
                      className="bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-300">Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      {...field}
                      disabled={isLoading}
                      className="bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold"
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </Form>

        <div className="mt-6 text-center text-sm text-slate-400">
          Don&apos;t have an account?{" "}
          <Link
            href="/auth/signup"
            className="text-cyan-400 hover:text-cyan-300 font-semibold"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
