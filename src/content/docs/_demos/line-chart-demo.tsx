/**
 * A docs demo. Imported directly by introduction.mdx and rendered inline —
 * this is the thing MDX buys us over static HTML.
 */
import { EChartsLineChart } from "~/registry/charts/line-chart";

import { DOCS_RENDERER } from "./renderer";
import type { ChartConfig } from "~/registry/charts/line-chart";

const DATA = [
  { month: "January", desktop: 186, mobile: 80 },
  { month: "February", desktop: 305, mobile: 200 },
  { month: "March", desktop: 237, mobile: 120 },
  { month: "April", desktop: 273, mobile: 190 },
  { month: "May", desktop: 209, mobile: 130 },
  { month: "June", desktop: 264, mobile: 140 },
];

const CONFIG: ChartConfig = {
  desktop: { label: "Desktop", colors: { light: ["#047857"], dark: ["#10b981"] } },
  mobile: { label: "Mobile", colors: { light: ["#be123c"], dark: ["#f43f5e"] } },
};

export function LineChartDemo() {
  return (
    <div class="h-72 w-full">
      <EChartsLineChart
        data={DATA}
        config={CONFIG}
        xDataKey="month"
        renderer={DOCS_RENDERER}
        class="h-full w-full"
      >
        <EChartsLineChart.Grid />
        <EChartsLineChart.XAxis dataKey="month" tickFormatter={(v) => v.slice(0, 3)} />
        <EChartsLineChart.YAxis />
        <EChartsLineChart.Tooltip />
        <EChartsLineChart.Legend />
        <EChartsLineChart.Line dataKey="desktop">
          <EChartsLineChart.Dot variant="border" />
        </EChartsLineChart.Line>
        <EChartsLineChart.Line dataKey="mobile">
          <EChartsLineChart.Dot variant="border" />
        </EChartsLineChart.Line>
      </EChartsLineChart>
    </div>
  );
}
