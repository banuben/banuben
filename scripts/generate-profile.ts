/**
 * generate-profile.ts
 * -----------------------------------------------------------------------------
 * The dynamic-SVG core. Assets in /assets are authored to keep layout, colors,
 * text and stats in separate, well-named groups (<g id="hero-text">,
 * <g id="background"> …). This script re-stamps the DATA layer — text and
 * numbers pulled from data/stats.json and profile.config.ts — without touching
 * the hand-tuned layout/animation groups. Extend TOKENS below and add new
 * {{placeholders}} to the SVGs to expose more dynamic fields.
 *
 *   npx tsx scripts/generate-profile.ts
 */

import { readFile, writeFile } from "node:fs/promises";

// ── single source of truth ───────────────────────────────────────────────────
const PROFILE = {
  handle: "banuben",
  headline: ["I build", "intelligent systems", "that scale."],
  role: "Full Stack & AI / Big Data Engineer",
  chips: ["Engineer", "Builder", "Big Data", "AI Systems"],
} as const;

// central design tokens — keep in lockstep with the SVG color system
const TOKENS = {
  bg: "#06090F",
  surface: "#101826",
  surface2: "#151F30",
  border: "#233044",
  green: "#76FF8A",
  blue: "#59D9FF",
  purple: "#A97FFF",
  yellow: "#FFD166",
  text: "#F8FAFC",
  secondary: "#A8B5C4",
} as const;

type Stats = { repos: number; stars: number; commits: number; prs: number };

async function loadStats(): Promise<Stats> {
  try {
    return JSON.parse(await readFile("data/stats.json", "utf8"));
  } catch {
    return { repos: 0, stars: 0, commits: 0, prs: 0 };
  }
}

/** Replace {{token}} holes in an SVG string with resolved values. */
function stamp(svg: string, vars: Record<string, string | number>): string {
  return svg.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) =>
    key in vars ? String(vars[key]) : `{{${key}}}`
  );
}

async function main() {
  const stats = await loadStats();
  const vars = {
    handle: PROFILE.handle,
    role: PROFILE.role,
    ...TOKENS,
    repos: stats.repos,
    stars: stats.stars,
    commits: stats.commits,
    prs: stats.prs,
  };

  // Add {{repos}}, {{commits}}, … to any asset to make it data-driven.
  for (const file of ["assets/hero.svg", "assets/footer.svg"]) {
    const src = await readFile(file, "utf8");
    await writeFile(file, stamp(src, vars));
  }

  console.log("regenerated assets for", PROFILE.handle, "with", vars);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
