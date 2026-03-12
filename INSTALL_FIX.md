# Fix for `npm run dev` / missing `@swc/helpers` and install errors

Your `node_modules` is hitting **incomplete/corrupt installs** (e.g. missing `@swc/helpers/cjs/`, `pure-rand/lib/`). npm is also reporting many `TAR_ENTRY_ERROR` / "tarball seems to be corrupted" during install. Use **one** of the options below.

---

## Option A: Clean npm cache and reinstall (recommended)

Run these in your **project root** in a normal terminal (so you can enter your password if prompted):

```bash
# 1. Clear npm cache (fixes corrupted tarballs)
rm -rf ~/.npm/_cacache

# 2. From project root: remove node_modules and reinstall
cd /Users/bradywilson/Desktop/insurafuze_king-crm/z.ai-1st-kingCRM
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

## Option B: Use Bun (project already has `bun.lock`)

If npm keeps failing, use Bun for installs:

```bash
# Install Bun (one-time)
curl -fsSL https://bun.sh/install | bash
# Restart terminal or: source ~/.zshrc

# From project root
cd /Users/bradywilson/Desktop/insurafuze_king-crm/z.ai-1st-kingCRM
rm -rf node_modules
bun install

npm run db:generate
npm run dev
```

You can keep using `npm run` for scripts; Bun is only for installing dependencies.

---

## Things that often cause these errors

- **iCloud Drive or Dropbox** syncing the project folder → move the project to a local folder (e.g. `~/Projects`) and try again.
- **Antivirus** locking files during extract → temporarily disable or exclude the project folder.
- **Mixing package managers** → use either npm **or** Bun, and stick to one. If using npm, you can delete `bun.lock` and use only `package-lock.json`.

---

## After a successful install

If `npm run dev` still fails with a missing module, reinstall that package:

```bash
npm install @swc/helpers@0.5.15 --no-save
# or
npm install pure-rand@6.1.0 --no-save
```

Then run `npm run dev` again.
