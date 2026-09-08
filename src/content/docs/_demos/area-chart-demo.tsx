import { EChartsAreaChart } from "~/registry/charts/area-chart";

import { DEVICE_CONFIG, MONTHLY } from "./data";
import { DemoFrame } from "./frame";
import { DOCS_RENDERER } from "./renderer";

export function AreaChartDemo() {
  return (
    <DemoFrame>
      <EChartsAreaChart
        data={MONTHLY}
        config={DEVICE_CONFIG}
        xDataKey="month"
        renderer={DOCS_RENDERER}
        class="h-full w-full"
      >
        <EChartsAreaChart.Grid />
        <EChartsAreaChart.XAxis dataKey="month" tickFormatter={(v) => v.slice(0, 3)} />
        <EChartsAreaChart.YAxis />
        <EChartsAreaChart.Tooltip />
        <EChartsAreaChart.Legend />
        <EChartsAreaChart.Area dataKey="desktop" variant="gradient" />
        <EChartsAreaChart.Area dataKey="mobile" variant="gradient" />
      </EChartsAreaChart>
    </DemoFrame>
  );
}
