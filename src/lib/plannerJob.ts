/**
 * src/lib/plannerJob.ts
 *
 * Drop-in replacement for `apiClient.post("/planner", { goalId })`.
 *
 * WHY THIS EXISTS:
 *   The plan generation pipeline now runs as a background job on the server.
 *   POST /planner returns a jobId immediately (HTTP 202) instead of blocking
 *   for 15 minutes — which was causing "Failed to fetch" errors when the
 *   OS or proxy closed the long-lived idle connection.
 *
 * HOW IT WORKS:
 *   1. POST /planner        → { jobId }  (returns in <100ms)
 *   2. Poll GET /planner/jobs/{jobId} every 3s
 *   3. Resolve when status === "done", reject on "failed" or timeout
 *
 * USAGE (replaces all direct `apiClient.post("/planner", ...)` calls):
 *
 *   import { startPlannerJob } from "@/lib/plannerJob";
 *
 *   await startPlannerJob(goalId);                   // minimal
 *   await startPlannerJob(goalId, setLoadingMessage); // with progress text
 */

import { apiClient } from "./apiClient";

interface PlannerJobStatus {
  jobId: string;
  status: "processing" | "done" | "failed";
  result?: {
    savedPlan?: { id: string; topic: string };
    roadmap?: unknown;
    tasks?: unknown[];
    habits?: unknown;
  };
  error?: string;
}

/** How often to poll (ms) */
const POLL_INTERVAL_MS = 3_000;

/** Maximum number of poll attempts before giving up (200 × 3s = 10 min) */
const MAX_POLLS = 200;

/** Progress messages shown to the user at approximate pipeline stages */
const STAGE_MESSAGES: [number, string][] = [
  [0,  "Generating your personalised learning plan…"],
  [5,  "Interpreting your goal…"],
  [12, "Building your week-by-week roadmap…"],
  [22, "Creating weekly tasks and checklists…"],
  [38, "Finalising habits and wrapping up…"],
];

/**
 * Start a plan generation job and poll until complete.
 *
 * @param goalId        - The goal ID to generate a plan for.
 * @param onStatus      - Optional callback; called with human-readable
 *                        progress messages throughout the process.
 * @returns             - Resolves with the job result when done.
 * @throws              - If the job fails or times out.
 */
export async function startPlannerJob(
  goalId: string,
  onStatus?: (message: string) => void,
): Promise<PlannerJobStatus["result"]> {
  onStatus?.("Queuing plan generation…");

  // 1. Start the background job — server responds in <100ms
  const start = await apiClient.post<{ jobId: string }>("/planner", { goalId });
  const jobId = start.jobId;

  if (!jobId) {
    throw new Error("Server did not return a job ID. Please try again.");
  }

  // 2. Poll until done or failed
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    const job = await apiClient.get<PlannerJobStatus>(`/planner/jobs/${jobId}`);

    if (job.status === "done") {
      onStatus?.("Plan ready!");
      return job.result;
    }

    if (job.status === "failed") {
      throw new Error(job.error ?? "Plan generation failed. Please try again.");
    }

    // Still "processing" — emit a stage message if we hit a milestone poll
    const stageMsg = STAGE_MESSAGES.findLast(([threshold]) => i >= threshold);
    if (stageMsg) onStatus?.(stageMsg[1]);
  }

  throw new Error(
    "Plan generation is taking longer than expected. Your plan will be ready in the Planner once complete.",
  );
}
