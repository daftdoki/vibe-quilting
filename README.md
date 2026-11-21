# Vibe Quilting

Mock up a quilt on your phone. Pick a pattern and a fabric collection, then drag fabrics onto the pieces. Prints draw at their real size, so the mockup shows how the sewn quilt will look.

The first project is the Stacks pattern with the Happy Place fat quarter bundle.

## Run it

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:5173. The dev server also listens on your local network, so a phone on the same wifi can open `http://<your-computer>:5173`.

```bash
npm test
```

## How the repo is organized

A project pairs one pattern with one fabric collection. Patterns and collections are data, and the core and UI code work with any of them.

| Path | What lives there |
| --- | --- |
| `src/core/` | Shared types, design state, geometry, storage. No DOM code. |
| `src/patterns/<id>/` | One pattern: block pieces as polygons in finished inches, the size list, and the pattern's fabric shuffle. |
| `src/fabrics/<id>/` | One fabric collection manifest. Generated, do not edit by hand. |
| `src/projects/` | Pattern and collection pairings, and the project registry. |
| `src/ui/` | The React app. |
| `assets-src/fabrics/<id>/` | Original swatch images, before cropping. |
| `public/fabrics/<id>/` | Cropped swatches and thumbnails that the app serves. |
| `scripts/prep-fabrics.mjs` | Crops swatch images and writes the collection manifest. |

## Data file format

Export data writes one JSON file with every quilt, saved version and guide position. It does not depend on how the app stores things in `localStorage`. Code is in `src/core/backup.ts`, and the UI is in `src/ui/data/`.

```jsonc
{
  "app": "vibe-quilting",
  "format": 2,          // what the writer produced
  "readableBy": 2,      // the oldest reader format that can read this file safely
  "exportedAt": "2026-11-21T10:00:00.000Z",
  "appVersion": "0.1.0", // informational
  "projects": {
    "<projectId>": {
      "title": "...", "pattern": { "id": "...", "name": "...", "pieceIds": ["A"] },
      "collection": { "id": "...", "name": "...", "fabrics": { "<fabricId>": { "name": "...", "sku": "..." } } },
      "lastSizeId": "throw",
      "sizes": { "<sizeId>": { "name": "...", "cols": 4, "rows": 4, "design": {}, "guide": {}, "versions": [] } }
    }
  },
  "settings": { "hintSeen": true }
}
```

The names, SKUs and grid sizes describe things so a later app can map old ids to new ones. Readers never need them.

- **Version gate.** A reader refuses a file only when `readableBy` is higher than its own `READER_FORMAT`. A file with a higher `format` but a readable `readableBy` imports, and the parts the reader does not know are skipped and reported.
- **Additive changes** (a new field) need no new format number. Readers ignore fields they do not know.
- **Breaking changes** raise `format`, add one function to the `MIGRATIONS` chain in `backup.ts` (old shape in, next shape out), set `readableBy` honestly, and add a fixture. The chain is the only code that knows old shapes. Format 1 was a raw dump of the `vq:v1:` storage keys, and it still imports.
- **Tolerant reading.** Unknown fields, projects, sizes and guide steps are ignored. A field with the wrong type drops that one item, never the file. Fatal errors are only: not JSON, not this app's file, too large, `readableBy` too new, and `projects` missing.
- **Repair.** `repairDesign` (`src/core/repair.ts`) fits a design to the current pattern and fabrics, for files and for `localStorage` alike. An unknown fabric becomes an empty slot, bad overrides are dropped, lineups are cut or padded, and blocks that do not fit are reset. Only an unknown size id makes it give up.
- **Permanent ids and aliases.** Project, size, piece and fabric ids are permanent. If one must change, add the old id to `aliases` (`FabricCollection.aliases`, `PatternDef.aliases.sizes` and `.pieces`, and `projectAliases` in `src/projects/index.ts`). Aliases apply to files, and to fabric and piece ids in stored designs. Keys in `localStorage` still use the old project and size ids, so renaming one of those also needs a storage migration.
- **Fixtures.** `src/core/fixtures/backup-v*.json` are real files of each format, tested in `src/core/backup.test.ts`. Never edit or delete one. Only add new ones, and every format must keep importing.

## Adding a fabric collection

1. Put the swatch images in `assets-src/fabrics/<id>/`.
2. Add an entry for the collection to the config at the top of `scripts/prep-fabrics.mjs`. It needs the pixels per inch of the swatch images, which you measure from a ruler in the photo or work out from a known repeat size.
3. Run `npm run prep:fabrics`.

## Adding a pattern

1. Create `src/patterns/<id>/index.ts` that exports a `PatternDef`. See `src/core/types.ts` for the shape and `src/patterns/stacks/` for an example.
2. Use finished sizes, which are the cut sizes minus seam allowances.
3. Add a project in `src/projects/` that pairs the pattern with a collection, and register it in `src/projects/index.ts`.

## Copyright

Quilt patterns and fabric prints belong to their designers. This repo holds block measurements and swatch images for personal mockups. Keep it private, and do not add pattern PDFs.
