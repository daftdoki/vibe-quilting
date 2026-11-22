/**
 * URL of a file in `public/`, given its path without a leading slash. The app
 * is not always served from the root of a site (GitHub Pages serves it from
 * /<repo>/), so every public file goes through here.
 */
export function asset(path: string): string {
  const base = import.meta.env.BASE_URL ?? '/';
  return `${base.endsWith('/') ? base : `${base}/`}${path.replace(/^\/+/, '')}`;
}
