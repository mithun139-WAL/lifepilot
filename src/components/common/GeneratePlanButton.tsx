"use client";

import { useState } from "react";

export default function GeneratePlanButton({ goalId }: { goalId: string }) {
  const [loading, setLoading] = useState(false);

  const handleGeneratePlan = async () => {
    setLoading(true);
    console.log("➡️ Triggering plan generation for goal ID:", goalId);
    if (!goalId) return;
    try {
      const res = await fetch(`/api/planner`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalId }),
      });
      if (!res.ok) {
        console.error("Planner API error", res.statusText);
        setLoading(false);
        return;
      }

      if (res.ok) {
        console.log("Plan generated successfully");
        window.location.href = "/dashboard";
      } else {
        console.error("Planner API error", res.statusText);
      }
    } catch (err) {
      console.error("Failed to generate plan:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleGeneratePlan}
      disabled={loading}
      className="px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
    >
      {loading ? "Generating..." : "Generate Plan"}
    </button>
  );
}