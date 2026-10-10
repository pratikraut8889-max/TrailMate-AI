export type ActivityType =
  | "nature-walk"
  | "walking"
  | "running"
  | "explore"
  | "mindfulness";

export type MoodType = "relax" | "explore" | "challenge";

export interface Mission {
  id: string;
  title: string;
  description: string;
  duration: number;
}

export interface Adventure {
  title: string;
  description: string;
  duration: number;
  difficulty: "easy" | "medium" | "hard";
  missions: Mission[];
}