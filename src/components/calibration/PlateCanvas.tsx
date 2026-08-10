import { useEffect, useRef } from 'react'
import { renderPlate } from '../../calibration/renderPlate'
import type { Stimulus, TargetDirection } from '../../domain/calibration'

const ANSWERS: readonly {
  direction: TargetDirection
  label: string
  symbol: string
}[] = [
  { direction: 'up', label: '向上', symbol: '↑' },
  { direction: 'right', label: '向右', symbol: '→' },
  { direction: 'down', label: '向下', symbol: '↓' },
  { direction: 'left', label: '向左', symbol: '←' },
]

export interface PlateCanvasProps {
  readonly stimulus: Stimulus
  readonly width: number
  readonly height: number
  readonly onAnswer: (direction: TargetDirection) => void
  readonly disabled?: boolean
}

export function PlateCanvas({
  stimulus,
  width,
  height,
  onAnswer,
  disabled = false,
}: PlateCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const context = canvasRef.current?.getContext('2d')
    if (context) {
      renderPlate(context, stimulus, width, height)
    }
  }, [height, stimulus, width])

  return (
    <div className="plate-test">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="辨认圆环开口方向"
        width={width}
        height={height}
      />
      <fieldset className="answer-pad">
        <legend>请选择开口方向</legend>
        {ANSWERS.map(({ direction, label, symbol }) => (
          <button
            key={direction}
            type="button"
            aria-label={label}
            disabled={disabled}
            onClick={() => onAnswer(direction)}
          >
            <span aria-hidden="true">{symbol}</span>
          </button>
        ))}
      </fieldset>
    </div>
  )
}
