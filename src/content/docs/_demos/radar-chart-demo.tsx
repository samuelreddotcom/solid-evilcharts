import { EChartsRadarChart } from "~/registry/charts/radar-chart";

import { DemoFrame } from "./frame";
import { DOCS_RENDERER } from "./renderer";

import type { ChartConfig } from "~/registry/lib/chart-tokens";

const DATA = [
  { month: "January", desktop: 186, mobile: 80 },
  { month: "February", desktop: 305, mobile: 200 },
  { month: "March", desktop: 237, mobile: 120 },
  { month: "April", desktop: 273, mobile: 190 },
  { month: "May", desktop: 209, mobile: 130 },
  { month: "June", desktop: 214, mobile: 140 },
];

const CONFIG: ChartConfig = {
  desktop: { label: "Desktop", colors: { light: ["#047857"], dark: ["#10b981"] } },
  mobile: { label: "Mobile", colors: { light: ["#be123c"], dark: ["#f43f5e"] } },
};

export function RadarChartDemo() {
  return (
    <DemoFrame>
      <EChartsRadarChart data={DATA} config={CONFIG} renderer={DOCS_RENDERER} class="h-full w-full">
        <EChartsRadarChart.PolarGrid />
        <EChartsRadarChart.PolarAngleAxis />
        <EChartsRadarChart.Tooltip />
        <EChartsRadarChart.Legend />
        <EChartsRadarChart.Radar dataKey="desktop" />
        <EChartsRadarChart.Radar dataKey="mobile" />
      </EChartsRadarChart>
    </DemoFrame>
  );
}
