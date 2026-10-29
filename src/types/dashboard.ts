/**
 * src/types/dashboard.ts
 *
 * Shared types for the /dashboard/stats endpoint response.
 * All four dashboard widgets (HabitStats, JournalPreview, LifeScoreCard,
 * UpcomingReminders) hit the same endpoint and need the same shape.
 */

export interface DashboardHabit {
  name: string;
  done: boolean;
}

export interface DashboardMood {
  mood: string;
  createdAt: string;
}

export interface DashboardTask {
  title: string;
  dueDate: string;
}

export interface DashboardStatsData {
  habits?:       DashboardHabit[];
  recentMood?:   DashboardMood;
  lifeScore?:    number;
  upcomingTasks?: DashboardTask[];
}

/** Shape returned by GET /dashboard/stats */
export interface DashboardStatsResponse {
  data?: DashboardStatsData;
}

/** Shape returned by GET /suggestions */
export interface SuggestionsResponse {
  data?: Array<{ text: string; emoji: string }>;
}
