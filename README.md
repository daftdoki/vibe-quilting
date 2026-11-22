# Vibe Quilting

Mock up a quilt on your phone. A guided setup picks a size and fills a stack of fat quarters, and you can tap or drag fabrics onto single pieces after that. Prints draw at their real size, so the mockup shows how the sewn quilt will look. The app saves versions, exports a picture, saves and opens quilt files, and prints a black and white build sheet.

The first project is the Stacks pattern with the Happy Place fat quarter bundle.

## Try it

The app is live at https://daftdoki.github.io/vibe-quilting/. It runs in the browser and keeps your quilts on your own device.

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

`npm test` and `npm run build` run the dependency age check first (see below), which looks up publish dates on the npm registry, so they need a network connection the first time.

## How the repo is organized

A project pairs one pattern with one fabric collection. Patterns and collections are data, and the core and UI code work with any of them.

| Path | What lives there |
| --- | --- |
| `src/core/` | Shared types, design state, geometry, storage, versions, the data file format and the build sheet data. No DOM code. |
| `src/core/fixtures/` | Real data files of each format, kept so old files keep importing. |
| `src/patterns/<id>/` | One pattern: block pieces as polygons in finished inches, the size list, and the pattern's fabric shuffle. |
| `src/fabrics/<id>/` | One fabric collection manifest. Generated, do not edit by hand. |
| `src/projects/` | Pattern and collection pairings, and the project registry. |
| `src/ui/` | The React app. |
| `src/ui/guide/` | The guided setup card and its steps. |
| `src/ui/versions/` | The saved versions list. |
| `src/ui/data/` | Export data, Import data, Save quilt file, opening a quilt file and Clear all data. |
| `src/ui/print/` | The printable build sheet and its preview. |
| `assets-src/fabrics/<id>/` | Original swatch images, before cropping. |
| `public/fabrics/<id>/` | Cropped swatches and thumbnails that the app serves. |
| `scripts/prep-fabrics.mjs` | Crops swatch images and writes the collection manifest. |
| `scripts/check-dep-age.mjs` | Fails when a locked package is under 14 days old. See "Dependency age rule". |

## Data file format

Export data writes one JSON file with every quilt, saved version, quilt name, guide position and the list of excluded fabrics. Save quilt file writes the same format with `"scope": "quilt"` and one size of one project. The format does not depend on how the app stores things in `localStorage`. Code is in `src/core/backup.ts`, and the UI is in `src/ui/data/`.

```jsonc
{
  "app": "vibe-quilting",
  "format": 2,          // what the writer produced
  "readableBy": 2,      // the oldest reader format that can read this file safely
  "scope": "quilt",     // optional. Missing means "all"
  "exportedAt": "2026-11-21T10:00:00.000Z",
  "appVersion": "0.1.0", // informational
  "projects": {
    "<projectId>": {
      "title": "...", "pattern": { "id": "...", "name": "...", "pieceIds": ["A"] },
      "collection": { "id": "...", "name": "...", "fabrics": { "<fabricId>": { "name": "...", "sku": "...", "design": "...", "colorway": "..." } } },
      "lastSizeId": "throw", // not in a quilt file
      "excludedFabrics": ["<fabricId>"], // optional. Fabrics she excluded. Not in a quilt file
      "sizes": { "<sizeId>": { "name": "...", "cols": 4, "rows": 4, "design": {}, "guide": {}, "versions": [],
                     "quiltName": "Ginger's Quilt" } } // quiltName is optional, never blank, at most 60 characters
    }
  },
  "settings": { "hintSeen": true } // not in a quilt file
}
```

The names, SKUs and grid sizes describe things so a later app can map old ids to new ones. Readers never need them.

- **Version gate.** A reader refuses a file only when `readableBy` is higher than its own `READER_FORMAT`. A file with a higher `format` but a readable `readableBy` imports. Fields the reader does not know are ignored, and quilts and versions it cannot place are skipped and counted on the confirm screen.
- **Additive changes** (a new field) need no new format number. Readers ignore fields they do not know.
- **Breaking changes** raise `format`, add one function to the `MIGRATIONS` chain in `backup.ts` (old shape in, next shape out), set `readableBy` honestly, and add a fixture. The chain is the only code that knows old shapes. Format 1 was a raw dump of the `vq:v1:` storage keys, and it still imports.
- **Tolerant reading.** Unknown fields, projects, sizes and guide steps are ignored. A guide step that an older app had and this one folded into another, such as `shuffle`, is read as the step that replaced it (`fabrics`). A field with the wrong type drops that one item, never the file. Fatal errors are only: not JSON, not this app's file, too large, `readableBy` too new, and `projects` missing or a migration that cannot run. A quilt file is also refused when it holds no quilt for a known pattern and size, or more than one quilt.
- **Repair.** `repairDesign` (`src/core/repair.ts`) fits a design to the current pattern and fabrics, for files and for `localStorage` alike. An unknown fabric becomes an empty slot, bad overrides are dropped, lineups are cut or padded, and blocks that do not fit are reset. Only an unknown size id makes it give up.
- **Permanent ids and aliases.** Project, size, piece and fabric ids are permanent. If one must change, add the old id to `aliases` (`FabricCollection.aliases`, `PatternDef.aliases.sizes` and `.pieces`, and `projectAliases` in `src/projects/index.ts`). Aliases apply to files, and to fabric and piece ids in stored designs. Keys in `localStorage` still use the old project and size ids, so renaming one of those also needs a storage migration.
- **Scope.** `scope` says what a file is for. Missing or exactly `"all"` is a full export, and import replaces everything on the device. `"quilt"` is one size of one project (`buildQuiltBackup`), and import opens it with `applyQuiltBackup`: it replaces only that size's design, keeps the old design as an automatic version (by the usual `addVersion` rules, so not when it is empty, equal to the incoming design, or equal to the newest version), merges the versions by id or identical content, makes that size the last one opened, sets the size's quilt name when the file has one and otherwise keeps the device's name, and leaves everything else alone. A quilt file has no `settings`, no `lastSizeId` and no `excludedFabrics`. Adding `scope` was additive, so `format` and `readableBy` stayed 2. **Safety rule:** any other `scope` value, from a future app, is read as a quilt-style file and never as a full replace, and `applyBackup` refuses data that is not scope `"all"`. A reader that does not understand a scope cannot wipe the device. Readers built before `scope` existed ignore it and would treat a quilt file as a full one.
- **Fixtures.** `src/core/fixtures/backup-v*.json` and `quilt-v*.json` are real files of each format, tested in `src/core/backup.test.ts`. Never edit or delete one. Only add new ones, and every format must keep importing.

## Dependency age rule

No external code enters this project until it has been public for at least 14 days. Most malicious package releases are found and pulled within days, so waiting two weeks keeps them out.

The rule has two enforcement points:

- **`.npmrc` sets `min-release-age=14`.** npm refuses to resolve any version published in the last 14 days, for direct and transitive dependencies. It needs npm 11.10 or later.
- **`scripts/check-dep-age.mjs` checks the lockfile.** It looks up the publish date of every package in `package-lock.json` and fails if one is under 14 days old or does not come from the npm registry. It runs before `npm test` and `npm run build`, and on its own as `npm run check:deps`. This catches a lockfile that was written with the npm setting turned off.

What this means in practice:

- To add or update a package, run `npm install <name>` as usual. npm picks the newest version that is old enough. If nothing old enough fits, wait.
- Do not pass `--min-release-age`, `--before`, `--no-package-lock` or `--registry` to get around it, and do not add entries to `min-release-age-exclude`.
- A security fix published in the last 14 days is the one case for an exception. The project owner decides, and the exception goes in `.npmrc` as a `min-release-age-exclude[]` line with a comment and a date to remove it.
- The rule covers everything, not only npm packages. No scripts or styles loaded from a CDN, no `npx` or `curl | sh` of something unpinned, no git or tarball dependencies, and no copied-in third party code newer than 14 days.

## Adding a fabric collection

1. Put the swatch images in `assets-src/fabrics/<id>/`.
2. Add an entry for the collection to the config at the top of `scripts/prep-fabrics.mjs`. It needs the pixels per inch of the swatch images, which you measure from a ruler in the photo or work out from a known repeat size.
3. Run `npm run prep:fabrics`.

## Adding a pattern

1. Create `src/patterns/<id>/index.ts` that exports a `PatternDef`. See `src/core/types.ts` for the shape and `src/patterns/stacks/` for an example.
2. Use finished sizes, which are the cut sizes minus seam allowances.
3. Add a project in `src/projects/` that pairs the pattern with a collection, and register it in `src/projects/index.ts`.

## Publishing

Every push to `main` builds the app and publishes it to GitHub Pages through `.github/workflows/pages.yml`. Pages serves the site from `/vibe-quilting/`, so the workflow builds with `VITE_BASE=/vibe-quilting/`. Files in `public/` are addressed through `asset()` in `src/core/asset.ts`, which adds that prefix. Do not write a public file's path with a leading slash.

The workflow's actions are pinned to commits and follow the dependency age rule above.

## Credits and copyright

Quilt patterns and fabric prints belong to their designers. This project is not affiliated with or endorsed by any of them.

- The Stacks quilt pattern is by Connie Kresin Campbell. The app holds only the finished sizes of the block's pieces. It does not include the pattern, its cutting sizes or its instructions. To make the quilt, buy the pattern from the designer.
- The Happy Place fabric collection is by Annabel Wrigley for Windham Fabrics. The swatch images are the designer's product images, used here so a quilter can see how the fabrics will look together.

If you hold rights to any of this material and want it removed, open an issue on the repository.

Do not add pattern PDFs to this repo.
