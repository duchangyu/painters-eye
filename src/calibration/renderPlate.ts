import type { SrgbColor, Stimulus } from '../domain/calibration'

function toCssColor(color: SrgbColor): string {
  const channels = color.map((channel) => Math.round(channel * 255))
  return `rgb(${channels[0]} ${channels[1]} ${channels[2]})`
}

export function renderPlate(
  context: CanvasRenderingContext2D,
  stimulus: Stimulus,
  width: number,
  height: number,
) {
  context.clearRect(0, 0, width, height)
  const radiusScale = Math.min(width, height)

  for (const dot of stimulus.dots) {
    context.beginPath()
    context.arc(
      dot.center[0] * width,
      dot.center[1] * height,
      dot.radius * radiusScale,
      0,
      Math.PI * 2,
    )
    context.fillStyle = toCssColor(dot.color)
    context.fill()
  }
}
