import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import CustomSelect from "./CustomSelect";
import { DateTimePickerForm } from "../ui/date-time-picker";
import {
  studyHoursOptions,
  studyWeeksOptions,
} from "@/lib/constants/constants";

interface EditGoalPopupProps {
  goalId: string;
  setModal: (modal: "edit" | "generatePlan" | "none" | "confirm") => void;
  modal: "edit" | "generatePlan" | "none" | "confirm";
}

export default function EditGoalPopup({ goalId, setModal, modal }: EditGoalPopupProps) {
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [hoursPerDay, setHoursPerDay] = useState("");
  const [targetWeeks, setTargetWeeks] = useState("");
  const [preferredTime, setPreferredTime] = useState("");

  const handleHoursPerDayChange = (val: string) => setHoursPerDay(val);
  const handleTargetWeeksChange = (val: string) => setTargetWeeks(val);

  useEffect(() => {
    const fetchGoal = async () => {
      const res = await fetch(`/api/goals/${goalId}`);
      const data = await res.json();
      const goalData = data?.data || {};
      setTitle(goalData.title || "");
      setHoursPerDay(goalData.hoursPerDay || "");
      setTargetWeeks(goalData.targetWeeks || "");
      setPreferredTime(goalData.preferredTime || "");
    };
    if (goalId) fetchGoal();
  }, [goalId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`/api/goals/${goalId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        hoursPerDay,
        targetWeeks,
        preferredTime,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (data?.success) {
      setModal("generatePlan")
    }
    } catch(error: unknown) {
        setLoading(false);
        console.error(error);
    }
  };

  return (
    <>
      {modal === "edit" && (
        <div className="px-2 mb-2">
          <Dialog open={true} onOpenChange={(val) => {
              if (!val) setModal("none");
            }}>
            <DialogContent
              className="bg-slate-900 text-white border border-slate-700 rounded-xl p-6"
              onEscapeKeyDown={(e) => e.preventDefault()}
              onPointerDownOutside={(e) => e.preventDefault()}
              onInteractOutside={(e) => e.preventDefault()}
            >
              {goalId && (
                <DialogHeader>
                  <DialogTitle>Edit Goal</DialogTitle>
                </DialogHeader>
              )}
              <form onSubmit={handleSubmit} className="space-y-4 mt-3">
                <div className="flex flex-col justify-between h-120">
                  <div>
                    <label className="block font-medium text-sm mb-2">
                      What’s Your Goal?
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Learn Spanish"
                      className="w-full bg-transparent text-white outline-none placeholder:text-slate-400 border border-blue-500/30 rounded-xl px-4 py-3 cursor-not-allowed"
                      disabled={true}
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-sm mb-2">
                      Duration
                    </label>
                    <CustomSelect
                      value={targetWeeks}
                      onChange={handleTargetWeeksChange}
                      options={studyWeeksOptions}
                      placeholder="Select duration (in weeks)"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-sm mb-2">
                      How many hours you can spend?
                    </label>
                    <CustomSelect
                      value={hoursPerDay}
                      onChange={handleHoursPerDayChange}
                      options={studyHoursOptions}
                      placeholder="Select study duration"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-sm mb-2">
                      Preferred Start Time
                    </label>
                    <DateTimePickerForm
                      value={preferredTime || null}
                      onChange={(val) => setPreferredTime(val)}
                    />
                    <p className="text-xs text-zinc-400 text-right mt-1">
                      Enter time when you want to start in a day
                    </p>
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 cursor-pointer"
                    disabled={loading}
                  >
                    {loading ? "Saving..." : "Save Goal"}
                  </button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </>
  );
}