/**
 * Zero-Dependency 2D Spatial Quadtree Index
 * Optimized for 60 FPS HTML5 canvas collision detection, point hit-testing,
 * and radius proximity queries without DOM overhead or external dependencies.
 */

export interface SpatialPoint<T> {
  x: number;
  y: number;
  data: T;
}

export interface SpatialBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function createBounds(
  minX: number,
  maxX: number,
  minY: number,
  maxY: number
): SpatialBounds {
  return { minX, maxX, minY, maxY };
}

export function boundsContains(b: SpatialBounds, x: number, y: number): boolean {
  return x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY;
}

export function boundsIntersects(b1: SpatialBounds, b2: SpatialBounds): boolean {
  return !(
    b2.minX > b1.maxX ||
    b2.maxX < b1.minX ||
    b2.minY > b1.maxY ||
    b2.maxY < b1.minY
  );
}

export function boundsIntersectsCircle(
  b: SpatialBounds,
  cx: number,
  cy: number,
  radius: number
): boolean {
  // Find closest point on rectangle to circle center
  const closestX = Math.max(b.minX, Math.min(cx, b.maxX));
  const closestY = Math.max(b.minY, Math.min(cy, b.maxY));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy <= radius * radius;
}

export class SpatialQuadtreeNode<T> {
  bounds: SpatialBounds;
  capacity: number;
  maxDepth: number;
  depth: number;
  points: SpatialPoint<T>[] = [];
  divided = false;

  nw?: SpatialQuadtreeNode<T>;
  ne?: SpatialQuadtreeNode<T>;
  sw?: SpatialQuadtreeNode<T>;
  se?: SpatialQuadtreeNode<T>;

  constructor(
    bounds: SpatialBounds,
    capacity = 12,
    maxDepth = 8,
    depth = 0
  ) {
    this.bounds = bounds;
    this.capacity = capacity;
    this.maxDepth = maxDepth;
    this.depth = depth;
  }

  subdivide(): void {
    const { minX, maxX, minY, maxY } = this.bounds;
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    const nextDepth = this.depth + 1;

    this.nw = new SpatialQuadtreeNode(
      createBounds(minX, midX, minY, midY),
      this.capacity,
      this.maxDepth,
      nextDepth
    );
    this.ne = new SpatialQuadtreeNode(
      createBounds(midX, maxX, minY, midY),
      this.capacity,
      this.maxDepth,
      nextDepth
    );
    this.sw = new SpatialQuadtreeNode(
      createBounds(minX, midX, midY, maxY),
      this.capacity,
      this.maxDepth,
      nextDepth
    );
    this.se = new SpatialQuadtreeNode(
      createBounds(midX, maxX, midY, maxY),
      this.capacity,
      this.maxDepth,
      nextDepth
    );

    this.divided = true;

    // Distribute existing points to children
    const existing = this.points;
    this.points = [];
    for (const p of existing) {
      this.insertToChild(p);
    }
  }

  private insertToChild(p: SpatialPoint<T>): boolean {
    if (this.nw && boundsContains(this.nw.bounds, p.x, p.y)) return this.nw.insert(p);
    if (this.ne && boundsContains(this.ne.bounds, p.x, p.y)) return this.ne.insert(p);
    if (this.sw && boundsContains(this.sw.bounds, p.x, p.y)) return this.sw.insert(p);
    if (this.se && boundsContains(this.se.bounds, p.x, p.y)) return this.se.insert(p);
    return false;
  }

  insert(p: SpatialPoint<T>): boolean {
    if (!boundsContains(this.bounds, p.x, p.y)) {
      return false;
    }

    if (!this.divided) {
      if (this.points.length < this.capacity || this.depth >= this.maxDepth) {
        this.points.push(p);
        return true;
      }
      this.subdivide();
    }

    return this.insertToChild(p);
  }

  queryRadius(
    cx: number,
    cy: number,
    radius: number,
    results: SpatialPoint<T>[]
  ): void {
    if (!boundsIntersectsCircle(this.bounds, cx, cy, radius)) {
      return;
    }

    const rSq = radius * radius;

    if (!this.divided) {
      for (const p of this.points) {
        const dx = p.x - cx;
        const dy = p.y - cy;
        if (dx * dx + dy * dy <= rSq) {
          results.push(p);
        }
      }
      return;
    }

    this.nw?.queryRadius(cx, cy, radius, results);
    this.ne?.queryRadius(cx, cy, radius, results);
    this.sw?.queryRadius(cx, cy, radius, results);
    this.se?.queryRadius(cx, cy, radius, results);
  }

  findClosest(
    cx: number,
    cy: number,
    best: { point: SpatialPoint<T> | null; distSq: number }
  ): void {
    // If the box is further than our best distance, prune
    const closestBoxX = Math.max(this.bounds.minX, Math.min(cx, this.bounds.maxX));
    const closestBoxY = Math.max(this.bounds.minY, Math.min(cy, this.bounds.maxY));
    const boxDistSq =
      (cx - closestBoxX) * (cx - closestBoxX) + (cy - closestBoxY) * (cy - closestBoxY);

    if (boxDistSq > best.distSq) {
      return;
    }

    if (!this.divided) {
      for (const p of this.points) {
        const dx = p.x - cx;
        const dy = p.y - cy;
        const dSq = dx * dx + dy * dy;
        if (dSq < best.distSq) {
          best.distSq = dSq;
          best.point = p;
        }
      }
      return;
    }

    // Sort children by distance to test closest first
    const children = [this.nw, this.ne, this.sw, this.se].filter(Boolean) as SpatialQuadtreeNode<T>[];
    children.sort((a, b) => {
      const aX = Math.max(a.bounds.minX, Math.min(cx, a.bounds.maxX));
      const aY = Math.max(a.bounds.minY, Math.min(cy, a.bounds.maxY));
      const bX = Math.max(b.bounds.minX, Math.min(cx, b.bounds.maxX));
      const bY = Math.max(b.bounds.minY, Math.min(cy, b.bounds.maxY));
      const aDist = (cx - aX) * (cx - aX) + (cy - aY) * (cy - aY);
      const bDist = (cx - bX) * (cx - bX) + (cy - bY) * (cy - bY);
      return aDist - bDist;
    });

    for (const child of children) {
      child.findClosest(cx, cy, best);
    }
  }
}

export class SpatialQuadtree<T> {
  root: SpatialQuadtreeNode<T>;
  bounds: SpatialBounds;

  constructor(bounds: SpatialBounds, capacity = 12, maxDepth = 8) {
    this.bounds = bounds;
    this.root = new SpatialQuadtreeNode(bounds, capacity, maxDepth);
  }

  static fromPoints<T>(
    points: Array<{ x: number; y: number; data: T }>,
    padding = 100
  ): SpatialQuadtree<T> {
    if (points.length === 0) {
      return new SpatialQuadtree<T>(createBounds(-1000, 1000, -1000, 1000));
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    const bounds = createBounds(
      minX - padding,
      maxX + padding,
      minY - padding,
      maxY + padding
    );

    const tree = new SpatialQuadtree<T>(bounds);
    for (const p of points) {
      tree.insert(p.x, p.y, p.data);
    }
    return tree;
  }

  insert(x: number, y: number, data: T): boolean {
    return this.root.insert({ x, y, data });
  }

  findInRadius(cx: number, cy: number, radius: number): SpatialPoint<T>[] {
    const results: SpatialPoint<T>[] = [];
    this.root.queryRadius(cx, cy, radius, results);
    return results;
  }

  findClosest(
    cx: number,
    cy: number,
    maxRadius = Infinity
  ): { point: SpatialPoint<T>; distance: number } | null {
    const best = {
      point: null as SpatialPoint<T> | null,
      distSq: maxRadius * maxRadius,
    };
    this.root.findClosest(cx, cy, best);

    if (best.point) {
      return {
        point: best.point,
        distance: Math.sqrt(best.distSq),
      };
    }
    return null;
  }
}

