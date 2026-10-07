"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const day = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default function PriceChart({ data }: { data: { ts: number; price: number }[] }) {
  return (
    <div role="img" aria-label={`Price history chart with ${data.length} observations over the last 30 days`} style={{ height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--line)" />
          <XAxis dataKey="ts" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={day} />
          <YAxis domain={["auto", "auto"]} tickFormatter={(v) => `$${v}`} width={56} />
          <Tooltip labelFormatter={(t) => new Date(Number(t)).toLocaleString()} formatter={(v) => [`$${v}`, "Cheapest fare"]} />
          <Line dataKey="price" stroke="var(--link)" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
