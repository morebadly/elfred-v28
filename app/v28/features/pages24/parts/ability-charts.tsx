"use client";

// 能力画像里的两张图（雷达 / 趋势）都手写 SVG，不引图表库：
//   1) 这里只有 5 个轴、2 个系列，库省下的那点代码量抵不上返工成本——上一版用库，
//      轴标签只能自己算坐标才不叠在一起，手机上长按还会弹它自带的 tooltip 挡住内容；
//   2) 手写才能和这一页其它块共用同一套颜色、字号、圆角，不会突然冒出一套库自带的字体。
// 两张图的坐标都从数据算：数据变了图就变（这就是"活数据"的验收标准）。

import { useEffect, useId, useState } from "react";
import type { RadarAxisView } from "../data/knowledge-data";

/* ── "从 0 长到现在的分数"的时钟 ─────────────────────────────
 * 页面挂载时起一个 requestAnimationFrame 的钟，四块图各自取其中一段。
 * 系统开了"减少动态效果"就直接给终值——不为了好看跟用户的设置对着干。 */
export function useGrowClock(span = 1150) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setElapsed(span);
      return;
    }
    let frame = 0;
    let started = 0;
    const step = (now: number) => {
      if (!started) started = now;
      const passed = now - started;
      setElapsed(passed);
      if (passed < span) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [span]);
  return elapsed;
}

/* 某一块图的进度：延迟 delay 毫秒起跑，跑 duration 毫秒，起手快、收尾慢（easeOutCubic）。
   不加回弹——条和分数都正好停在终值上。 */
export function growProgress(elapsed: number, delay: number, duration: number) {
  const t = (elapsed - delay) / duration;
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const p = 1 - t;
  return 1 - p * p * p;
}

/* 雷达画布：300×232 的坐标系等比缩放到容器宽度。
   圆心放在画布正中（116 = 232 / 2），这样中间那个大数字可以直接用 HTML 叠在 50% / 50%。 */
const RADAR = { w: 300, h: 232, cx: 150, cy: 116, r: 76, labelR: 96 };
// 由外向内画：最外圈先铺一层几乎看不见的底色，再画里面的环，线才不会被盖住。
const RINGS = [1, 0.75, 0.5, 0.25];
const UP = "#0f9d63";
const DOWN = "#d1584c";
const FLAT = "#9aa2a9";

const round = (value: number) => Number(value.toFixed(1));

export function AbilityRadarChart({
  axes,
  tone,
  progress,
}: {
  axes: RadarAxisView[];
  tone: string;
  progress: number;
}) {
  // 渐变 id 用 useId 生成：SVG 的 id 是全局的，写死的话同页出现两张雷达会串色
  const fillId = `elfredRadarFill-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const { w, h, cx, cy, r, labelR } = RADAR;
  const count = Math.max(1, axes.length);
  const angleAt = (index: number) =>
    ((index * 360) / count - 90) * (Math.PI / 180);
  const onRay = (index: number, scale: number) => {
    const angle = angleAt(index);
    const reach = r * Math.min(1, Math.max(0, scale));
    return {
      x: round(cx + reach * Math.cos(angle)),
      y: round(cy + reach * Math.sin(angle)),
    };
  };
  // 数值为 null 的维度不参与画线（不许拿 0 顶替）；少于三个点凑不成面，就不画轮廓。
  // scale：本期从 0 长到 1（progress 控），上期固定 1 —— 上次的线一上来就在原位，不跟着动。
  const polygonOf = (items: { index: number; value: number }[], scale: number) =>
    items.length < 3
      ? null
      : items
          .map(({ index, value }) => {
            const point = onRay(index, (value * scale) / 100);
            return `${point.x},${point.y}`;
          })
          .join(" ");
  const now = axes.flatMap((axis, index) =>
    axis.value === null ? [] : [{ index, value: axis.value }],
  );
  const before = axes.flatMap((axis, index) =>
    axis.previous === null || axis.previous === undefined
      ? []
      : [{ index, value: axis.previous }],
  );
  const nowShape = polygonOf(now, progress);
  const beforeShape = polygonOf(before, 1);

  return (
    <svg
      className="elfred-ability-radar"
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={`综合能力雷达图：${axes
        .map((axis) => `${axis.label} ${axis.value ?? "未知"}`)
        .join("，")}`}
    >
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={tone} stopOpacity="0.24" />
          <stop offset="100%" stopColor={tone} stopOpacity="0.07" />
        </linearGradient>
      </defs>

      <g>
        {RINGS.map((scale, index) => (
          <polygon
            key={scale}
            points={axes
              .map((_, axisIndex) => {
                const point = onRay(axisIndex, scale);
                return `${point.x},${point.y}`;
              })
              .join(" ")}
            fill={index === 0 ? "#fbfcfd" : "none"}
            stroke="#e3e7ea"
            strokeWidth="1"
          />
        ))}
        {axes.map((axis, index) => {
          const point = onRay(index, 1);
          return (
            <line
              key={`ray-${axis.label}`}
              x1={cx}
              y1={cy}
              x2={point.x}
              y2={point.y}
              stroke="#eaeef1"
              strokeWidth="1"
            />
          );
        })}
      </g>

      {beforeShape && (
        <polygon
          points={beforeShape}
          fill="none"
          stroke="#8d959d"
          strokeWidth="1.5"
          strokeDasharray="5 4"
          strokeLinejoin="round"
        />
      )}
      {nowShape && (
        <polygon
          points={nowShape}
          fill={`url(#${fillId})`}
          stroke={tone}
          strokeWidth="2"
          strokeLinejoin="round"
        />
      )}
      {now.map(({ index, value }) => {
        const point = onRay(index, (value * progress) / 100);
        return (
          <circle
            key={`dot-${axes[index].label}`}
            cx={point.x}
            cy={point.y}
            r="3"
            fill={tone}
            stroke="#fff"
            strokeWidth="1.5"
          />
        );
      })}

      {axes.map((axis, index) => {
        const angle = angleAt(index);
        const cos = Math.cos(angle);
        const anchor =
          cos > 0.25 ? "start" : cos < -0.25 ? "end" : "middle";
        const x = round(cx + labelR * Math.cos(angle));
        const y = round(cy + labelR * Math.sin(angle));
        const top = anchor === "middle";
        const nameY = top ? y - 3 : y;
        const valueY = top ? y + 11 : y + 13;
        const delta =
          axis.value !== null &&
          axis.previous !== null &&
          axis.previous !== undefined
            ? axis.value - axis.previous
            : null;
        const unknown = axis.value === null;
        return (
          <g key={axis.label}>
            <text
              x={x}
              y={nameY}
              textAnchor={anchor}
              fontSize="11"
              fontWeight="600"
              fill={unknown ? "#a8b0b7" : "#5b646c"}
            >
              {axis.label}
            </text>
            <text
              x={x}
              y={valueY}
              textAnchor={anchor}
              fontSize="13"
              fontWeight="700"
              fill={unknown ? "#a8b0b7" : "#171a1d"}
            >
              {axis.value ?? "未知"}
              {delta !== null && (
                <tspan
                  dx="3"
                  fontSize="10.5"
                  fontWeight="600"
                  fill={delta > 0 ? UP : delta < 0 ? DOWN : FLAT}
                >
                  {delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : "—"}
                </tspan>
              )}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── 趋势：一条平滑曲线 + 渐变面积 ───────────────────────────── */

const TREND = { w: 300, h: 112, left: 14, right: 286, top: 14, bottom: 86, labelY: 104 };

export function TrendChart({
  points,
  tone,
  weeks,
  progress,
}: {
  points: number[];
  tone: string;
  weeks: number;
  progress: number;
}) {
  const fillId = `elfredTrendFill-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  if (points.length < 2) return null;
  const drawn = Math.min(1, Math.max(0, progress));
  const areaOpacity = Math.min(1, Math.max(0, (drawn - 0.2) / 0.5));
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = Math.max(1, max - min);
  const spanX = TREND.right - TREND.left;
  const nodes = points.map((value, index) => ({
    x: round(TREND.left + (index * spanX) / (points.length - 1)),
    y: round(TREND.bottom - ((value - min) / span) * (TREND.bottom - TREND.top)),
  }));

  // Catmull-Rom 转三次贝塞尔：点变了线跟着变，不用手调。
  let line = `M${nodes[0].x} ${nodes[0].y}`;
  for (let index = 0; index < nodes.length - 1; index += 1) {
    const p0 = nodes[index - 1] ?? nodes[index];
    const p1 = nodes[index];
    const p2 = nodes[index + 1];
    const p3 = nodes[index + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    line += ` C${round(c1.x)} ${round(c1.y)} ${round(c2.x)} ${round(c2.y)} ${p2.x} ${p2.y}`;
  }
  const last = nodes[nodes.length - 1];

  return (
    <svg
      className="elfred-trend-chart"
      viewBox={`0 0 ${TREND.w} ${TREND.h}`}
      role="img"
      aria-label={`最近 ${weeks} 周的趋势`}
    >
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={tone} stopOpacity="0.22" />
          <stop offset="100%" stopColor={tone} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[TREND.top, (TREND.top + TREND.bottom) / 2, TREND.bottom].map((y) => (
        <line
          key={y}
          x1={TREND.left}
          y1={y}
          x2={TREND.right}
          y2={y}
          stroke="#eef1f3"
          strokeWidth="1"
        />
      ))}
      <path
        d={`${line} L${TREND.right} ${TREND.bottom} L${TREND.left} ${TREND.bottom}Z`}
        fill={`url(#${fillId})`}
        opacity={areaOpacity}
      />
      {/* pathLength=1 把长度归一化，于是"画到一半"就是 dashoffset=0.5，不用自己量长度 */}
      <path
        d={line}
        fill="none"
        stroke={tone}
        strokeWidth="2"
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray="1"
        strokeDashoffset={1 - drawn}
      />
      {nodes.map((node, index) => (
        <circle
          key={`${node.x}-${node.y}`}
          cx={node.x}
          cy={node.y}
          r={index === nodes.length - 1 ? 4 : 2.4}
          fill={tone}
          stroke="#fff"
          strokeWidth="1.5"
          opacity={Math.min(
            1,
            Math.max(0, (drawn - (index / (nodes.length - 1)) * 0.8) / 0.12),
          )}
        />
      ))}
      <circle
        cx={last.x}
        cy={last.y}
        r="7.5"
        fill={tone}
        fillOpacity={0.14 * areaOpacity}
      />
      <text x={TREND.left} y={TREND.labelY} fontSize="10" fill="#9aa2a9">
        第 1 周
      </text>
      <text
        x={TREND.right}
        y={TREND.labelY}
        textAnchor="end"
        fontSize="10"
        fill="#9aa2a9"
      >
        第 {weeks} 周
      </text>
    </svg>
  );
}
