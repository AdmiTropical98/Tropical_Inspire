// src/types/grid.ts

export type GridItem = {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type ZoneLayouts = {
  lg: GridItem[];
  md: GridItem[];
  sm: GridItem[];
};
