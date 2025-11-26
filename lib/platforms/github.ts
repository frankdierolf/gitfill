/** GitHub platform - fetch contributions and user info via public APIs */

import { filterByDateRange } from "../dates.ts";

interface ContributionDay {
  date: string;
  count: number;
  level: number;
}

interface ContributionsResponse {
  total: Record<string, number>;
  contributions: ContributionDay[];
}

/** Fetch GitHub contributions using grubersjoe's public API */
export async function getGitHubContributions(
  username: string,
  from: string,
  to: string,
): Promise<Record<string, number>> {
  const result: Record<string, number> = {};

  try {
    // Use grubersjoe's API which provides exact counts (no auth required)
    const url = `https://github-contributions-api.jogruber.de/v4/${username}`;
    const response = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "gitfill",
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch contributions: ${response.status}`);
      return result;
    }

    const data: ContributionsResponse = await response.json();

    // Convert to Record and filter by date range
    const contributions: Record<string, number> = {};
    for (const day of data.contributions) {
      if (day.count > 0) {
        contributions[day.date] = day.count;
      }
    }
    return filterByDateRange(contributions, from, to);
  } catch (error) {
    console.error("Failed to fetch GitHub contributions:", error);
  }

  return result;
}

/** Get GitHub user info via public REST API */
export async function getGitHubUserCreatedAt(
  username: string,
): Promise<string | null> {
  try {
    const response = await fetch(`https://api.github.com/users/${username}`, {
      headers: {
        "Accept": "application/vnd.github+json",
        "User-Agent": "gitfill",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch user info: ${response.status}`);
      return null;
    }

    const data = await response.json();
    // created_at format: "2025-04-12T06:36:39Z"
    return data.created_at?.split("T")[0] ?? null;
  } catch (error) {
    console.error("Failed to fetch GitHub user info:", error);
    return null;
  }
}

/** Parse GitHub username from a git remote URL */
export function parseGitHubUsername(remoteUrl: string): string | null {
  // Handle HTTPS: https://github.com/username/repo.git
  // Handle SSH: git@github.com:username/repo.git
  const httpsMatch = remoteUrl.match(/github\.com\/([^/]+)/);
  if (httpsMatch) return httpsMatch[1];

  const sshMatch = remoteUrl.match(/github\.com:([^/]+)/);
  if (sshMatch) return sshMatch[1];

  return null;
}
