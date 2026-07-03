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

type Lang = { name: string; color: string; pct: number };
type Stats = {
  repos: number; stars: number; commits: number; prs: number;
  followers: number; following: number; contributions: number;
  bars: number[]; languages: Lang[]; updated: string;
  display?: Record<string, string>;
};

const BAR_X = 30, BAR_Y = 386, BAR_W = 1220, BAR_H = 16;

async function loadStats(): Promise<Stats> {
  try {
    return JSON.parse(await readFile("data/stats.json", "utf8"));
  } catch {
    return {
      repos: 0, stars: 0, commits: 0, prs: 0, followers: 0, following: 0,
      contributions: 0, bars: new Array(12).fill(0.1), languages: [], updated: "—",
    };
  }
}

/** XML-escape a language name for safe embedding in the SVG. */
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Build the stacked-bar rects (clipped to rounded ends by the template). */
function buildBars(langs: Lang[]): string {
  if (!langs.length) return `<rect x="${BAR_X}" y="${BAR_Y}" width="${BAR_W}" height="${BAR_H}" fill="#3a2a17"/>`;
  const total = langs.reduce((n, l) => n + l.pct, 0) || 1;
  let x = BAR_X;
  const out: string[] = [];
  langs.forEach((l, i) => {
    const w = i === langs.length - 1 ? BAR_X + BAR_W - x : (l.pct / total) * BAR_W;
    out.push(`<rect x="${x.toFixed(1)}" y="${BAR_Y}" width="${(w + 0.5).toFixed(1)}" height="${BAR_H}" fill="${l.color}"/>`);
    x += w;
  });
  return out.join("\n    ");
}

/** Build the legend row: colored dot + "Name pct%" for each language. */
function buildLegend(langs: Lang[]): string {
  const y = 430;              // baseline inside the languages panel
  const gap = 200;            // horizontal spacing between items
  const startX = 30;
  return langs
    .map((l, i) => {
      const x = startX + i * gap;
      return `<g transform="translate(${x},${y})">
    <circle cx="6" cy="-4" r="5" fill="${l.color}"/>
    <text x="18" y="0" font-family="'Inter',system-ui,sans-serif" font-size="13" fill="#F4E8D2">${esc(l.name)} <tspan fill="#8A7A63">${l.pct}%</tspan></text>
  </g>`;
    })
    .join("\n  ");
}

/** Replace {{token}} holes with resolved values; unknown holes stay intact. */
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
    langBars: buildBars(s.languages ?? []),
    langLegend: buildLegend(s.languages ?? []),
  };
  const bars = s.bars ?? [];
  for (let i = 0; i < 12; i++) {
    vars[`bar${i + 1}`] = Math.max(0.06, Math.min(1, bars[i] ?? 0.1));
  }

  const template = await readFile(TEMPLATE, "utf8");
  await writeFile(OUTPUT, stamp(template, vars));
  console.log("rendered", OUTPUT, "· langs:", (s.languages ?? []).map((l) => l.name).join(", "));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


