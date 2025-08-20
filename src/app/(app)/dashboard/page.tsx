import React from "react";
import "@fontsource/orbitron";
import { SmartSuggestion } from "@/components/dashboard/SmartSuggestion";
import { TodayTimeline } from "@/components/dashboard/TodayTimeline";
import { HabitStats } from "@/components/dashboard/HabitStats";
import { MoodInsight } from "@/components/dashboard/MoodInSight";
import { StreakAchievements } from "@/components/dashboard/StreakAcheivements";
import { LifeScoreCard } from "@/components/dashboard/LifeScoreCard";
import { JournalPreview } from "@/components/dashboard/JournalPreview";
import { FocusPanel } from "@/components/dashboard/FocusPanel";
import { UpcomingReminders } from "@/components/dashboard/UpcomingReminders";

const DashboardPage = () => {
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-shrink-0">
        <SmartSuggestion />
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 py-4">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 overflow-y-auto">
          <TodayTimeline />
          <HabitStats />
          <MoodInsight />
          <StreakAchievements />
          <LifeScoreCard />
          <JournalPreview />
          <FocusPanel />
          <UpcomingReminders />
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
