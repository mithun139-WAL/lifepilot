"use client";
import EditGoalPopup from "./EditGoalPopup";

export default function GeneratePlan({
  goalId,
  modal,
  setModal,
  setSelectedGoal,
  goalTitle,
  loading = false,
  handleGeneratePlan,
}: {
  goalId: string;
  modal: "none" | "confirm" | "edit" | "generatePlan";
  setModal: (modal: "none" | "confirm" | "edit" | "generatePlan") => void;
  setSelectedGoal: (goalId: string) => void;
  goalTitle?: string;
  loading?: boolean;
  handleGeneratePlan?: () => void;
}) {
  return (
    <>
      {modal === "confirm" && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 relative">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedGoal("")}
                className="px-4 py-2 rounded-lg border hover:bg-gray-100 text-gray-500"
              >
                x
              </button>
            </div>
            <p className="text-lg font-semibold mb-4 text-gray-800">
              Do you want to continue with the existing goal or edit the goal?
            </p>
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={handleGeneratePlan}
                className="px-4 py-2 rounded-lg border hover:bg-gray-100 text-gray-500"
                disabled={loading}
              >
                {loading ? "Generating..." : "Continue with existing goal"}
              </button>
              <button
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg shadow"
                onClick={() => {
                  setTimeout(() => setModal("edit"), 0);
                }}
              >
                Edit the Goal
              </button>
            </div>
          </div>
        </div>
      )}
      {modal === "edit" && (
        <EditGoalPopup goalId={goalId} setModal={setModal} modal={modal} />
      )}
      {modal === "generatePlan" && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 relative">
            <h1 className="text-2xl font-bold text-center mb-6 capitalize text-gray-500">
              {goalTitle || "Your Goal"}
            </h1>
            <button
              type="button"
              onClick={handleGeneratePlan}
              disabled={loading}
              className="w-full bg-green-600 py-2 rounded-md hover:bg-green-700 transition disabled:opacity-50 mt-2"
            >
              {loading ? "Generating..." : "Generate Plan"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
