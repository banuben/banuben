/**
 * generate-stats.ts
 * -----------------------------------------------------------------------------
 * Pulls a lightweight stats snapshot from the GitHub GraphQL API and writes it
 * to data/stats.json. generate-profile.ts reads that file to stamp live numbers
 * into the SVG assets. Run in CI (see .github/workflows/profile.yml).
 *
 *   GH_TOKEN=xxxx GH_USER=banuben npx tsx scripts/generate-stats.ts
 */

import { writeFile, mkdir } from "node:fs/promises";

const USER = process.env.GH_USER ?? "banuben";
const TOKEN = process.env.GH_TOKEN ?? "";

const QUERY = `
  query ($login: String!) {
    user(login: $login) {
      repositories(first: 100, ownerAffiliations: OWNER, isFork: false) {
        totalCount
        nodes { stargazerCount }
      }
      contributionsCollection { totalCommitContributions }
      pullRequests { totalCount }
    }
  }`;

type Stats = {
  repos: number;
  stars: number;
  commits: number;
  prs: number;
  updatedAt: string;
};

async function fetchStats(): Promise<Stats> {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: QUERY, variables: { login: USER } }),
  });

  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const { data } = await res.json();
  const repos = data.user.repositories;

  return {
    repos: repos.totalCount,
    stars: repos.nodes.reduce((n: number, r: any) => n + r.stargazerCount, 0),
    commits: data.user.contributionsCollection.totalCommitContributions,
    prs: data.user.pullRequests.totalCount,
    updatedAt: new Date().toISOString(),
  };
}

async function main() {
  const stats = await fetchStats();
  await mkdir("data", { recursive: true });
  await writeFile("data/stats.json", JSON.stringify(stats, null, 2) + "\n");
  console.log("wrote data/stats.json", stats);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
