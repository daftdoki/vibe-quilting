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
