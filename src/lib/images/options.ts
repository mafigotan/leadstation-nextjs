// Image style and ratio options shared by the client UI and the server.

export const IMAGE_STYLES = {
  photo: ["사진", "Style: realistic, high-quality editorial photograph with natural lighting."],
  illustration: ["일러스트", "Style: clean modern digital illustration, soft shading, harmonious colors."],
  cartoon: ["만화", "Style: friendly cartoon / comic illustration with bold outlines and expressive characters."],
  graphic: ["그래픽", "Style: flat vector graphic design with simple geometric shapes, bold colors and clean composition."],
  infographic: ["인포그래픽", "Style: simple infographic layout with icons, charts and clear visual hierarchy; use minimal text."],
  watercolor: ["수채화", "Style: soft watercolor painting with gentle textures and light washes of color."],
  render3d: ["3D", "Style: polished 3D render with soft studio lighting, clay or glossy materials."],
} as const;
export type ImageStyle = keyof typeof IMAGE_STYLES;

/** [label, width ratio, height ratio] */
export const IMAGE_RATIOS = {
  "1:1": ["1:1 정사각", 1, 1],
  "4:3": ["4:3", 4, 3],
  "3:2": ["3:2", 3, 2],
  "16:9": ["16:9", 16, 9],
  "2:1": ["2:1 와이드", 2, 1],
  "3:1": ["3:1 배너", 3, 1],
  "3:4": ["3:4 세로", 3, 4],
} as const;
export type ImageRatio = keyof typeof IMAGE_RATIOS;
