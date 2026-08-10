export interface ProgressBarProps {
  readonly value: number
  readonly max: number
  readonly label: string
}

export function ProgressBar({ value, max, label }: ProgressBarProps) {
  const percentage = max === 0 ? 0 : Math.round((value / max) * 100)

  return (
    <div className="progress-block">
      <div className="progress-copy">
        <span>{label}</span>
        <span>{percentage}%</span>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
      >
        <span style={{ width: `${percentage}%` }} />
      </div>
    </div>
  )
}
