import { EChartsSankeyChart } from "~/registry/charts/sankey-chart";

import { FUNNEL_CONFIG } from "./data";
import { DemoFrame } from "./frame";
import { DOCS_RENDERER } from "./renderer";

import type { SankeyData } from "~/registry/charts/sankey-chart";

const DATA: SankeyData = {
  nodes: [
    { name: "direct" },
    { name: "search" },
    { name: "social" },
    { name: "landing" },
    { name: "pricing" },
    { name: "signup" },
    { name: "churn" },
  ],
  links: [
    { source: 0, target: 3, value: 120 },
    { source: 1, target: 3, value: 200 },
    { source: 2, target: 3, value: 80 },
    { source: 3, target: 4, value: 260 },
    { source: 3, target: 6, value: 140 },
    { source: 4, target: 5, value: 180 },
    { source: 4, target: 6, value: 80 },
  ],
};

export function SankeyChartDemo() {
  return (
    <DemoFrame class="h-96 w-full">
      <EChartsSankeyChart
        data={DATA}
        config={FUNNEL_CONFIG}
        renderer={DOCS_RENDERER}
        class="h-full w-full"
      >
        <EChartsSankeyChart.Node />
        <EChartsSankeyChart.NodeLabel />
        <EChartsSankeyChart.Link />
        <EChartsSankeyChart.Tooltip />
      </EChartsSankeyChart>
    </DemoFrame>
  );
}
