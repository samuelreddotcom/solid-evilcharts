import { EChartsRadialChart } from "~/registry/charts/radial-chart";

import { BROWSERS, BROWSER_CONFIG } from "./data";
import { DemoFrame } from "./frame";
import { DOCS_RENDERER } from "./renderer";

export function RadialChartDemo() {
  return (
    <DemoFrame>
      <EChartsRadialChart
        data={BROWSERS}
        config={BROWSER_CONFIG}
        nameKey="browser"
        renderer={DOCS_RENDERER}
        class="h-full w-full"
      >
        <EChartsRadialChart.RadialBar dataKey="visitors" showBackground />
        <EChartsRadialChart.Tooltip />
        <EChartsRadialChart.Legend />
      </EChartsRadialChart>
    </DemoFrame>
  );
}
