"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { apiClient } from "@/lib/apiClient";

type State = "verifying" | "success" | "error";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [state, setState] = useState<State>("verifying");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setState("error");
      setMessage("No verification token found in the link. Please request a new one.");
      return;
    }

    apiClient
      .post<{ message: string }>("/auth/verify-email", { token })
      .then((data) => {
        setState("success");
        setMessage(data.message ?? "Email verified successfully. You can now sign in.");
      })
      .catch((err: Error) => {
        setState("error");
        setMessage(err.message ?? "Verification failed. The link may have expired.");
      });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="w-full max-w-md p-8 rounded-2xl border border-white/10 bg-white/5 text-center space-y-6">
        {state === "verifying" && (
          <>
            <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto" />
            <p className="text-white/60">Verifying your email…</p>
          </>
        )}

        {state === "success" && (
          <>
            <div className="text-4xl">✓</div>
            <h1 className="text-xl font-semibold text-white">Email verified</h1>
            <p className="text-white/60">{message}</p>
            <button
              onClick={() => router.push("/auth/signin")}
              className="w-full py-2.5 rounded-lg bg-white text-black font-medium hover:bg-white/90 transition"
            >
              Sign in
            </button>
          </>
        )}

        {state === "error" && (
          <>
            <div className="text-4xl">✗</div>
            <h1 className="text-xl font-semibold text-white">Verification failed</h1>
            <p className="text-white/60">{message}</p>
            <button
              onClick={() => router.push("/auth/signin")}
              className="w-full py-2.5 rounded-lg bg-white/10 text-white font-medium hover:bg-white/20 transition"
            >
              Back to sign in
            </button>
          </>
        )}
      </div>
    </div>
  );
}
