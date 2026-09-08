/**
 * Shared sample data for the docs demos.
 *
 * One dataset across the cartesian charts on purpose: a reader comparing an
 * area chart to a bar chart should be comparing the CHARTS, not two different
 * sets of numbers. The colours match the values used in every example snippet.
 */
import type { ChartConfig } from "~/registry/lib/chart-tokens";

export const MONTHLY = [
  { month: "January", desktop: 342, mobile: 245, tablet: 120 },
  { month: "February", desktop: 876, mobile: 654, tablet: 210 },
  { month: "March", desktop: 512, mobile: 387, tablet: 160 },
  { month: "April", desktop: 629, mobile: 521, tablet: 190 },
  { month: "May", desktop: 458, mobile: 412, tablet: 140 },
  { month: "June", desktop: 781, mobile: 598, tablet: 230 },
  { month: "July", desktop: 394, mobile: 312, tablet: 130 },
  { month: "August", desktop: 925, mobile: 743, tablet: 260 },
];

export const DEVICE_CONFIG: ChartConfig = {
  desktop: { label: "Desktop", colors: { light: ["#047857"], dark: ["#10b981"] } },
  mobile: { label: "Mobile", colors: { light: ["#be123c"], dark: ["#f43f5e"] } },
  tablet: { label: "Tablet", colors: { light: ["#7c3aed"], dark: ["#a78bfa"] } },
};

export const BROWSERS = [
  { browser: "chrome", visitors: 275 },
  { browser: "safari", visitors: 200 },
  { browser: "firefox", visitors: 187 },
  { browser: "edge", visitors: 173 },
  { browser: "other", visitors: 90 },
];

export const BROWSER_CONFIG: ChartConfig = {
  chrome: { label: "Chrome", colors: { light: ["#047857"], dark: ["#10b981"] } },
  safari: { label: "Safari", colors: { light: ["#be123c"], dark: ["#f43f5e"] } },
  firefox: { label: "Firefox", colors: { light: ["#7c3aed"], dark: ["#a78bfa"] } },
  edge: { label: "Edge", colors: { light: ["#0369a1"], dark: ["#38bdf8"] } },
  other: { label: "Other", colors: { light: ["#a16207"], dark: ["#fbbf24"] } },
};

export const FUNNEL_CONFIG: ChartConfig = {
  direct: { label: "Direct", colors: { light: ["#047857"], dark: ["#10b981"] } },
  search: { label: "Search", colors: { light: ["#0369a1"], dark: ["#38bdf8"] } },
  social: { label: "Social", colors: { light: ["#7c3aed"], dark: ["#a78bfa"] } },
  landing: { label: "Landing", colors: { light: ["#a16207"], dark: ["#fbbf24"] } },
  pricing: { label: "Pricing", colors: { light: ["#0f766e"], dark: ["#2dd4bf"] } },
  signup: { label: "Signup", colors: { light: ["#15803d"], dark: ["#4ade80"] } },
  churn: { label: "Churn", colors: { light: ["#be123c"], dark: ["#f43f5e"] } },
};
