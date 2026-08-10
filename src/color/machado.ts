import type { SrgbColor } from '../domain/calibration'
import { MACHADO_MATRICES, type RedGreenDeficiency } from './machadoMatrices'
import { interpolateMatrix3, multiplyMatrix3, type Matrix3 } from './matrix'
import { clampUnit, decodeSrgb, encodeSrgb } from './srgb'

function assertUnit(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${label} must be a finite number in [0, 1]`)
  }
}

export function getMachadoMatrix(
  deficiency: RedGreenDeficiency,
  severity: number,
): Matrix3 {
  assertUnit(severity, 'severity')

  const scaled = severity * 10
  const lowerIndex = Math.floor(scaled)
  const upperIndex = Math.ceil(scaled)
  const matrices = MACHADO_MATRICES[deficiency]
  const lower = matrices[lowerIndex]
  const upper = matrices[upperIndex]

  if (!lower || !upper) {
    throw new RangeError('severity does not map to a reference matrix')
  }

  return interpolateMatrix3(lower, upper, scaled - lowerIndex)
}

export function simulateCvd(
  color: SrgbColor,
  deficiency: RedGreenDeficiency,
  severity: number,
): SrgbColor {
  color.forEach((channel, index) => assertUnit(channel, `color[${index}]`))

  const linear: SrgbColor = [
    decodeSrgb(color[0]),
    decodeSrgb(color[1]),
    decodeSrgb(color[2]),
  ]
  const simulated = multiplyMatrix3(
    getMachadoMatrix(deficiency, severity),
    linear,
  )

  return [
    clampUnit(encodeSrgb(simulated[0])),
    clampUnit(encodeSrgb(simulated[1])),
    clampUnit(encodeSrgb(simulated[2])),
  ]
}
