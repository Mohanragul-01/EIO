/**
 * ProgressRing - how close the last session came to a rung's goal.
 *
 * The share is also written in the middle as a percentage, so the ring is
 * never the only way to read it. Drawn in the calisthenics accent.
 */
export function ProgressRing({ progress, size = 44 }: { progress: number; size?: number }) {
  const stroke = 4;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const share = Math.max(0, Math.min(1, progress));
  return (
    <span className="fx-ring" style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--accent-cyan)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference * share} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="fx-ring-label numeric">{Math.round(share * 100)}%</span>
    </span>
  );
}
