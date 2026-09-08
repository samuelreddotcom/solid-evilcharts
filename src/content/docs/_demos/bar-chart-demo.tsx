import { EChartsBarChart } from "~/registry/charts/bar-chart";

import { DEVICE_CONFIG, MONTHLY } from "./data";
import { DemoFrame } from "./frame";
import { DOCS_RENDERER } from "./renderer";

export function BarChartDemo() {
  return (
    <DemoFrame>
      <EChartsBarChart
        data={MONTHLY}
        config={DEVICE_CONFIG}
        xDataKey="month"
        renderer={DOCS_RENDERER}
        class="h-full w-full"
      >
        <EChartsBarChart.Grid />
        <EChartsBarChart.XAxis dataKey="month" tickFormatter={(v) => v.slice(0, 3)} />
        <EChartsBarChart.YAxis />
        <EChartsBarChart.Tooltip />
        <EChartsBarChart.Legend />
        <EChartsBarChart.Bar dataKey="desktop" variant="duotone" />
        <EChartsBarChart.Bar dataKey="mobile" variant="duotone" />
      </EChartsBarChart>
    </DemoFrame>
  );
}
