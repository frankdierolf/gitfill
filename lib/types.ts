/** Commit schedule mapping dates to commit counts */
export type CommitSchedule = Map<string, number>;

/** Visualization data combining fake and real commits */
export interface VisualizationData {
  fake: Record<string, number>;
  real: Record<string, number>;
  startDate: string;
  endDate: string;
  density: "sparse" | "normal" | "dense";
  stats: {
    totalFake: number;
    totalReal: number;
    fakeDays: number;
    realDays: number;
    peakDays: number;
  };
}

/** Default configuration values */
export const DEFAULT_CONFIG = {
  messages: ["update", "fix", "wip", "chore", "tweak"],
};
