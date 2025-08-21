"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

export default function SignInPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  const handleSignIn = async (provider: string) => {
    setLoadingProvider(provider);
    await signIn(provider, { callbackUrl: "/dashboard" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 to-black flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-6 text-white shadow-[0_0_20px_#3B82F6]/20">
        <h1 className="text-2xl font-bold text-center mb-6">Welcome to Personal AI Coach</h1>
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
            {loadingProvider === "google" ? "Signing in..." : "Sign in with Google"}
          </button>
        </div>
      </div>
    </div>
  );
}