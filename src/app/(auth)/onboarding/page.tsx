"use client";

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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import Image from "next/image";
import { apiClient } from "@/lib/apiClient";
import { startPlannerJob } from "@/lib/plannerJob";

const onboardingSchema = z.object({
    goal: z.string().min(10, "Please describe your learning goal (at least 10 characters)"),
    skillLevel: z.enum(["beginner", "intermediate", "advanced"]),
    weeklyHours: z.number().min(1).max(40),
    pace: z.enum(["slow", "steady", "fast"]),
    deadline: z.string().optional(),
    preferredFormats: z.array(z.string()).min(1, "Select at least one format"),
});

type OnboardingFormData = z.infer<typeof onboardingSchema>;

/**
 * Convert the onboarding weeklyHours slider to a studyHoursOptions-compatible
 * string value.  We assume a 5-day week.
 */
function weeklyHoursToDaily(weeklyHours: number): string {
    const hpd = weeklyHours / 5;
    if (hpd <= 0.5)  return "30 minutes";
    if (hpd <= 0.75) return "45 minutes";
    if (hpd <= 1.25) return "1 hour";
    if (hpd <= 1.75) return "1 hour 30 minutes";
    if (hpd <= 2.5)  return "2 hours";
    if (hpd <= 3.5)  return "3 hours";
    return "4 hours";
}

/**
 * Derive a targetWeeks value (1–4) from the optional deadline date string
 * and the pace selection.  Clamped to the available studyWeeksOptions range.
 */
function deriveTargetWeeks(deadline: string | undefined, pace: string): number {
    if (deadline) {
        const deadlineDate = new Date(deadline);
        const now = new Date();
        const diffMs = deadlineDate.getTime() - now.getTime();
        const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
        return Math.min(4, Math.max(1, diffWeeks));
    }
    const paceMap: Record<string, number> = { slow: 4, steady: 3, fast: 2 };
    return paceMap[pace] ?? 3;
}

export default function OnboardingPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState("");
    const [error, setError] = useState<string | null>(null);

    const form = useForm<OnboardingFormData>({
        resolver: zodResolver(onboardingSchema),
        defaultValues: {
            goal: "",
            skillLevel: "beginner",
            weeklyHours: 5,
            pace: "steady",
            deadline: "",
            preferredFormats: [],
        },
    });

    const totalSteps = 6;

    const onSubmit = async (data: OnboardingFormData) => {
        setIsLoading(true);
        setError(null);

        try {
            // ── Step 1: Save user preferences ──────────────────────────────
            setLoadingMessage("Saving your preferences…");
            await apiClient.post("/onboarding", data);

            // ── Step 2: Create the goal from onboarding data ───────────────
            // The /goal page asks for the same information under different names.
            // We derive the goal-creation fields from the onboarding fields so
            // the user never has to enter their goal twice.
            setLoadingMessage("Creating your goal…");

            const hoursPerDay = weeklyHoursToDaily(data.weeklyHours);
            const targetWeeks = deriveTargetWeeks(data.deadline, data.pace);

            const goalResult = await apiClient.post<{ data: { id: string } }>("/goals", {
                title: data.goal,
                hoursPerDay,
                targetWeeks,
                // preferredTime omitted — backend defaults to tomorrow at 09:00 UTC
            });

            const goalId = goalResult?.data?.id;

            // ── Step 3: Generate the personalised learning plan ────────────
            // Plan generation runs a 4-stage AI pipeline (~20-40 seconds).
            if (goalId) {
                setLoadingMessage("Generating your personalised learning plan…");
                await startPlannerJob(goalId, setLoadingMessage);
            }

            router.push("/dashboard");
        } catch (err: any) {
            setError(err?.message || "Failed to complete onboarding");
            setIsLoading(false);
            setLoadingMessage("");
        }
    };

    const nextStep = () => {
        if (step < totalSteps) setStep(step + 1);
    };

    const prevStep = () => {
        if (step > 1) setStep(step - 1);
    };

    const toggleFormat = (format: string) => {
        const current = form.getValues("preferredFormats");
        if (current.includes(format)) {
            form.setValue(
                "preferredFormats",
                current.filter((f) => f !== format)
            );
        } else {
            form.setValue("preferredFormats", [...current, format]);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 to-black flex items-center justify-center px-4 py-8">
            <div className="w-full max-w-2xl bg-white/5 backdrop-blur-xl p-8 text-white border border-cyan-400/30 shadow-[0_0_40px_rgba(59,130,246,0.5)] rounded-3xl">
                <div className="flex justify-center mb-6">
                    <Image
                        src="/AI_coach_icon.png"
                        alt="LifePilot Logo"
                        width={64}
                        height={64}
                    />
                </div>

                <h1 className="text-3xl font-bold text-center mb-2 text-cyan-400">
                    Let's Personalize Your Journey
                </h1>
                <p className="text-sm text-center mb-8 text-slate-400">
                    Step {step} of {totalSteps}
                </p>

                {/* Progress bar */}
                <div className="mb-8">
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                            style={{ width: `${(step / totalSteps) * 100}%` }}
                        />
                    </div>
                </div>

                {error && (
                    <div className="mb-6 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm text-center">
                        {error}
                    </div>
                )}

                {/* Loading overlay — shown during the 3-step submit sequence */}
                {isLoading && (
                    <div className="mb-6 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-center space-y-3">
                        <div className="flex justify-center">
                            <svg className="animate-spin h-6 w-6 text-cyan-400" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                        </div>
                        <p className="text-sm text-cyan-300">{loadingMessage}</p>
                    </div>
                )}

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        {/* Hide all step content while the submit sequence is running */}
                        <div className={isLoading ? "hidden" : undefined}>
                        {/* Step 1: Learning Goal */}
                        {step === 1 && (
                            <FormField
                                control={form.control}
                                name="goal"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xl text-cyan-300">
                                            What do you want to learn?
                                        </FormLabel>
                                        <FormControl>
                                            <textarea
                                                {...field}
                                                rows={4}
                                                placeholder="e.g., I want to become proficient in full-stack web development with React and Node.js"
                                                className="w-full rounded-md border border-slate-600 bg-slate-800/50 px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                            />
                                        </FormControl>
                                        <FormDescription className="text-slate-400">
                                            Be specific about what you want to achieve
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        {/* Step 2: Skill Level */}
                        {step === 2 && (
                            <FormField
                                control={form.control}
                                name="skillLevel"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xl text-cyan-300">
                                            What's your current experience level?
                                        </FormLabel>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                                            {["beginner", "intermediate", "advanced"].map((level) => (
                                                <button
                                                    key={level}
                                                    type="button"
                                                    onClick={() => field.onChange(level)}
                                                    className={`p-4 rounded-lg border-2 transition-all ${field.value === level
                                                            ? "border-cyan-500 bg-cyan-500/20"
                                                            : "border-slate-600 bg-slate-800/50 hover:border-slate-500"
                                                        }`}
                                                >
                                                    <div className="text-lg font-semibold capitalize text-white">
                                                        {level}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        {/* Step 3: Weekly Hours */}
                        {step === 3 && (
                            <FormField
                                control={form.control}
                                name="weeklyHours"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xl text-cyan-300">
                                            How many hours per week can you dedicate?
                                        </FormLabel>
                                        <div className="space-y-4 mt-4">
                                            <div className="flex items-center justify-between">
                                                <span className="text-slate-300">Hours per week:</span>
                                                <span className="text-2xl font-bold text-cyan-400">
                                                    {field.value}
                                                </span>
                                            </div>
                                            <input
                                                type="range"
                                                min="1"
                                                max="40"
                                                value={field.value}
                                                onChange={(e) => field.onChange(parseInt(e.target.value))}
                                                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                            />
                                            <div className="flex justify-between text-xs text-slate-500">
                                                <span>1 hour</span>
                                                <span>40 hours</span>
                                            </div>
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        {/* Step 4: Learning Pace */}
                        {step === 4 && (
                            <FormField
                                control={form.control}
                                name="pace"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xl text-cyan-300">
                                            What's your preferred learning pace?
                                        </FormLabel>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                                            {[
                                                { value: "slow", label: "Slow & Steady", desc: "Take your time" },
                                                { value: "steady", label: "Balanced", desc: "Consistent progress" },
                                                { value: "fast", label: "Fast Track", desc: "Intensive learning" },
                                            ].map((option) => (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    onClick={() => field.onChange(option.value)}
                                                    className={`p-4 rounded-lg border-2 transition-all ${field.value === option.value
                                                            ? "border-cyan-500 bg-cyan-500/20"
                                                            : "border-slate-600 bg-slate-800/50 hover:border-slate-500"
                                                        }`}
                                                >
                                                    <div className="text-lg font-semibold text-white">
                                                        {option.label}
                                                    </div>
                                                    <div className="text-sm text-slate-400 mt-1">
                                                        {option.desc}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        {/* Step 5: Deadline (Optional) */}
                        {step === 5 && (
                            <FormField
                                control={form.control}
                                name="deadline"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xl text-cyan-300">
                                            Do you have a target deadline? (Optional)
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                type="date"
                                                {...field}
                                                className="bg-slate-800/50 border-slate-600 text-white"
                                            />
                                        </FormControl>
                                        <FormDescription className="text-slate-400">
                                            Leave blank if you don't have a specific deadline
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        {/* Step 6: Preferred Formats */}
                        {step === 6 && (
                            <FormField
                                control={form.control}
                                name="preferredFormats"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xl text-cyan-300">
                                            How do you prefer to learn?
                                        </FormLabel>
                                        <div className="grid grid-cols-2 gap-4 mt-4">
                                            {[
                                                { value: "video", label: "📹 Video Tutorials" },
                                                { value: "text", label: "📚 Reading & Articles" },
                                                { value: "projects", label: "🛠️ Hands-on Projects" },
                                                { value: "interactive", label: "💻 Interactive Coding" },
                                            ].map((format) => (
                                                <button
                                                    key={format.value}
                                                    type="button"
                                                    onClick={() => toggleFormat(format.value)}
                                                    className={`p-4 rounded-lg border-2 transition-all ${field.value.includes(format.value)
                                                            ? "border-cyan-500 bg-cyan-500/20"
                                                            : "border-slate-600 bg-slate-800/50 hover:border-slate-500"
                                                        }`}
                                                >
                                                    <div className="text-lg font-semibold text-white">
                                                        {format.label}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                        <FormDescription className="text-slate-400">
                                            Select all that apply
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        </div>{/* end isLoading hidden wrapper */}

                        {/* Navigation Buttons — always visible, disabled while loading */}
                        {!isLoading && <div className="flex justify-between pt-6">
                            {step > 1 && (
                                <Button
                                    type="button"
                                    onClick={prevStep}
                                    variant="outline"
                                    className="bg-slate-800 border-slate-600 text-white hover:bg-slate-700"
                                >
                                    Previous
                                </Button>
                            )}

                            {step < totalSteps ? (
                                <Button
                                    type="button"
                                    onClick={nextStep}
                                    className="ml-auto bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
                                >
                                    Next
                                </Button>
                            ) : (
                                <Button
                                    type="submit"
                                    disabled={isLoading}
                                    className="ml-auto bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
                                >
                                    {isLoading ? "Working…" : "Complete Setup & Generate Plan"}
                                </Button>
                            )}
                        </div>}
                    </form>
                </Form>
            </div>
        </div>
    );
}
