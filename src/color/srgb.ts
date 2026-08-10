export const decodeSrgb = (channel: number) =>
  channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4

export const encodeSrgb = (channel: number) =>
  channel <= 0.0031308
    ? 12.92 * channel
    : 1.055 * channel ** (1 / 2.4) - 0.055

export const clampUnit = (channel: number) => Math.min(1, Math.max(0, channel))
