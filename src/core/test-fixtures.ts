/** Fake collection for tests: 20 fabrics across 7 designs, grouped by design. */
import type { FabricCollection, FabricDef } from './types';

const DESIGN_SIZES = [3, 3, 3, 3, 3, 3, 2];

export function makeCollection(): FabricCollection {
  const fabrics: FabricDef[] = [];
  DESIGN_SIZES.forEach((count, d) => {
    for (let c = 0; c < count; c++) {
      const id = `d${d}-c${c}`;
      fabrics.push({
        id,
        name: id,
        design: `design${d}`,
        colorway: `c${c}`,
        sku: id,
        image: `/${id}.jpg`,
        thumb: `/${id}-t.jpg`,
        pxPerInch: 100,
        widthPx: 1210,
        heightPx: 1080,
        color: '#808080',
      });
    }
  });
  return { id: 'fake', name: 'Fake', designer: 'Test', manufacturer: 'Test', fabrics };
}
