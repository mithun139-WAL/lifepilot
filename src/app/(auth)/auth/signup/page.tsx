"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
    FormDescription,
} from "@/components/ui/form";
import { getPasswordStrength } from "@/lib/password";
import { apiClient } from "@/lib/apiClient";

const signUpSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    password: z
        .string()
        .min(8, "Password must be at least 8 characters")
        .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
        .regex(/[a-z]/, "Password must contain at least one lowercase letter")
        .regex(/[0-9]/, "Password must contain at least one number")
        .regex(
            /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
            "Password must contain at least one special character"
        ),
});

type SignUpFormData = z.infer<typeof signUpSchema>;

export default function SignUpPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [passwordStrength, setPasswordStrength] = useState<{
        score: number;
        label: string;
        color: string;
    } | null>(null);

    const form = useForm<SignUpFormData>({
        resolver: zodResolver(signUpSchema),
        defaultValues: {
            name: "",
            email: "",
            password: "",
        },
    });

    const watchPassword = form.watch("password");

    // Update password strength as user types
    useState(() => {
        if (watchPassword) {
            setPasswordStrength(getPasswordStrength(watchPassword));
        } else {
            setPasswordStrength(null);
        }
    });

    const onSubmit = async (data: SignUpFormData) => {
        setIsLoading(true);
        setError(null);

        try {
            await apiClient.post("/auth/signup", data);
            setSuccess(true);
            setTimeout(() => {
                router.push("/auth/signin");
            }, 3000);
        } catch (err: any) {
            setError(err?.message || "Failed to create account");
        } finally {
            setIsLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 to-black flex items-center justify-center px-4">
                <div className="w-full max-w-md bg-white/5 backdrop-blur-xl p-8 text-white border border-cyan-400/30 shadow-[0_0_40px_rgba(59,130,246,0.5)] rounded-3xl text-center">
                    <div className="mb-6">
                        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg
                                className="w-10 h-10 text-green-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5 13l4 4L19 7"
                                />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-cyan-400 mb-2">
                            Account Created! 🎉
                        </h2>
                        <p className="text-slate-300 mb-4">
                            Please check your email to verify your account.
                        </p>
                        <p className="text-sm text-slate-400">
                            Redirecting to sign in...
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 to-black flex items-center justify-center px-4 py-8">
            <div className="w-full max-w-md bg-white/5 backdrop-blur-xl p-8 text-white border border-cyan-400/30 shadow-[0_0_40px_rgba(59,130,246,0.5)] rounded-3xl">
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
                    Join LifePilot
                </h1>
                <p className="text-sm text-center mb-6 text-slate-400">
                    Start your personalized learning journey
                </p>

                {error && (
                    <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm text-center">
                        {error}
                    </div>
                )}

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mb-6">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-slate-300">Name</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="text"
                                            placeholder="Your name"
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
                                            onChange={(e) => {
                                                field.onChange(e);
                                                setPasswordStrength(getPasswordStrength(e.target.value));
                                            }}
                                        />
                                    </FormControl>
                                    {passwordStrength && watchPassword && (
                                        <div className="mt-2">
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full transition-all duration-300"
                                                        style={{
                                                            width: `${(passwordStrength.score / 4) * 100}%`,
                                                            backgroundColor: passwordStrength.color,
                                                        }}
                                                    />
                                                </div>
                                                <span
                                                    className="text-xs font-medium"
                                                    style={{ color: passwordStrength.color }}
                                                >
                                                    {passwordStrength.label}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                    <FormDescription className="text-slate-500 text-xs">
                                        Must be 8+ characters with uppercase, lowercase, number, and special character
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold"
                        >
                            {isLoading ? "Creating account..." : "Create Account"}
                        </Button>
                    </form>
                </Form>

                <div className="mt-6 text-center text-sm text-slate-400">
                    Already have an account?{" "}
                    <Link
                        href="/auth/signin"
                        className="text-cyan-400 hover:text-cyan-300 font-semibold"
                    >
                        Sign In
                    </Link>
                </div>
            </div>
        </div>
    );
}
