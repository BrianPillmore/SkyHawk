import { pitchToDegrees } from '../../utils/geometry';

interface PitchDiagramProps {
  pitch: number; // x/12 format
  width?: number;
  height?: number;
}

/**
 * SVG pitch diagram showing a visual cross-section of the roof slope.
 * Displays the pitch triangle with rise/run labels and angle.
 */
export default function PitchDiagram({ pitch, width = 160, height = 100 }: PitchDiagramProps) {
  if (pitch <= 0) {
    return (
      <div className="flex items-center justify-center" style={{ width, height }}>
        <span className="text-xs text-gray-500">Flat (0/12)</span>
      </div>
    );
  }

  const margin = 16;
  const innerW = width - margin * 2;
  const innerH = height - margin * 2;

  // Calculate triangle geometry
  // Run = 12 units, Rise = pitch units
  const maxPitch = 18; // Cap visual at 18/12
  const displayPitch = Math.min(pitch, maxPitch);
  const angle = Math.atan(displayPitch / 12);
  const degrees = pitchToDegrees(pitch);

  // Scale to fit in the SVG
  const scale = Math.min(innerW / 12, innerH / displayPitch);
  const runPx = 12 * scale;
  const risePx = displayPitch * scale;

  // Triangle points (bottom-left origin)
  const baseX = margin;
  const baseY = height - margin;
  const topX = baseX + runPx;
  const topY = baseY - risePx;
  const rightX = baseX + runPx;
  const rightY = baseY;

  // Angle arc
  const arcRadius = Math.min(runPx * 0.25, 20);
  const arcEndX = baseX + arcRadius * Math.cos(angle);
  const arcEndY = baseY - arcRadius * Math.sin(angle);

  return (
    <svg width={width} height={height} className="text-gray-400">
      {/* Triangle fill */}
      <polygon
        points={`${baseX},${baseY} ${topX},${topY} ${rightX},${rightY}`}
        fill="rgba(37, 120, 235, 0.15)"
        stroke="rgba(37, 120, 235, 0.6)"
        strokeWidth="1.5"
      />

      {/* Run line (bottom) */}
      <line x1={baseX} y1={baseY} x2={rightX} y2={rightY} stroke="#6b7280" strokeWidth="1" strokeDasharray="3,3" />

      {/* Rise line (right) */}
      <line x1={rightX} y1={rightY} x2={topX} y2={topY} stroke="#6b7280" strokeWidth="1" strokeDasharray="3,3" />

      {/* Slope line (hypotenuse) */}
      <line x1={baseX} y1={baseY} x2={topX} y2={topY} stroke="#2578eb" strokeWidth="2" />

      {/* Angle arc */}
      <path
        d={`M ${baseX + arcRadius},${baseY} A ${arcRadius} ${arcRadius} 0 0 0 ${arcEndX},${arcEndY}`}
        fill="none"
        stroke="#f59e0b"
        strokeWidth="1.5"
      />

      {/* Labels */}
      {/* Run label */}
      <text x={(baseX + rightX) / 2} y={baseY + 12} textAnchor="middle" fill="#9ca3af" fontSize="9" fontFamily="sans-serif">
        12
      </text>

      {/* Rise label */}
      <text x={rightX + 10} y={(rightY + topY) / 2 + 3} textAnchor="start" fill="#9ca3af" fontSize="9" fontFamily="sans-serif">
        {pitch}
      </text>

      {/* Pitch label on slope */}
      <text
        x={(baseX + topX) / 2 - 8}
        y={(baseY + topY) / 2 - 6}
        textAnchor="middle"
        fill="#2578eb"
        fontSize="10"
        fontWeight="bold"
        fontFamily="sans-serif"
      >
        {pitch}/12
      </text>

      {/* Angle label */}
      <text
        x={baseX + arcRadius + 8}
        y={baseY - 5}
        textAnchor="start"
        fill="#f59e0b"
        fontSize="9"
        fontFamily="sans-serif"
      >
        {degrees.toFixed(1)}&deg;
      </text>

      {/* Right angle indicator */}
      <polyline
        points={`${rightX - 6},${rightY} ${rightX - 6},${rightY - 6} ${rightX},${rightY - 6}`}
        fill="none"
        stroke="#6b7280"
        strokeWidth="1"
      />
    </svg>
  );
}
