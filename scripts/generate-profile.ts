/**
 * generate-profile.ts
 * -----------------------------------------------------------------------------
 * Renders assets/github-dashboard.svg by stamping the numbers from
 * data/stats.json into the placeholder template
 * assets/github-dashboard.template.svg — {{repos}}, {{stars}}, {{commits}},
 * {{prs}}, {{followers}}, {{following}}, {{contributions}}, {{updated}} and the
 * 12 monthly trend fractions {{bar1}}..{{bar12}}.
 *
 * The template is never overwritten, so this stays idempotent and re-runnable.
 *
 *   npx tsx scripts/generate-profile.ts
 */

import { readFile, writeFile } from "node:fs/promises";

const TEMPLATE = "assets/github-dashboard.template.svg";
const OUTPUT = "assets/github-dashboard.svg";

type Stats = {
  repos: number; stars: number; commits: number; prs: number;
  followers: number; following: number; contributions: number;
  bars: number[]; updated: string;
  display?: Record<string, string>;
};

async function loadStats(): Promise<Stats> {
  try {
    return JSON.parse(await readFile("data/stats.json", "utf8"));
  } catch {
    return {
      repos: 0, stars: 0, commits: 0, prs: 0, followers: 0, following: 0,
      contributions: 0, bars: new Array(12).fill(0.1), updated: "—",
    };
  }
}

/** Replace {{token}} holes with resolved values; unknown holes are left intact. */
function stamp(svg: string, vars: Record<string, string | number>): string {
  return svg.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) =>
    key in vars ? String(vars[key]) : `{{${key}}}`
  );
}

async function main() {
  const s = await loadStats();
  const d = s.display ?? {};

  const vars: Record<string, string | number> = {
    repos: d.repos ?? s.repos,
    stars: d.stars ?? s.stars,
    commits: d.commits ?? s.commits,
    prs: d.prs ?? s.prs,
    followers: d.followers ?? s.followers,
    following: d.following ?? s.following,
    contributions: d.contributions ?? s.contributions,
    updated: s.updated,
  };
  // 12 monthly bar fractions, clamped to 0..1
  const bars = s.bars ?? [];
  for (let i = 0; i < 12; i++) {
    vars[`bar${i + 1}`] = Math.max(0.06, Math.min(1, bars[i] ?? 0.1));
  }

  const template = await readFile(TEMPLATE, "utf8");
  await writeFile(OUTPUT, stamp(template, vars));
  console.log("rendered", OUTPUT, vars);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
