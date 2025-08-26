import React from "react";
import "@fontsource/orbitron";
import { SmartSuggestion } from "@/components/dashboard/SmartSuggestion";
import { TodayTimeline } from "@/components/dashboard/TodayTimeline";
// import { HabitStats } from "@/components/dashboard/HabitStats";
import { MoodInsight } from "@/components/dashboard/MoodInSight";
import { StreakAchievements } from "@/components/dashboard/StreakAcheivements";
// import { LifeScoreCard } from "@/components/dashboard/LifeScoreCard";
// import { JournalPreview } from "@/components/dashboard/JournalPreview";
import { FocusPanel } from "@/components/dashboard/FocusPanel";
// import { UpcomingReminders } from "@/components/dashboard/UpcomingReminders";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const DashboardPage = async () => {
  const session = await getServerSession(authOptions);
  const user = session?.user;

  const getName = () => {
    return user?.name ? user.name : "User";
  };

  return (
    <div className="flex flex-col h-full min-h-0 m-0 p-0">
      <div className="flex-shrink-0 px-4 pb-3">
        <h2 className="font-bold text-white text-4xl">
          Welcome, {getName()} 👋
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 py-4">
        <div className="flex-shrink-0 mb-3 px-2">
          <SmartSuggestion />
        </div>
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 overflow-y-auto px-2">
          {/* <HabitStats /> */}
          <MoodInsight />
          <StreakAchievements />
          {/* <LifeScoreCard /> */}
          {/* <JournalPreview /> */}
          <FocusPanel />
          {/* <UpcomingReminders /> */}
        </div>
        <div className="px-2 mt-3">
          <TodayTimeline />
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
