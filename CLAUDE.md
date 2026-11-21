# Vibe Quilting

## Hard rule: no external code newer than 14 days

Nothing from outside this repository may be added or run unless it was published at least 14 days ago. This is a supply chain rule and it has no exceptions an agent can grant.

- `.npmrc` sets `min-release-age=14`. Never change that number, never add `min-release-age-exclude` entries, and never pass `--min-release-age`, `--before`, `--no-package-lock` or `--registry` to npm to get around it.
- After any change to `package.json` or `package-lock.json`, run `npm run check:deps`. It must pass before you report the work as done.
- If npm cannot find a version that is old enough, stop and tell the user. Do not pick a different package, vendor the code, or relax the rule.
- Only the npm registry is allowed as a source. No git, GitHub or tarball dependencies.
- The rule also covers code that npm does not manage: no `<script>` or stylesheet from a CDN, no `npx <package>` or `npm exec` of a package that is not already in the lockfile, no `curl | sh`, and no pasted third party source newer than 14 days.
- Only the user can approve an exception, for example a security fix released this week. Record it in `.npmrc` with a comment and a removal date.

The README section "Dependency age rule" explains the reasoning.
