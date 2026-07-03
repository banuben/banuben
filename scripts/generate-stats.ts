/**
 * generate-stats.ts
 * -----------------------------------------------------------------------------
 * Fetches every metric shown on assets/github-dashboard.svg straight from the
 * GitHub GraphQL API — no github-readme-stats / streak-stats / top-langs / any
 * external SVG service. Writes the snapshot to data/stats.json, which
 * generate-profile.ts stamps into the dashboard template.
 *
 *   GH_TOKEN=<token> GH_USER=banuben npx tsx scripts/generate-stats.ts
 */

import { writeFile, mkdir } from "node:fs/promises";

const USER = process.env.GH_USER ?? "banuben";
const TOKEN = process.env.GH_TOKEN ?? "";

const QUERY = /* GraphQL */ `
  query ($login: String!) {
    user(login: $login) {
      followers { totalCount }
      following { totalCount }
      pullRequests { totalCount }
      repositories(first: 100, ownerAffiliations: OWNER, isFork: false) {
        totalCount
        nodes {
          stargazerCount
          languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
            edges { size node { name color } }
          }
        }
      }
      contributionsCollection {
        totalCommitContributions
        restrictedContributionsCount
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays { contributionCount date }
          }
        }
      }
    }
  }`;

type Lang = { name: string; color: string; pct: number };

type Stats = {
  repos: number;
  stars: number;
  commits: number;
  prs: number;
  followers: number;
  following: number;
  contributions: number;
  bars: number[];   // 12 monthly fractions, 0..1
  languages: Lang[]; // top languages by bytes
  updated: string;  // e.g. "Jul 2026"
};

/** Compact number formatting: 1234 -> "1.2k". */
function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "m";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return n.toLocaleString("en-US");
}

/** Bucket the contribution calendar into 12 monthly fractions (0..1). */
function monthlyBars(weeks: any[]): number[] {
  const months = new Array(12).fill(0);
  for (const w of weeks) {
    for (const d of w.contributionDays) {
      const m = new Date(d.date).getMonth();
      months[m] += d.contributionCount;
    }
  }
  const max = Math.max(1, ...months);
  return months.map((v) => Math.round((0.08 + 0.92 * (v / max)) * 100) / 100);
}

/** Aggregate language bytes across all repos → top 6 with percentages. */
function topLanguages(repos: any[]): Lang[] {
  const totals = new Map<string, { bytes: number; color: string }>();
  for (const r of repos) {
    for (const e of r.languages?.edges ?? []) {
      const name = e.node.name;
      const prev = totals.get(name) ?? { bytes: 0, color: e.node.color || "#57C07A" };
      prev.bytes += e.size;
      totals.set(name, prev);
    }
  }
  const all = [...totals.entries()].sort((a, b) => b[1].bytes - a[1].bytes);
  const sum = all.reduce((n, [, v]) => n + v.bytes, 0) || 1;
  return all.slice(0, 6).map(([name, v]) => ({
    name,
    color: v.color || "#57C07A",
    pct: Math.round((v.bytes / sum) * 1000) / 10, // one decimal
  }));
}

async function fetchStats(): Promise<Stats> {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `bearer ${TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": USER,
    },
    body: JSON.stringify({ query: QUERY, variables: { login: USER } }),
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);

  const { data, errors } = await res.json();
  if (errors) throw new Error(JSON.stringify(errors));

  const u = data.user;
  const cc = u.contributionsCollection;
  const stars = u.repositories.nodes.reduce(
    (n: number, r: any) => n + r.stargazerCount,
    0
  );

  return {
    repos: u.repositories.totalCount,
    stars,
    commits: cc.totalCommitContributions,
    prs: u.pullRequests.totalCount,
    followers: u.followers.totalCount,
    following: u.following.totalCount,
    contributions: cc.contributionCalendar.totalContributions,
    bars: monthlyBars(cc.contributionCalendar.weeks),
    languages: topLanguages(u.repositories.nodes),
    updated: new Date().toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    }),
  };
}

async function main() {
  const s = await fetchStats();
  const out = {
    ...s,
    display: {
      repos: fmt(s.repos),
      stars: fmt(s.stars),
      commits: fmt(s.commits),
      prs: fmt(s.prs),
      followers: fmt(s.followers),
      following: fmt(s.following),
      contributions: s.contributions.toLocaleString("en-US"),
    },
  };
  await mkdir("data", { recursive: true });
  await writeFile("data/stats.json", JSON.stringify(out, null, 2) + "\n");
  console.log("wrote data/stats.json", out.display, s.languages.map((l) => l.name));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

