export const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
out vec2 v_uv;

void main() {
  v_uv = vec2(a_position.x * 0.5 + 0.5, 1.0 - (a_position.y * 0.5 + 0.5));
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

export const FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform sampler2D u_source;
uniform highp sampler3D u_lut;
uniform float u_strength;
uniform float u_lut_size;
in vec2 v_uv;
out vec4 out_color;

void main() {
  vec4 source = texture(u_source, v_uv);
  vec3 lut_coord = (source.rgb * (u_lut_size - 1.0) + 0.5) / u_lut_size;
  vec3 transformed = texture(u_lut, lut_coord).rgb;
  out_color = vec4(mix(source.rgb, transformed, u_strength), source.a);
}
`
