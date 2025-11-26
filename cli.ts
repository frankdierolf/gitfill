#!/usr/bin/env -S deno run --allow-run=git --allow-read=. --allow-write=. --allow-env --allow-net

import { ensureDir } from "@std/fs";
import { serveFile } from "@std/http/file-server";
import { DEFAULT_CONFIG } from "./lib/types.ts";
import type { CommitSchedule } from "./lib/types.ts";
import { getRandomTimeOfDay } from "./lib/dates.ts";
import {
  createCommit,
  getGitRemoteUrl,
  getLocalCommitDates,
} from "./lib/git.ts";
import {
  getGitHubContributions,
  getGitHubUserCreatedAt,
  parseGitHubUsername,
} from "./lib/platforms/github.ts";
import {
  getGitLabContributions,
  getGitLabUserCreatedAt,
  parseGitLabRemote,
} from "./lib/platforms/gitlab.ts";
import {
  getGiteaContributions,
  getGiteaUserCreatedAt,
  parseGiteaRemote,
} from "./lib/platforms/gitea.ts";
import { generateHTML } from "./scripts/visualize.ts";
import { type Density, generateRealisticSchedule } from "./lib/schedule.ts";

type Platform = "github" | "gitlab" | "gitea";

const VERSION = "0.2.0";

const HELP = `
gitfill v${VERSION}
Fill your contribution graph (GitHub, GitLab, Gitea)

USAGE:
  gitfill --goal <total>

OPTIONS:
  --goal <n>             Target total commits (required)
  --user <username>      Username (default: auto-detect from git remote)
  --platform <name>      Platform: github, gitlab, gitea (default: auto-detect)
  --host <hostname>      Self-hosted instance (e.g., gitlab.mycompany.com)
  --start <YYYY-MM-DD>   Start date (default: account creation)
  --end <YYYY-MM-DD>     End date (default: today)
  --density <level>      Activity density: sparse (20-30%), normal (35-45%), dense (55-65%)
  --max-per-day <n>      Maximum commits per day (default: 175)
  --yes, -y              Skip confirmation prompt
  --dry-run              Preview schedule without creating commits
  --preview              Generate HTML visualization (starts local server)
  --help, -h             Show this help message
  --version, -v          Show version number

EXAMPLES:
  gitfill --goal 1772                           # GitHub (auto-detect)
  gitfill --goal 2000 --platform gitlab         # GitLab
  gitfill --goal 1500 --density sparse          # Fewer active days, more commits per day
`;

interface ParsedArgs {
  start: string | null;
  end: string | null;
  goal: number | null;
  user: string | null;
  platform: Platform | null;
  host: string | null;
  density: Density;
  maxPerDay: number;
  yes: boolean;
  dryRun: boolean;
  preview: boolean;
  help: boolean;
  version: boolean;
}

/** Parse command line arguments */
function parseArgs(): ParsedArgs {
  const args = Deno.args;
  const result: ParsedArgs = {
    start: null,
    end: null,
    goal: null,
    user: null,
    platform: null,
    host: null,
    density: "normal",
    maxPerDay: 175,
    yes: false,
    dryRun: false,
    preview: false,
    help: false,
    version: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg === "--version" || arg === "-v") {
      result.version = true;
    } else if (arg === "--yes" || arg === "-y") {
      result.yes = true;
    } else if (arg === "--dry-run") {
      result.dryRun = true;
    } else if (arg === "--preview") {
      result.preview = true;
    } else if (arg === "--start") {
      result.start = args[++i];
    } else if (arg === "--end") {
      result.end = args[++i];
    } else if (arg === "--user") {
      result.user = args[++i];
    } else if (arg === "--platform") {
      const p = args[++i] as Platform;
      if (!["github", "gitlab", "gitea"].includes(p)) {
        console.error(
          `Error: --platform must be github, gitlab, or gitea, got "${p}"`,
        );
        Deno.exit(1);
      }
      result.platform = p;
    } else if (arg === "--host") {
      result.host = args[++i];
    } else if (arg === "--density") {
      const d = args[++i] as Density;
      if (!["sparse", "normal", "dense"].includes(d)) {
        console.error(
          `Error: --density must be sparse, normal, or dense, got "${d}"`,
        );
        Deno.exit(1);
      }
      result.density = d;
    } else if (arg === "--goal") {
      const next = args[++i];
      const num = parseInt(next, 10);
      if (isNaN(num) || num < 1) {
        console.error(
          `Error: --goal requires a positive number, got "${next}"`,
        );
        Deno.exit(1);
      }
      result.goal = num;
    } else if (arg === "--max-per-day") {
      const next = args[++i];
      const num = parseInt(next, 10);
      if (isNaN(num) || num < 10) {
        console.error(
          `Error: --max-per-day requires a number >= 10, got "${next}"`,
        );
        Deno.exit(1);
      }
      result.maxPerDay = num;
    }
  }

  return result;
}

/** Validate date string format YYYY-MM-DD */
function isValidDate(dateStr: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

/** Prompt user for confirmation */
async function confirm(message: string): Promise<boolean> {
  const encoder = new TextEncoder();
  await Deno.stdout.write(encoder.encode(`${message} [y/N] `));

  const buf = new Uint8Array(1024);
  const bytesRead = await Deno.stdin.read(buf);
  if (bytesRead === null) return false;

  const input = new TextDecoder().decode(buf.subarray(0, bytesRead)).trim()
    .toLowerCase();
  return input === "y" || input === "yes";
}

/** Generate commits */
async function generate(
  schedule: CommitSchedule,
  peakDays: Map<string, number>,
  dryRun: boolean,
): Promise<void> {
  if (dryRun) {
    console.log("=== DRY RUN MODE ===");
    console.log("No commits will be created.\n");
  }

  const sortedDates = [...schedule.keys()].sort();
  const total = [...schedule.values()].reduce((sum, count) => sum + count, 0);

  console.log(`Total fake commits: ${total}`);
  console.log(`Peak days: ${peakDays.size}`);
  console.log(`Normal days: ${schedule.size - peakDays.size}`);
  console.log();

  console.log("Peak days:");
  for (const [date, count] of [...peakDays.entries()].sort()) {
    console.log(`  ${date}: ${count} commits`);
  }
  console.log();

  let created = 0;
  const messages = DEFAULT_CONFIG.messages;

  for (const dateStr of sortedDates) {
    const count = schedule.get(dateStr)!;
    const baseDate = new Date(dateStr);

    const encoder = new TextEncoder();
    await Deno.stdout.write(
      encoder.encode(`${dateStr}: creating ${count} commits... `),
    );

    for (let i = 0; i < count; i++) {
      const commitTime = getRandomTimeOfDay(baseDate);
      const message = messages[Math.floor(Math.random() * messages.length)];
      await createCommit(commitTime, message, dryRun);
      created++;
    }

    console.log("done");
  }

  console.log(
    `\nTotal commits ${dryRun ? "would be " : ""}created: ${created}`,
  );
}

/** Generate preview visualization */
async function preview(
  startDate: string,
  username: string,
  platform: Platform,
  host: string,
  density: Density,
): Promise<void> {
  console.log("Generating visualization...\n");

  // Parse year from start date for full year view
  const year = new Date(startDate).getFullYear();
  const vizStartDate = `${year}-01-01`;
  const vizEndDate = `${year}-12-31`;
  console.log(`Visualization: ${vizStartDate} to ${vizEndDate}`);

  console.log("\nReading commits from git log...");
  const fakeCommits = await getLocalCommitDates();
  console.log(`Found ${Object.keys(fakeCommits).length} days with commits`);

  // Fetch contributions from platform
  let realCommits: Record<string, number> = {};
  let hasPlatformAccess = false;

  try {
    console.log(`\nFetching real commits from ${platform}...`);
    if (platform === "github") {
      realCommits = await getGitHubContributions(
        username,
        vizStartDate,
        vizEndDate,
      );
    } else if (platform === "gitlab") {
      realCommits = await getGitLabContributions(
        username,
        vizStartDate,
        vizEndDate,
        host,
      );
    } else if (platform === "gitea") {
      realCommits = await getGiteaContributions(
        username,
        vizStartDate,
        vizEndDate,
        host,
      );
    }
    console.log(
      `Found ${Object.keys(realCommits).length} days with real commits`,
    );
    hasPlatformAccess = true;
  } catch {
    console.log(`\nNote: Could not fetch ${platform} contributions (offline?)`);
    console.log("Showing fake commits only.");
  }

  const totalFake = Object.values(fakeCommits).reduce(
    (sum, count) => sum + count,
    0,
  );
  const totalReal = Object.values(realCommits).reduce(
    (sum, count) => sum + count,
    0,
  );
  const peakDays = Object.values(fakeCommits).filter((c) => c > 30).length;

  const data = {
    fake: fakeCommits,
    real: realCommits,
    startDate: vizStartDate,
    endDate: vizEndDate,
    density,
    stats: {
      totalFake,
      totalReal,
      fakeDays: Object.keys(fakeCommits).length,
      realDays: Object.keys(realCommits).length,
      peakDays,
    },
  };

  console.log("\nStats:");
  console.log(`  Fake commits: ${totalFake}`);
  if (hasPlatformAccess) {
    console.log(`  Real commits: ${totalReal}`);
  }
  console.log(`  Peak days: ${peakDays}`);

  const html = generateHTML(data);
  await ensureDir("./output");
  const outputPath = "./output/index.html";
  await Deno.writeTextFile(outputPath, html);
  console.log(`\nGenerated: ${outputPath}`);

  // Start HTTP server for cross-platform preview
  console.log("\nStarting preview server...");

  const server = Deno.serve({
    port: 0, // Auto-pick available port
    hostname: "127.0.0.1",
    onListen({ port, hostname }) {
      console.log(`\nPreview: http://${hostname}:${port}/`);
      console.log("Press Ctrl+C to stop the server");
    },
  }, (req) => serveFile(req, outputPath));

  await server.finished;
}

/** Main entry point */
async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    console.log(HELP);
    return;
  }

  if (args.version) {
    console.log(`gitfill v${VERSION}`);
    return;
  }

  // Detect platform, host, and username from git remote or flags
  let platform = args.platform;
  let host = args.host;
  let username = args.user;

  const remoteUrl = await getGitRemoteUrl();

  // Auto-detect platform and username from remote URL
  if (!platform || !username) {
    if (remoteUrl) {
      // Try GitHub
      const ghUser = parseGitHubUsername(remoteUrl);
      if (ghUser) {
        platform = platform || "github";
        username = username || ghUser;
        host = host || "github.com";
      }

      // Try GitLab
      const glRemote = parseGitLabRemote(remoteUrl);
      if (glRemote) {
        platform = platform || "gitlab";
        username = username || glRemote.username;
        host = host || glRemote.host;
      }

      // Try Gitea
      const gtRemote = parseGiteaRemote(remoteUrl);
      if (gtRemote) {
        platform = platform || "gitea";
        username = username || gtRemote.username;
        host = host || gtRemote.host;
      }
    }
  }

  // Validate we have required info
  if (!platform) {
    console.error("Error: Could not detect platform from git remote.\n");
    console.error("Please provide --platform flag:");
    console.error("  gitfill --goal 1772 --platform github");
    Deno.exit(1);
  }

  if (!username) {
    console.error("Error: Could not detect username from git remote.\n");
    console.error("Please provide --user flag:");
    console.error("  gitfill --goal 1772 --user yourusername");
    Deno.exit(1);
  }

  // Set default hosts
  host = host ||
    (platform === "github"
      ? "github.com"
      : platform === "gitlab"
      ? "gitlab.com"
      : "gitea.com");

  console.log(`Platform: ${platform} (${host})`);
  console.log(`User: ${username}`);

  // Resolve dates with smart defaults
  let startDateStr = args.start;
  let endDateStr = args.end;

  // Auto-detect start date from account creation
  if (!startDateStr) {
    console.log("Fetching account creation date...");
    let accountCreated: string | null = null;

    if (platform === "github") {
      accountCreated = await getGitHubUserCreatedAt(username);
    } else if (platform === "gitlab") {
      accountCreated = await getGitLabUserCreatedAt(username, host);
    } else if (platform === "gitea") {
      accountCreated = await getGiteaUserCreatedAt(username, host);
    }

    if (!accountCreated) {
      console.error("Error: Could not fetch account creation date.");
      console.error("Please provide --start manually.");
      Deno.exit(1);
    }
    startDateStr = accountCreated;
    console.log(`Start date: ${startDateStr} (account created)`);
  }

  // Auto-detect end date as today
  if (!endDateStr) {
    const today = new Date();
    endDateStr = `${today.getFullYear()}-${
      String(today.getMonth() + 1).padStart(2, "0")
    }-${String(today.getDate()).padStart(2, "0")}`;
    console.log(`End date: ${endDateStr} (today)`);
  }

  // Validate date formats
  if (!isValidDate(startDateStr)) {
    console.error(
      `Error: Invalid start date "${startDateStr}". Use format YYYY-MM-DD.`,
    );
    Deno.exit(1);
  }

  if (!isValidDate(endDateStr)) {
    console.error(
      `Error: Invalid end date "${endDateStr}". Use format YYYY-MM-DD.`,
    );
    Deno.exit(1);
  }

  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);

  // Validate date range
  if (startDate >= endDate) {
    console.error("Error: Start date must be before end date.");
    Deno.exit(1);
  }

  // Handle preview mode (doesn't require --goal)
  if (args.preview) {
    await preview(startDateStr, username, platform, host, args.density);
    return;
  }

  // Require --goal for non-preview mode
  if (args.goal === null) {
    console.error("Error: --goal is required.\n");
    console.error("Usage: gitfill --goal <total>");
    console.error("Example: gitfill --goal 1772");
    Deno.exit(1);
  }

  // Fetch real commits from platform
  console.log(`\nFetching real commits from ${platform}...`);

  let realCommits: Record<string, number> = {};
  if (platform === "github") {
    realCommits = await getGitHubContributions(
      username,
      startDateStr,
      endDateStr,
    );
  } else if (platform === "gitlab") {
    realCommits = await getGitLabContributions(
      username,
      startDateStr,
      endDateStr,
      host,
    );
  } else if (platform === "gitea") {
    realCommits = await getGiteaContributions(
      username,
      startDateStr,
      endDateStr,
      host,
    );
  }
  const realTotal = Object.values(realCommits).reduce(
    (sum, count) => sum + count,
    0,
  );

  // Calculate fake commits needed
  const fakeNeeded = Math.max(0, args.goal - realTotal);

  console.log(`Real commits: ${realTotal}`);
  console.log(`Goal: ${args.goal}`);
  console.log(`Fake commits needed: ${fakeNeeded}`);

  if (fakeNeeded === 0) {
    console.log("\nYou've already reached your goal! No fake commits needed.");
    return;
  }

  // Generate schedule
  const { schedule, peakDays } = generateRealisticSchedule(
    startDate,
    endDate,
    fakeNeeded,
    args.maxPerDay,
    args.density,
  );
  const total = [...schedule.values()].reduce((sum, count) => sum + count, 0);
  const normalDays = schedule.size - peakDays.size;

  // Show confirmation unless --yes or --dry-run
  if (!args.yes && !args.dryRun) {
    console.log(
      `\ngitfill will create ${total} fake commits from ${startDateStr} to ${endDateStr}`,
    );
    console.log(`  Density: ${args.density}`);
    console.log(`  Peak days: ${peakDays.size} (high activity)`);
    console.log(`  Normal days: ${normalDays}`);
    console.log(`  Max per day: ${args.maxPerDay}\n`);

    const confirmed = await confirm("Continue?");
    if (!confirmed) {
      console.log("\nAborted.");
      return;
    }
    console.log();
  }

  await generate(schedule, peakDays, args.dryRun);
}

main();
