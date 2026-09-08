import { EChartsComposedChart } from "~/registry/charts/composed-chart";

import { DEVICE_CONFIG, MONTHLY } from "./data";
import { DemoFrame } from "./frame";
import { DOCS_RENDERER } from "./renderer";

export function ComposedChartDemo() {
  return (
    <DemoFrame>
      <EChartsComposedChart
        data={MONTHLY}
        config={DEVICE_CONFIG}
        xDataKey="month"
        renderer={DOCS_RENDERER}
        class="h-full w-full"
      >
        <EChartsComposedChart.Grid />
        <EChartsComposedChart.XAxis dataKey="month" tickFormatter={(v) => v.slice(0, 3)} />
        <EChartsComposedChart.YAxis />
        <EChartsComposedChart.Tooltip />
        <EChartsComposedChart.Legend />
        <EChartsComposedChart.Bar dataKey="desktop" variant="duotone" />
        <EChartsComposedChart.Line dataKey="mobile">
          <EChartsComposedChart.Dot variant="border" />
        </EChartsComposedChart.Line>
      </EChartsComposedChart>
    </DemoFrame>
  );
}
