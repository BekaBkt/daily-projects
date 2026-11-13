import { KEYWORDS, type Bezier } from "./bezier";

export interface Preset {
  name: string;
  value: Bezier;
}

export const PRESETS: Preset[] = [
  ...Object.entries(KEYWORDS).map(([name, value]) => ({ name, value })),
  { name: "out-cubic", value: [0.33, 1, 0.68, 1] },
  { name: "out-expo", value: [0.16, 1, 0.3, 1] },
  { name: "in-out-quart", value: [0.76, 0, 0.24, 1] },
  { name: "in-back", value: [0.36, 0, 0.66, -0.56] },
  { name: "out-back", value: [0.34, 1.56, 0.64, 1] },
  { name: "in-out-back", value: [0.68, -0.6, 0.32, 1.6] },
];
