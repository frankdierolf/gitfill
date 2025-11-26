/** GitLab platform - fetch contributions via public calendar.json endpoint */

import { filterByDateRange } from "../dates.ts";

/** Fetch GitLab contributions from calendar.json (no auth required) */
export async function getGitLabContributions(
  username: string,
  from: string,
  to: string,
  host = "gitlab.com",
): Promise<Record<string, number>> {
  const result: Record<string, number> = {};

  try {
    const url = `https://${host}/users/${username}/calendar.json`;
    const response = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "gitfill",
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch GitLab contributions: ${response.status}`);
      return result;
    }

    // Response format: {"YYYY-MM-DD": count, ...}
    const data: Record<string, number> = await response.json();
    return filterByDateRange(data, from, to);
  } catch (error) {
    console.error("Failed to fetch GitLab contributions:", error);
  }

  return result;
}

/** Get GitLab user creation date via public API */
export async function getGitLabUserCreatedAt(
  username: string,
  host = "gitlab.com",
): Promise<string | null> {
  try {
    const response = await fetch(
      `https://${host}/api/v4/users?username=${username}`,
      {
        headers: {
          "Accept": "application/json",
          "User-Agent": "gitfill",
        },
      },
    );

    if (!response.ok) {
      console.error(`Failed to fetch GitLab user info: ${response.status}`);
      return null;
    }

    const users = await response.json();
    if (users.length === 0) return null;

    // created_at format: "2020-01-15T12:00:00.000Z"
    return users[0].created_at?.split("T")[0] ?? null;
  } catch (error) {
    console.error("Failed to fetch GitLab user info:", error);
    return null;
  }
}

/** Parse GitLab username and host from a git remote URL */
export function parseGitLabRemote(
  remoteUrl: string,
): { username: string; host: string } | null {
  // Handle HTTPS: https://gitlab.com/username/repo.git
  // Handle SSH: git@gitlab.com:username/repo.git
  // Handle self-hosted: https://gitlab.mycompany.com/username/repo.git

  const httpsMatch = remoteUrl.match(/https?:\/\/([^/]+)\/([^/]+)/);
  if (httpsMatch && httpsMatch[1].includes("gitlab")) {
    return { host: httpsMatch[1], username: httpsMatch[2] };
  }

  const sshMatch = remoteUrl.match(/git@([^:]+):([^/]+)/);
  if (sshMatch && sshMatch[1].includes("gitlab")) {
    return { host: sshMatch[1], username: sshMatch[2] };
  }

  return null;
}
