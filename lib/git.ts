import { formatDateTime } from "./dates.ts";

/** Create an empty backdated commit */
export async function createCommit(
  date: Date,
  message: string,
  dryRun = false,
): Promise<void> {
  const timestamp = formatDateTime(date);

  if (dryRun) {
    console.log(
      `  [dry-run] Would create commit: "${message}" at ${timestamp}`,
    );
    return;
  }

  const command = new Deno.Command("git", {
    args: ["commit", "--allow-empty", "-m", message],
    env: {
      ...Deno.env.toObject(),
      GIT_AUTHOR_DATE: timestamp,
      GIT_COMMITTER_DATE: timestamp,
    },
    stdout: "piped",
    stderr: "piped",
  });

  const { code, stderr } = await command.output();
  if (code !== 0) {
    const error = new TextDecoder().decode(stderr);
    throw new Error(`Git commit failed: ${error}`);
  }
}

/** Get commit dates from local git log */
export async function getLocalCommitDates(): Promise<Record<string, number>> {
  const result: Record<string, number> = {};

  try {
    const command = new Deno.Command("git", {
      args: ["log", "--format=%ad", "--date=short"],
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stdout } = await command.output();

    if (code !== 0) {
      return result;
    }

    const output = new TextDecoder().decode(stdout);
    const dates = output.trim().split("\n").filter(Boolean);

    for (const date of dates) {
      result[date] = (result[date] || 0) + 1;
    }
  } catch {
    // No commits yet or not a git repo
  }

  return result;
}

/** Get the git remote URL for origin */
export async function getGitRemoteUrl(): Promise<string | null> {
  try {
    const command = new Deno.Command("git", {
      args: ["remote", "get-url", "origin"],
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stdout } = await command.output();

    if (code !== 0) {
      return null;
    }

    return new TextDecoder().decode(stdout).trim();
  } catch {
    return null;
  }
}
