# Color model references

`machadoMatrices.ts` contains the protanomaly and deuteranomaly matrices at
severity steps 0.0–1.0 from the Machado 2010 precomputed dataset. The values
were checked against the Colour Science project implementation:

- Machado, G. M., Oliveira, M. M., & Fernandes, L. A. F. (2009), “A
  Physiologically-based Model for Simulation of Color Vision Deficiency,”
  IEEE TVCG 15(6), 1291–1298. DOI: 10.1109/TVCG.2009.113.
- Machado, G. M. (2010), *A model for simulation of color vision deficiency
  and a color contrast enhancement technique for dichromats*.
- Colour Science reference dataset:
  <https://github.com/colour-science/colour/blob/develop/colour/blindness/datasets/machado2010.py>
  (BSD-3-Clause).

Simulation decodes gamma-encoded sRGB to linear light, applies an interpolated
3×3 matrix, encodes to sRGB, and clamps only the final display values.

For severities between table entries, this project interpolates between the
lower and upper surrounding samples. This intentionally avoids the upper-bin
backward extrapolation produced by Colour 0.4.7's `searchsorted` implementation
for values such as 0.15.
