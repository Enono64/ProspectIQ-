import { useEffect, useRef } from 'react'

// Dimensions du radar
const SIZE   = 240
const CENTER = SIZE / 2
const LEVELS = 5

// Les 6 axes du radar scout
const AXES = [
  { key: 'scoring',    label: 'Scoring',    color: '#E8601C' },
  { key: 'playmaking', label: 'Playmaking', color: '#7F77DD' },
  { key: 'defense',    label: 'Défense',    color: '#1D9E75' },
  { key: 'efficiency', label: 'Efficacité', color: '#5DCAA5' },
  { key: 'athleticism',label: 'Athlétisme', color: '#EF9F27' },
  { key: 'impact',     label: 'Impact',     color: '#85B7EB' },
]

// Calcule les scores radar depuis les stats du joueur (0-10)
export function computeRadarScores(player) {
  const norm = (val, min, max) => {
    if (val == null) return 0
    return Math.min(10, Math.max(0, ((val - min) / (max - min)) * 10))
  }

  return {
    scoring:     norm(player.pts,     0,  35),
    playmaking:  norm(player.ast,     0,  12),
    defense:     norm((player.stl || 0) + (player.blk || 0), 0, 5),
    efficiency:  norm(player.ts_pct,  40, 70),
    athleticism: norm(player.usg_pct, 10, 35),
    impact:      norm((player.bpm || 0) + 5, 0, 15),
  }
}

function polarToCart(angle, radius) {
  const rad = (angle - 90) * (Math.PI / 180)
  return {
    x: CENTER + radius * Math.cos(rad),
    y: CENTER + radius * Math.sin(rad),
  }
}

function buildPath(scores, maxRadius) {
  const n = AXES.length
  return AXES.map((axis, i) => {
    const angle = (360 / n) * i
    const r = (scores[axis.key] / 10) * maxRadius
    const { x, y } = polarToCart(angle, r)
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ') + ' Z'
}

export default function RadarChart({ player }) {
  const maxRadius = CENTER - 28

  if (!player) return null

  const scores = computeRadarScores(player)
  const n = AXES.length

  // Points de la grille
  const gridLevels = Array.from({ length: LEVELS }, (_, i) => (i + 1) / LEVELS)

  // Points des axes
  const axisPoints = AXES.map((_, i) => {
    const angle = (360 / n) * i
    return polarToCart(angle, maxRadius)
  })

  // Path du joueur
  const playerPath = buildPath(scores, maxRadius)

  return (
    <div className="card p-4">
      <div className="text-xs text-txt-muted uppercase tracking-widest mb-3">Profil scout</div>
      <div className="flex items-center justify-center">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>

          {/* Grille de fond */}
          {gridLevels.map((level, li) => (
            <polygon
              key={li}
              points={AXES.map((_, i) => {
                const angle = (360 / n) * i
                const { x, y } = polarToCart(angle, maxRadius * level)
                return `${x.toFixed(1)},${y.toFixed(1)}`
              }).join(' ')}
              fill="none"
              stroke="#1e1e2a"
              strokeWidth="0.5"
            />
          ))}

          {/* Axes */}
          {axisPoints.map((pt, i) => (
            <line
              key={i}
              x1={CENTER} y1={CENTER}
              x2={pt.x.toFixed(1)} y2={pt.y.toFixed(1)}
              stroke="#1e1e2a"
              strokeWidth="0.5"
            />
          ))}

          {/* Zone du joueur */}
          <path
            d={playerPath}
            fill="#E8601C"
            fillOpacity="0.15"
            stroke="#E8601C"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />

          {/* Points sur les axes */}
          {AXES.map((axis, i) => {
            const angle = (360 / n) * i
            const r = (scores[axis.key] / 10) * maxRadius
            const { x, y } = polarToCart(angle, r)
            return (
              <circle
                key={i}
                cx={x.toFixed(1)} cy={y.toFixed(1)}
                r="3"
                fill="#E8601C"
                stroke="#0a0a0f"
                strokeWidth="1"
              />
            )
          })}

          {/* Labels des axes */}
          {AXES.map((axis, i) => {
            const angle = (360 / n) * i
            const { x, y } = polarToCart(angle, maxRadius + 16)
            const anchor = x < CENTER - 5 ? 'end' : x > CENTER + 5 ? 'start' : 'middle'
            return (
              <text
                key={i}
                x={x.toFixed(1)} y={(y + 4).toFixed(1)}
                textAnchor={anchor}
                fill="#5a5a7a"
                fontSize="9"
                fontFamily="Inter, sans-serif"
                fontWeight="500"
                letterSpacing="0.04em"
              >
                {axis.label.toUpperCase()}
              </text>
            )
          })}

          {/* Scores sur les axes */}
          {AXES.map((axis, i) => {
            const angle = (360 / n) * i
            const r = (scores[axis.key] / 10) * maxRadius
            const { x, y } = polarToCart(angle, r)
            if (scores[axis.key] < 1) return null
            return (
              <text
                key={i}
                x={(x + (x > CENTER ? 6 : x < CENTER ? -6 : 0)).toFixed(1)}
                y={(y + (y > CENTER ? 5 : -2)).toFixed(1)}
                textAnchor="middle"
                fill="#e8e8f0"
                fontSize="8"
                fontFamily="JetBrains Mono, monospace"
                fontWeight="500"
              >
                {scores[axis.key].toFixed(1)}
              </text>
            )
          })}
        </svg>
      </div>

      {/* Légende scores */}
      <div className="grid grid-cols-3 gap-1.5 mt-3">
        {AXES.map(axis => (
          <div key={axis.key} className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: axis.color }} />
            <span className="text-[10px] text-txt-muted">{axis.label}</span>
            <span className="text-[10px] font-mono ml-auto" style={{ color: axis.color }}>
              {scores[axis.key].toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
