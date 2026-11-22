/**
 * Packs measured blocks into fixed-height pages. Pure: heights in, page
 * assignments out. Units are whatever the caller measured in, as long as
 * they all match. Blocks are never split.
 */

export interface PackItem {
  /** Height of the block itself, without the gap above it. */
  height: number;
  /** Space above the block. Dropped when the block starts a page. */
  gapBefore?: number;
  /** Keep on the same page as the next item, as a heading does. */
  keepWithNext?: boolean;
  /**
   * Table parts share a group. A row that starts its table's run on a page
   * repeats the header row, of height `header`, above it.
   */
  group?: string;
  header?: number;
}

export interface Placed {
  item: number;
  /** First on its page, so no gap above it. */
  first: boolean;
  /** A table row placed with a repeated header row above it. */
  repeatsHeader: boolean;
}

export type PackedPage = Placed[];

/**
 * A page whose content is shorter than this share of the page is too short to
 * stand alone. So is a page holding one block under a quarter page, such as a
 * last table row under its repeated header.
 */
export const SHORT_PAGE = 1 / 6;

function needsHeader(items: readonly PackItem[], it: PackItem, prev: Placed | undefined): boolean {
  if (it.group === undefined || it.header === undefined) return false;
  return !prev || items[prev.item]?.group !== it.group;
}

/** Sets `first` and `repeatsHeader` from each item's place on its page. */
function refresh(items: readonly PackItem[], page: PackedPage): PackedPage {
  return page.map((p, i) => ({
    item: p.item,
    first: i === 0,
    repeatsHeader: needsHeader(items, items[p.item]!, page[i - 1]),
  }));
}

/** Height a packed page uses, as `packPages` counts it. */
export function pageUsed(items: readonly PackItem[], page: PackedPage): number {
  let h = 0;
  for (const p of page) {
    const it = items[p.item]!;
    if (!p.first) h += it.gapBefore ?? 0;
    if (p.repeatsHeader) h += it.header ?? 0;
    h += it.height;
  }
  return h;
}

/**
 * Greedy packing in order. Keep-with-next chains stay together when they fit
 * a page; a block taller than a page gets a page to itself. Then a page that
 * would hold only a short scrap, such as the last table row, takes blocks
 * back from the page before it.
 */
export function packPages(items: readonly PackItem[], height: number): PackedPage[] {
  // A block that fits to within rounding fits.
  const pageHeight = height * (1 + 1e-6);
  const pages: PackedPage[] = [];
  let page: PackedPage = [];
  let used = 0;
  /** Set after an oversized block, so the next block starts a new page. */
  let full = false;

  const newPage = () => {
    if (page.length > 0) pages.push(page);
    page = [];
    used = 0;
    full = false;
  };

  /** Height an item adds when placed next on the current page. */
  const cost = (k: number, prev: Placed | undefined, atTop: boolean): number => {
    const it = items[k]!;
    return (atTop ? 0 : (it.gapBefore ?? 0)) + (needsHeader(items, it, prev) ? (it.header ?? 0) : 0) + it.height;
  };

  /** Height chain i..j adds to the current page, or to an empty one. */
  const chainCost = (i: number, j: number, onEmpty: boolean): number => {
    let h = 0;
    let prev = onEmpty ? undefined : page[page.length - 1];
    for (let k = i; k <= j; k++) {
      h += cost(k, prev, onEmpty ? k === i : page.length === 0 && k === i);
      prev = { item: k, first: false, repeatsHeader: false };
    }
    return h;
  };

  const place = (k: number) => {
    const atTop = page.length === 0;
    const prev = page[page.length - 1];
    used += cost(k, prev, atTop);
    page.push({ item: k, first: atTop, repeatsHeader: needsHeader(items, items[k]!, prev) });
    if (atTop && used > pageHeight) full = true;
  };

  let i = 0;
  while (i < items.length) {
    let j = i;
    while (j < items.length - 1 && items[j]!.keepWithNext) j++;
    if (full) newPage();
    if (page.length > 0 && used + chainCost(i, j, false) > pageHeight) newPage();
    // A chain taller than a page is laid out one block at a time.
    if (j > i && chainCost(i, j, true) > pageHeight) j = i;
    for (let k = i; k <= j; k++) {
      if (full || (page.length > 0 && used + cost(k, page[page.length - 1], false) > pageHeight)) newPage();
      place(k);
    }
    i = j + 1;
  }
  if (page.length > 0) pages.push(page);
  return balance(items, pages, pageHeight);
}

/**
 * When a page holds only a short scrap, move blocks from the end of the page
 * before onto it, keeping keep-with-next chains whole, while both pages
 * still fit and the page before keeps at least one block.
 */
function balance(items: readonly PackItem[], input: PackedPage[], pageHeight: number): PackedPage[] {
  const pages = input.map((p) => refresh(items, p));
  for (let n = 1; n < pages.length; n++) {
    for (;;) {
      const cur = pages[n]!;
      const before = pages[n - 1]!;
      const lone = cur.length === 1 && items[cur[0]!.item]!.height < pageHeight / 4;
      if ((pageUsed(items, cur) >= pageHeight * SHORT_PAGE && !lone) || before.length < 2) break;
      // The block to move, with any chain that leads into it.
      let start = before.length - 1;
      while (start > 0 && items[before[start - 1]!.item]!.keepWithNext) start--;
      if (start === 0) break;
      const nextBefore = refresh(items, before.slice(0, start));
      const nextCur = refresh(items, [...before.slice(start), ...cur]);
      if (pageUsed(items, nextCur) > pageHeight) break;
      pages[n - 1] = nextBefore;
      pages[n] = nextCur;
    }
  }
  return pages;
}
