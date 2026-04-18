import React, { useMemo } from 'react'
import { Box, Typography } from '@mui/material'

/**
 * Tiny inline line chart — one or more series across a shared x-axis.
 * No axis libraries, just SVG polyline.
 *
 * Props:
 *   lines  — [{ label, color, points: [[x, y], ...] }]
 *   width  — viewport CSS width (default 240)
 *   height — viewport CSS height (default 80)
 *   xLabel — optional label for the x-axis ("Level 1 … 99")
 */
export default function FormulaSparkline({ lines, width = 240, height = 80, xLabel }) {
  const vbW = 100
  const vbH = 40
  const pad = { t: 2, r: 4, b: 2, l: 4 }

  const { svgLines, xRange, yRange } = useMemo(() => {
    if (!lines?.length) return { svgLines: [], xRange: [0, 1], yRange: [0, 1] }
    const all = lines.flatMap((l) => l.points)
    if (!all.length) return { svgLines: [], xRange: [0, 1], yRange: [0, 1] }
    const xs = all.map((p) => p[0])
    const ys = all.map((p) => p[1])
    const xMin = Math.min(...xs)
    const xMax = Math.max(...xs)
    let yMin = Math.min(...ys)
    let yMax = Math.max(...ys)
    if (yMin === yMax) {
      yMin -= 1
      yMax += 1
    } // avoid zero-height
    const xSpan = xMax - xMin || 1
    const ySpan = yMax - yMin || 1
    const plotW = vbW - pad.l - pad.r
    const plotH = vbH - pad.t - pad.b
    const toX = (x) => pad.l + ((x - xMin) / xSpan) * plotW
    const toY = (y) => pad.t + plotH - ((y - yMin) / ySpan) * plotH

    const svg = lines.map((l) => ({
      label: l.label,
      color: l.color,
      d: l.points
        .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${toX(x).toFixed(2)} ${toY(y).toFixed(2)}`)
        .join(' ')
    }))
    return { svgLines: svg, xRange: [xMin, xMax], yRange: [yMin, yMax] }
  }, [lines])

  return (
    <Box sx={{ width, p: 1 }}>
      <svg viewBox={`0 0 ${vbW} ${vbH}`} width={width} height={height} style={{ display: 'block' }}>
        {/* Baseline */}
        <line
          x1={pad.l}
          y1={vbH - pad.b}
          x2={vbW - pad.r}
          y2={vbH - pad.b}
          stroke="currentColor"
          strokeOpacity="0.15"
          strokeWidth="0.3"
        />
        {svgLines.map((l, i) => (
          <path
            key={i}
            d={l.d}
            fill="none"
            stroke={l.color}
            strokeWidth="0.8"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
      </svg>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
        <Typography
          variant="caption"
          sx={{
            color: "text.secondary",
            fontSize: 10
          }}>
          {xLabel || `x ${xRange[0]}…${xRange[1]}`}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: "text.secondary",
            fontSize: 10
          }}>
          y {yRange[0].toFixed(0)}…{yRange[1].toFixed(0)}
        </Typography>
      </Box>
      {lines?.length > 1 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.5 }}>
          {lines.map((l, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 8, height: 8, bgcolor: l.color, borderRadius: 0.5 }} />
              <Typography variant="caption" sx={{ fontSize: 10 }}>
                {l.label}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
