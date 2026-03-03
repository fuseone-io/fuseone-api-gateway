"use client"

interface SLAGaugeProps {
  value: number
  label: string
  size?: number
  strokeWidth?: number
}

function getColor(value: number): string {
  if (value >= 99) return "#16a34a" // green-600
  if (value >= 95) return "#d97706" // amber-600
  return "#dc2626" // red-600
}

function getTrackColor(value: number): string {
  if (value >= 99) return "rgba(22, 163, 74, 0.15)"
  if (value >= 95) return "rgba(217, 119, 6, 0.15)"
  return "rgba(220, 38, 38, 0.15)"
}

export function SLAGauge({ value, label, size = 120, strokeWidth = 10 }: SLAGaugeProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clampedValue = Math.min(100, Math.max(0, value))
  // Arc fills from 270deg (top) clockwise. We use 75% of circle for the gauge arc.
  const arcLength = circumference * 0.75
  const filledLength = arcLength * (clampedValue / 100)
  const gapLength = arcLength - filledLength

  const color = getColor(clampedValue)
  const trackColor = getTrackColor(clampedValue)
  const center = size / 2

  // Start angle: 135deg (bottom-left), sweep 270deg clockwise
  const startAngle = 135

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
          strokeDasharray={`${arcLength} ${circumference - arcLength}`}
          strokeDashoffset={-circumference * 0.375}
          strokeLinecap="round"
          transform={`rotate(${startAngle} ${center} ${center})`}
          style={{ transformOrigin: `${center}px ${center}px` }}
        />
        {/* Filled arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${filledLength} ${circumference - filledLength}`}
          strokeDashoffset={-circumference * 0.375}
          strokeLinecap="round"
          transform={`rotate(${startAngle} ${center} ${center})`}
          style={{
            transformOrigin: `${center}px ${center}px`,
            transition: "stroke-dasharray 0.6s ease",
          }}
        />
        {/* Center text */}
        <text
          x={center}
          y={center - 2}
          textAnchor="middle"
          dominantBaseline="central"
          className="font-bold"
          style={{ fontSize: size * 0.2, fill: color }}
        >
          {clampedValue.toFixed(1)}%
        </text>
        {/* Hidden arc gap */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="transparent"
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference - arcLength} ${arcLength}`}
          strokeDashoffset={-circumference * 0.375 - arcLength}
          transform={`rotate(${startAngle} ${center} ${center})`}
          style={{ transformOrigin: `${center}px ${center}px` }}
        />
      </svg>
      <span className="text-xs font-medium text-muted-foreground text-center leading-tight">
        {label}
      </span>
    </div>
  )
}
