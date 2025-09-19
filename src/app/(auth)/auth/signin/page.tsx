"use client";

import { signIn } from "next-auth/react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function SignInForm() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  const handleSignIn = async (provider: string) => {
    setLoadingProvider(provider);
    await signIn(provider, { callbackUrl: "/dashboard" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 to-black flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white/5  backdrop-blur-xl p-6 text-white border border-cyan-400/30 shadow-[0_0_40px_#3B82F6]/50 rounded-3xl">
        <Image
          src={"/AI_coach_icon.png"}
          alt="Logo"
          width={84}
          height={84}
          className="mx-auto"
        />
        <h1 className="text-2xl font-bold text-center mb-6 text-cyan-400">
          Welcome to Personal AI Coach
        </h1>
        <p className="text-sm text-center mb-4 text-slate-400">
          Sign in to continue
        </p>

        {error && (
          <div className="text-red-400 text-sm text-center mb-4">
            {error === "OAuthAccountNotLinked"
              ? "Account already exists with a different sign-in method."
              : "Failed to sign in."}
          </div>
        )}

        <div className="space-y-3">
          {/* <button
            onClick={() => handleSignIn("github")}
            disabled={loadingProvider !== null}
            className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-600 px-4 py-2 rounded-md text-white transition"
          >
            {loadingProvider === "github" ? "Signing in..." : "Sign in with GitHub"}
          </button> */}

          <button
            onClick={() => handleSignIn("google")}
            disabled={loadingProvider !== null}
            className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-600 px-4 py-2 rounded-md text-white transition"
          >
            {loadingProvider === "google"
              ? "Signing in..."
              : "Sign in with Google"}
          </button>
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