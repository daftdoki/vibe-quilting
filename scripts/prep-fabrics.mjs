// Prepares a fabric collection for the app.
//
// Usage: node scripts/prep-fabrics.mjs [collection-id]
//
// For each source JPEG in assets-src/fabrics/<collection-id>/, this writes a
// cropped swatch and a square thumbnail to public/fabrics/<collection-id>/,
// then generates src/fabrics/<collection-id>/index.ts.
//
// Fabric ids are permanent. Saved quilts and data files store them, so an id
// is the lowercase file stem (for example "rs5027-50m-bright-blue") and must
// never change. Do not rename a source file or change a namePattern in a way
// that changes an existing id. If an id must change, add the old id to the
// collection's `aliases` instead.

import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const COLLECTIONS = {
  'happy-place': {
    name: 'Happy Place',
    designer: 'Annabel Wrigley',
    manufacturer: 'Windham Fabrics',
    // Ruler measurement: image pixels per inch of real fabric.
    pxPerInch: 71.4,
    // The fabric is the top rows of each image. The ruler strip sits below.
    // No width means the full image width.
    crop: { height: 770 },
    // File name: <code>-<number><suffix>-<Colorway-With-Dashes>.jpg
    namePattern: /^(?<code>\d{5}D)-(?<number>\d+)(?<suffix>)-(?<colorway>.+)\.jpg$/i,
    designs: {
      '55372D': 'Log Cabin',
      '55373D': 'Passage',
      '55374D': 'Diamonds',
      '55375D': 'Crossing',
      '55376D': 'Window',
      '55377D': 'Tower',
      '55378D': 'Freewheel',
    },
  },
  'ruby-star': {
    name: 'Ruby Star',
    designer: 'Rashida Coleman-Hale and Alexia Abegg',
    manufacturer: 'Ruby Star Society for Moda',
    // Ruler measurement: inch ticks 81.9 px apart in the 900 px scans.
    pxPerInch: 81.9,
    // The scans are 900 x 900. The fabric ends at y = 854 and the ruler band
    // starts at y = 855. Both top corners are white rounded corners that reach
    // 32 px in from each edge. The crop starts at y = 32 and stops at y = 849,
    // so it holds no corner and no ruler. It is 870 wide, which also trims the
    // right edge.
    crop: { left: 0, top: 32, width: 870, height: 818 },
    // File name: <code>-<number><letters>-<Colorway-With-Dashes>.jpg
    namePattern: /^(?<code>RS\d{4})-(?<number>\d+)(?<suffix>[A-Z]*)-(?<colorway>.+)\.jpg$/i,
    designs: {
      RS5027: 'Speckled',
      RS4109: 'Starry',
    },
  },
};

const THUMB_PX = 160;
const SWATCH_QUALITY = 88;
const THUMB_QUALITY = 80;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const collectionId = process.argv[2] ?? 'happy-place';
const config = COLLECTIONS[collectionId];
if (!config) {
  throw new Error(`Unknown collection "${collectionId}". Add it to COLLECTIONS.`);
}

const srcDir = path.join(root, 'assets-src', 'fabrics', collectionId);
const outDir = path.join(root, 'public', 'fabrics', collectionId);
const tsDir = path.join(root, 'src', 'fabrics', collectionId);

function toHex([r, g, b]) {
  return (
    '#' +
    [r, g, b]
      .map((v) => Math.round(v).toString(16).padStart(2, '0'))
      .join('')
  );
}

function tsString(value) {
  return "'" + value.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

async function prepare(file) {
  const match = config.namePattern.exec(file);
  if (!match) {
    throw new Error(`File name does not match the pattern for ${collectionId}: ${file}`);
  }
  const { code, number, suffix, colorway: colorwayDashed } = match.groups;
  const designCode = code.toUpperCase();
  const design = config.designs[designCode];
  if (!design) {
    throw new Error(`No design name for code ${designCode} in ${file}`);
  }

  const id = file.replace(/\.jpg$/i, '').toLowerCase();
  const input = path.join(srcDir, file);
  const { width, height } = await sharp(input).metadata();
  if (width === undefined || height === undefined) {
    throw new Error(`Could not read dimensions of ${file}`);
  }
  const left = config.crop.left ?? 0;
  const top = config.crop.top ?? 0;
  const cropWidth = config.crop.width ?? width - left;
  const cropHeight = config.crop.height;
  if (left + cropWidth > width || top + cropHeight > height) {
    throw new Error(`Crop ${cropWidth}x${cropHeight} at ${left},${top} does not fit image ${width}x${height} in ${file}`);
  }

  // The fabric: the crop rectangle, without the ruler or the rounded corner.
  const fabric = await sharp(input)
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .toBuffer();

  await sharp(fabric)
    .jpeg({ quality: SWATCH_QUALITY })
    .toFile(path.join(outDir, `${id}.jpg`));

  // Thumbnail: the largest centered square of the fabric, scaled down.
  const side = Math.min(cropWidth, cropHeight);
  await sharp(fabric)
    .extract({
      left: Math.floor((cropWidth - side) / 2),
      top: Math.floor((cropHeight - side) / 2),
      width: side,
      height: side,
    })
    .resize(THUMB_PX, THUMB_PX)
    .jpeg({ quality: THUMB_QUALITY })
    .toFile(path.join(outDir, `${id}.thumb.jpg`));

  const { channels } = await sharp(fabric).stats();
  const color = toHex(channels.slice(0, 3).map((c) => c.mean));

  return {
    id,
    designCode,
    number: Number(number),
    suffix: suffix.toUpperCase(),
    design,
    colorway: colorwayDashed.replace(/-/g, ' '),
    sku: `${designCode}-${number}${suffix.toUpperCase()}`,
    width: cropWidth,
    height: cropHeight,
    color,
  };
}

function renderIndex(fabrics) {
  const lines = [];
  lines.push('// Generated by scripts/prep-fabrics.mjs. Do not edit by hand.');
  lines.push("import { asset } from '../../core/asset';");
  lines.push("import type { FabricCollection } from '../../core/types';");
  lines.push('');
  lines.push(`export const ${camelName(collectionId)}: FabricCollection = {`);
  lines.push(`  id: ${tsString(collectionId)},`);
  lines.push(`  name: ${tsString(config.name)},`);
  lines.push(`  designer: ${tsString(config.designer)},`);
  lines.push(`  manufacturer: ${tsString(config.manufacturer)},`);
  lines.push('  fabrics: [');
  for (const f of fabrics) {
    lines.push('    {');
    lines.push(`      id: ${tsString(f.id)},`);
    lines.push(`      name: ${tsString(`${f.design} · ${f.colorway}`)},`);
    lines.push(`      design: ${tsString(f.design)},`);
    lines.push(`      colorway: ${tsString(f.colorway)},`);
    lines.push(`      sku: ${tsString(f.sku)},`);
    lines.push(`      image: asset(${tsString(`fabrics/${collectionId}/${f.id}.jpg`)}),`);
    lines.push(`      thumb: asset(${tsString(`fabrics/${collectionId}/${f.id}.thumb.jpg`)}),`);
    lines.push(`      pxPerInch: ${config.pxPerInch},`);
    lines.push(`      widthPx: ${f.width},`);
    lines.push(`      heightPx: ${f.height},`);
    lines.push(`      color: ${tsString(f.color)},`);
    lines.push('    },');
  }
  lines.push('  ],');
  lines.push('};');
  lines.push('');
  return lines.join('\n');
}

// "happy-place" becomes "happyPlace", the export name.
function camelName(id) {
  return id.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
}

const files = (await readdir(srcDir)).filter((f) => /\.jpg$/i.test(f));
if (files.length === 0) {
  throw new Error(`No JPEGs found in ${srcDir}`);
}

await mkdir(outDir, { recursive: true });
await mkdir(tsDir, { recursive: true });

const results = [];
for (const file of files) {
  const result = await prepare(file);
  results.push(result);
  console.log(`${result.id}  ${result.color}  ${result.sku}`);
}

// Sort by design code, then by the number in the SKU (numeric), then by its letters.
results.sort((a, b) => {
  if (a.designCode !== b.designCode) return a.designCode < b.designCode ? -1 : 1;
  if (a.number !== b.number) return a.number - b.number;
  return a.suffix < b.suffix ? -1 : a.suffix > b.suffix ? 1 : 0;
});

const indexPath = path.join(tsDir, 'index.ts');
await writeFile(indexPath, renderIndex(results));
console.log(`Wrote ${results.length} fabrics to ${path.relative(root, indexPath)}`);
