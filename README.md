# gitfill

Generate fake commits to fill your contribution graph. Works with GitHub,
GitLab, and Gitea.

## Why

- Lost access to an old account
- Years of commits on GitLab, Bitbucket, or self-hosted instances
- Client work on private enterprise repos
- The work happened. The green squares didn't.

This fixes that.

## Quick Start

```bash
mkdir my-commits && cd my-commits && git init
deno run jsr:@gitfill/gitfill --goal 1500
```

Or install globally:

```bash
deno install -g -n gitfill jsr:@gitfill/gitfill
gitfill --goal 1500
```

## Usage

```bash
# Generate commits to reach your goal
gitfill --goal 1772

# Plan: see what your graph will look like before generating
gitfill --plan --goal 1772

# Audit: see fake vs real commit breakdown after push
gitfill --audit

# Specify platform
gitfill --goal 2000 --platform gitlab

# Dry run (no commits created)
gitfill --goal 1772 --dry-run
```

Both `--plan` and `--audit` open a local server with an interactive graph.

## Options

| Option                 | Description                                            |
| ---------------------- | ------------------------------------------------------ |
| `--goal <n>`           | Target total commits (required)                        |
| `--user <username>`    | Username (default: auto-detect from git remote)        |
| `--platform <name>`    | Platform: github, gitlab, gitea (default: auto-detect) |
| `--host <hostname>`    | Self-hosted instance (e.g., gitlab.mycompany.com)      |
| `--start <YYYY-MM-DD>` | Start date (default: account creation)                 |
| `--end <YYYY-MM-DD>`   | End date (default: today)                              |
| `--max-per-day <n>`    | Maximum commits per day (default: 175)                 |
| `--yes`, `-y`          | Skip confirmation                                      |
| `--dry-run`            | Preview without creating commits                       |
| `--plan`               | See what your graph will look like (requires `--goal`) |
| `--audit`              | See fake vs real commit breakdown after push           |
| `--help`, `-h`         | Show help                                              |
| `--version`, `-v`      | Show version                                           |

## How It Works

1. Fetches your real contribution count from the platform's public API
2. Calculates how many fake commits are needed to reach your goal
3. Picks ~40% of days randomly as "active" (rest stay empty for realism)
4. Distributes commits using **Zipf's Law** with randomized parameters:
   - Formula: `commits = C / rank^α` where α varies 0.9-1.1
   - Creates natural "few peaks, many small" pattern
   - Days are shuffled randomly across the date range
5. Creates empty commits with backdated timestamps
6. Push to your platform and watch your contribution graph fill in

Commit messages are simple: "update", "fix", "wip", "chore", "tweak".

## Platform Support

| Platform       | Auto-detect | Self-hosted |
| -------------- | ----------- | ----------- |
| GitHub         | Yes         | No          |
| GitLab         | Yes         | Yes         |
| Gitea/Codeberg | Yes         | Yes         |

## Requirements

- [Deno](https://deno.land) runtime
- Git repository (can be empty)

## License

MIT
