/** Gitea platform - fetch contributions via public heatmap API */

interface HeatmapEntry {
  timestamp: number;
  contributions: number;
}

/** Convert Unix timestamp to YYYY-MM-DD date string */
function timestampToDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toISOString().split("T")[0];
}

/** Fetch Gitea contributions from heatmap API (no auth required) */
export async function getGiteaContributions(
  username: string,
  from: string,
  to: string,
  host = "gitea.com",
): Promise<Record<string, number>> {
  const result: Record<string, number> = {};

  try {
    const url = `https://${host}/api/v1/users/${username}/heatmap`;
    const response = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "gitfill",
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch Gitea contributions: ${response.status}`);
      return result;
    }

    // Response format: [{timestamp, contributions}, ...]
    const data: HeatmapEntry[] = await response.json();

    // Aggregate by day and filter within date range
    const fromDate = new Date(from);
    const toDate = new Date(to);

    for (const entry of data) {
      const dateStr = timestampToDate(entry.timestamp);
      const date = new Date(dateStr);

      if (date >= fromDate && date <= toDate && entry.contributions > 0) {
        result[dateStr] = (result[dateStr] || 0) + entry.contributions;
      }
    }
  } catch (error) {
    console.error("Failed to fetch Gitea contributions:", error);
  }

  return result;
}

/** Get Gitea user creation date via public API */
export async function getGiteaUserCreatedAt(
  username: string,
  host = "gitea.com",
): Promise<string | null> {
  try {
    const response = await fetch(`https://${host}/api/v1/users/${username}`, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "gitfill",
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch Gitea user info: ${response.status}`);
      return null;
    }

    const user = await response.json();
    // created format: "2020-01-15T12:00:00Z"
    return user.created?.split("T")[0] ?? null;
  } catch (error) {
    console.error("Failed to fetch Gitea user info:", error);
    return null;
  }
}

/** Parse Gitea username and host from a git remote URL */
export function parseGiteaRemote(
  remoteUrl: string,
): { username: string; host: string } | null {
  // Handle HTTPS: https://gitea.com/username/repo.git
  // Handle SSH: git@gitea.com:username/repo.git
  // Handle self-hosted: https://git.mycompany.com/username/repo.git

  const httpsMatch = remoteUrl.match(/https?:\/\/([^/]+)\/([^/]+)/);
  if (
    httpsMatch &&
    (httpsMatch[1].includes("gitea") || httpsMatch[1].includes("codeberg"))
  ) {
    return { host: httpsMatch[1], username: httpsMatch[2] };
  }

  const sshMatch = remoteUrl.match(/git@([^:]+):([^/]+)/);
  if (
    sshMatch &&
    (sshMatch[1].includes("gitea") || sshMatch[1].includes("codeberg"))
  ) {
    return { host: sshMatch[1], username: sshMatch[2] };
  }

  return null;
}
