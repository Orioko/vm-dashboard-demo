const HIGH_USAGE = 85;

export function UsageBar({ value, label, detail }: { value: number; label: string; detail?: string }) {
  return (
    <div className="usage">
      <div
        className="usage__track"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
      >
        <div
          className={`usage__fill${value >= HIGH_USAGE ? ' usage__fill--high' : ''}`}
          style={{ transform: `scaleX(${value / 100})` }}
        />
      </div>
      <span className="usage__value">{value}%</span>
      {detail && <span className="usage__detail">{detail}</span>}
    </div>
  );
}
