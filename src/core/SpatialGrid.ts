/** Uniform grid for fast neighbour queries (separation, AoE, targeting). */
export interface GridItem {
  x: number;
  y: number;
  active: boolean;
}

export class SpatialGrid<T extends GridItem> {
  private cells = new Map<number, T[]>();
  private readonly inv: number;

  constructor(cellSize: number) {
    this.inv = 1 / cellSize;
  }

  private key(cx: number, cy: number): number {
    return (cx + 512) * 4096 + (cy + 512);
  }

  rebuild(items: Iterable<T>): void {
    for (const arr of this.cells.values()) arr.length = 0;
    for (const it of items) {
      if (!it.active) continue;
      const k = this.key(Math.floor(it.x * this.inv), Math.floor(it.y * this.inv));
      let arr = this.cells.get(k);
      if (!arr) {
        arr = [];
        this.cells.set(k, arr);
      }
      arr.push(it);
    }
  }

  /** Calls fn for each item whose cell overlaps the query circle (caller does exact test). */
  forEachNear(x: number, y: number, radius: number, fn: (item: T) => void): void {
    const minX = Math.floor((x - radius) * this.inv);
    const maxX = Math.floor((x + radius) * this.inv);
    const minY = Math.floor((y - radius) * this.inv);
    const maxY = Math.floor((y + radius) * this.inv);
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cy = minY; cy <= maxY; cy++) {
        const arr = this.cells.get(this.key(cx, cy));
        if (!arr) continue;
        for (let i = 0; i < arr.length; i++) fn(arr[i]);
      }
    }
  }

  queryCircle(x: number, y: number, radius: number, out: T[] = []): T[] {
    const r2 = radius * radius;
    this.forEachNear(x, y, radius, (it) => {
      const dx = it.x - x;
      const dy = it.y - y;
      if (dx * dx + dy * dy <= r2 && it.active) out.push(it);
    });
    return out;
  }

  nearest(x: number, y: number, maxRadius: number, filter?: (item: T) => boolean): T | undefined {
    let best: T | undefined;
    let bestD = maxRadius * maxRadius;
    this.forEachNear(x, y, maxRadius, (it) => {
      if (!it.active || (filter && !filter(it))) return;
      const dx = it.x - x;
      const dy = it.y - y;
      const d = dx * dx + dy * dy;
      if (d <= bestD) {
        bestD = d;
        best = it;
      }
    });
    return best;
  }
}
