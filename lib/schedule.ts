/** Schedule generation using Zipf's Law (power law distribution) */

import { formatDate, getDateRange } from "./dates.ts";
import type { CommitSchedule } from "./types.ts";

// Named constants for Zipf distribution parameters
const ZIPF_ALPHA_MIN = 0.9;
const ZIPF_ALPHA_VARIANCE = 0.2;
const PEAK_DAY_THRESHOLD = 30;

// Density presets: [min coverage, variance]
export type Density = "sparse" | "normal" | "dense";
const DENSITY_PRESETS: Record<Density, [number, number]> = {
  sparse: [0.20, 0.10], // 20-30% of days
  normal: [0.35, 0.10], // 35-45% of days
  dense: [0.55, 0.10], // 55-65% of days
};

/** Pick a random unused day from the available days */
function pickRandomUnusedDay(allDays: Date[], usedDays: Set<string>): string {
  const available = allDays.filter((d) => !usedDays.has(formatDate(d)));
  if (available.length === 0) {
    throw new Error("No available days left");
  }
  const day = available[Math.floor(Math.random() * available.length)];
  return formatDate(day);
}

/** Generate commit schedule using Zipf's Law (power law distribution) */
export function generateRealisticSchedule(
  startDate: Date,
  endDate: Date,
  targetCommits: number,
  maxPerDay: number = 175,
  density: Density = "normal",
): { schedule: CommitSchedule; peakDays: Map<string, number> } {
  const allDays = getDateRange(startDate, endDate);
  const schedule: CommitSchedule = new Map();
  const peakDays = new Map<string, number>();
  const usedDays = new Set<string>();

  // Zipf's Law: commits(rank) = C / rank^α
  const alpha = ZIPF_ALPHA_MIN + Math.random() * ZIPF_ALPHA_VARIANCE;
  const [coverageMin, coverageVariance] = DENSITY_PRESETS[density];
  const coveragePercent = coverageMin + Math.random() * coverageVariance;
  const activeDayCount = Math.floor(allDays.length * coveragePercent);

  // Calculate generalized harmonic sum: H = Σ(1/rank^α)
  let harmonicSum = 0;
  for (let rank = 1; rank <= activeDayCount; rank++) {
    harmonicSum += 1 / Math.pow(rank, alpha);
  }

  // Solve for C: targetCommits = C × harmonicSum
  const C = targetCommits / harmonicSum;

  // Generate commit counts for each rank using Zipf distribution
  const commitCounts: number[] = [];
  let totalAllocated = 0;

  for (let rank = 1; rank <= activeDayCount; rank++) {
    let commits = Math.round(C / Math.pow(rank, alpha));
    // Cap at maxPerDay, ensure at least 1
    commits = Math.min(commits, maxPerDay);
    commits = Math.max(commits, 1);
    commitCounts.push(commits);
    totalAllocated += commits;
  }

  // Adjust for rounding errors - add/subtract from random days
  let diff = targetCommits - totalAllocated;
  while (diff !== 0) {
    const idx = Math.floor(Math.random() * commitCounts.length);
    if (diff > 0) {
      commitCounts[idx]++;
      diff--;
    } else if (commitCounts[idx] > 1) {
      commitCounts[idx]--;
      diff++;
    }
  }

  // Assign commit counts to random days
  for (let i = 0; i < commitCounts.length; i++) {
    const day = pickRandomUnusedDay(allDays, usedDays);
    const commits = commitCounts[i];
    schedule.set(day, commits);
    usedDays.add(day);

    // Mark as peak day if exceeds threshold
    if (commits > PEAK_DAY_THRESHOLD) {
      peakDays.set(day, commits);
    }
  }

  return { schedule, peakDays };
}
