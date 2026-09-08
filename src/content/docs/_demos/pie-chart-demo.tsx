import { EChartsPieChart } from "~/registry/charts/pie-chart";

import { BROWSERS, BROWSER_CONFIG } from "./data";
import { DemoFrame } from "./frame";
import { DOCS_RENDERER } from "./renderer";

export function PieChartDemo() {
  return (
    <DemoFrame>
      <EChartsPieChart
        data={BROWSERS}
        config={BROWSER_CONFIG}
        nameKey="browser"
        dataKey="visitors"
        renderer={DOCS_RENDERER}
        class="h-full w-full"
      >
        <EChartsPieChart.Pie />
        <EChartsPieChart.Tooltip />
        <EChartsPieChart.Legend />
      </EChartsPieChart>
    </DemoFrame>
  );
}
