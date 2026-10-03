# Fix for `npm run dev` / missing `@swc/helpers` and install errors

Your `node_modules` is hitting **incomplete/corrupt installs** (e.g. missing `@swc/helpers/cjs/`, `pure-rand/lib/`). npm is also reporting many `TAR_ENTRY_ERROR` / "tarball seems to be corrupted" during install. Use **one** of the options below.

---

## Option A: Clean npm cache and reinstall (recommended)

Run these in your **project root** in a normal terminal (so you can enter your password if prompted):

```bash
# 1. Clear npm cache (fixes corrupted tarballs)
rm -rf ~/.npm/_cacache

# 2. From project root: remove node_modules and reinstall
cd /path/to/kingcrmhub
rm -rf node_modules
npm install

# 3. Generate Prisma and run dev
npm run db:generate
npm run dev
```

If `rm -rf node_modules` fails with "Permission denied", fix permissions then remove:

```bash
chmod -R u+rwx node_modules
rm -rf node_modules
```

---

## Option B: Full clean reinstall (if npm keeps failing)

**Do not switch to `bun install`.** This repo installs with **npm only**. Bun re-resolving this repo's `bun.lock` silently drops the protected `next-auth → uuid: 11.1.1` override from `package.json` `overrides`, producing a wrong dependency tree (proven on t_598b10c8). Bun use is confined to the non-blocking nightly CI job (`--frozen-lockfile`); it is not a supported local install path.

Instead, wipe both `node_modules` and the lockfile state and reinstall from scratch with npm:

```bash
# From project root
cd /path/to/kingcrmhub
rm -rf node_modules
npm cache verify
npm install

npm run db:generate
npm run dev
```

If `npm install` still errors on corrupted tarballs after clearing the cache, check the "Things that often cause these errors" section below — the cause is almost always the filesystem (sync folders, antivirus, permissions), not npm itself.

---

## Things that often cause these errors

- **iCloud Drive or Dropbox** syncing the project folder → move the project to a local folder (e.g. `~/Projects`) and try again.
- **Antivirus** locking files during extract → temporarily disable or exclude the project folder.
- **Mixing package managers** → this repo installs with **npm only** (`package-lock.json` is canonical). Do not run `bun install` locally (see Option B), and do not delete `bun.lock` on your own — it is still consumed by the nightly CI job and its retirement is a pending maintainer decision.

---

## After a successful install

If `npm run dev` still fails with a missing module, reinstall that package:

```bash
npm install @swc/helpers@0.5.15 --no-save
# or
npm install pure-rand@6.1.0 --no-save
```

Then run `npm run dev` again.
