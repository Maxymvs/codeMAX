#!/usr/bin/env node
// @effect-diagnostics nodeBuiltinImport:off globalConsole:off - A one-shot release step; synchronous Node APIs keep it small.
// Renames "T3 Code" to "codeMAX" in a release checkout's text before it is built. Only the release
// workflow's throwaway checkout is rewritten, so `dev` matches upstream; never commit the output.
// Translations are keyed by a hash of the English text, so after the rewrite each one moves to the
// regenerated key of its renamed English string.

import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

const root = NodePath.resolve(import.meta.dirname, "../..");
const NAME = "codeMAX";
// Kept as-is: names of other installs read for data migration, and the real GitHub App's name.
const BRAND = /T3 Code(?! \((?:Alpha|Beta)\)| for GitHub)/g;

const SOURCE_DIRS = ["apps/web/src", "apps/desktop/src", "apps/server/src", "packages"];
const EXTRA_FILES = ["apps/web/index.html", "apps/web/public/manifest.webmanifest"];
const SOURCE_FILE = /\.(?:ts|tsx|mts|cts|js|mjs|cjs|html)$/;
const SKIPPED = /(?:\.test\.|\.browser\.|\/test\/|\/__tests__\/|\/node_modules\/|\/dist\/)/;
// Translations are keyed by a hash of the English text; mobile is not part of codeMAX releases.
const TRANSLATED_APPS = ["apps/web", "apps/desktop"];
const CATALOG_DIR = "src/i18n/translations";

type Catalog = Record<string, unknown>;

const rebrand = (text: string) => text.replace(BRAND, NAME);

function* walk(dir: string): Generator<string> {
  for (const entry of NodeFS.readdirSync(dir, { withFileTypes: true })) {
    const path = NodePath.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== "dist") yield* walk(path);
    } else if (SOURCE_FILE.test(entry.name) && !SKIPPED.test(path)) {
      yield path;
    }
  }
}

function rewriteFile(path: string): number {
  const text = NodeFS.readFileSync(path, "utf8");
  const count = text.match(BRAND)?.length ?? 0;
  if (count > 0) NodeFS.writeFileSync(path, rebrand(text));
  return count;
}

function catalogsOf(app: string) {
  const dir = NodePath.join(root, app, CATALOG_DIR);
  const pathOf = (locale: string) => NodePath.join(dir, `${locale}.json`);
  return {
    locales: NodeFS.readdirSync(dir)
      .filter((file) => file.endsWith(".json"))
      .map((file) => file.slice(0, -".json".length)),
    read: (locale: string): Catalog => JSON.parse(NodeFS.readFileSync(pathOf(locale), "utf8")),
    write: (locale: string, catalog: Catalog) =>
      NodeFS.writeFileSync(pathOf(locale), `${JSON.stringify(catalog, null, 2)}\n`),
  };
}

const before = new Map(
  TRANSLATED_APPS.map((app) => {
    const catalogs = catalogsOf(app);
    return [app, new Map(catalogs.locales.map((locale) => [locale, catalogs.read(locale)]))];
  }),
);

let files = 0;
let mentions = 0;
const paths = [
  ...SOURCE_DIRS.flatMap((dir) => [...walk(NodePath.join(root, dir))]),
  ...EXTRA_FILES.map((file) => NodePath.join(root, file)),
];
for (const path of paths) {
  if (path.includes(`/${CATALOG_DIR}/`)) continue;
  const count = rewriteFile(path);
  if (count > 0) {
    files += 1;
    mentions += count;
  }
}
console.log(`Renamed ${mentions} mentions of T3 Code in ${files} files.`);

for (const app of TRANSLATED_APPS) {
  const generate = NodeChildProcess.spawnSync("vp", ["run", "i18n:generate"], {
    cwd: NodePath.join(root, app),
    stdio: ["ignore", "ignore", "inherit"],
  });
  if (generate.status !== 0)
    throw new Error(`Regenerating the ${app} translation catalogs failed.`);

  // Each new English entry is an old one with the name changed; find it by that text.
  const catalogs = catalogsOf(app);
  const old = before.get(app)!;
  const oldEnglish = old.get("en")!;
  const oldKeyByRebrandedText = new Map(
    Object.entries(oldEnglish).map(([key, value]) => [rebrand(JSON.stringify(value)), key]),
  );
  const moved = new Map<string, string>();
  const unmatched: string[] = [];
  for (const [key, value] of Object.entries(catalogs.read("en"))) {
    if (key in oldEnglish) continue;
    const oldKey = oldKeyByRebrandedText.get(JSON.stringify(value));
    if (oldKey === undefined) unmatched.push(key);
    else moved.set(key, oldKey);
  }

  for (const locale of catalogs.locales) {
    if (locale === "en") continue;
    const oldCatalog = old.get(locale)!;
    const catalog = catalogs.read(locale);
    for (const [key, oldKey] of moved) {
      if (oldKey in oldCatalog) catalog[key] = oldCatalog[oldKey];
    }
    for (const [key, value] of Object.entries(catalog)) {
      catalog[key] = JSON.parse(rebrand(JSON.stringify(value)));
    }
    catalogs.write(locale, catalog);
  }

  console.log(`${app}: moved ${moved.size} translations to their renamed English text.`);
  if (unmatched.length > 0) {
    console.warn(
      `${app}: ${unmatched.length} new strings have no earlier translation and will show in English: ${unmatched.join(", ")}`,
    );
  }
}
