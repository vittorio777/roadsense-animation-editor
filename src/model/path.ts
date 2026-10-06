export interface Point {
  x: number;
  y: number;
}

export interface PathSegment {
  id: string;
  fromPointId: string;
  toPointId: string;
  type: "cubicBezier";
  control1: Point;
  control2: Point;
}
