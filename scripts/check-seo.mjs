import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};
const read = (path) => (existsSync(path) ? readFileSync(path, "utf8") : "");
const filesUnder = (directory) =>
  existsSync(directory)
    ? readdirSync(directory).flatMap((name) => {
        const path = join(directory, name);
        return statSync(path).isDirectory() ? filesUnder(path) : [path];
      })
    : [];

// Every Nitro preset writes its build somewhere different. Pick the layout from
// the same host variables vite.config.ts uses to pick the preset — checking
// which directory exists would happily grade a stale build from another target.
const layouts = {
  netlify: { staticDir: "dist", serverDir: ".netlify/functions-internal" },
  vercel: { staticDir: ".vercel/output/static", serverDir: ".vercel/output/functions" },
  cloudflare: { staticDir: ".output/public", serverDir: ".output/server" },
};

const preset = process.env["NETLIFY"] ? "netlify" : process.env["VERCEL"] ? "vercel" : "cloudflare";
const staticDir = join(root, layouts[preset].staticDir);
const serverDir = join(root, layouts[preset].serverDir);

if (!existsSync(serverDir)) {
  console.error(
    `SEO regression check failed: the ${preset} build produced no server output at ${layouts[preset].serverDir}.`,
  );
  process.exit(1);
}

const robots = read(join(staticDir, "robots.txt"));
const sitemap = read(join(staticDir, "sitemap.xml"));
const serverBundle = filesUnder(serverDir)
  .filter((path) => path.endsWith(".mjs"))
  .map(read)
  .join("\n");

expect(
  robots.includes("Sitemap: https://club-hub-self.vercel.app/sitemap.xml"),
  "robots.txt must advertise the sitemap",
);
for (const route of ["/account", "/admin", "/clubs", "/manage", "/tutorials"]) {
  expect(robots.includes(`Disallow: ${route}`), `robots.txt must block private route ${route}`);
}
expect(
  sitemap.includes("https://club-hub-self.vercel.app/"),
  "sitemap must contain the canonical homepage",
);
expect(serverBundle.includes("x-robots-tag"), "server must emit X-Robots-Tag headers");
expect(serverBundle.includes("noindex, nofollow, noarchive"), "private responses must be noindex");
expect(
  serverBundle.includes("SoftwareApplication"),
  "homepage must retain structured application data",
);
expect(
  serverBundle.includes("https://club-hub-self.vercel.app/"),
  "production SSR must retain the canonical URL",
);
expect(
  serverBundle.includes("One club app to"),
  "production SSR must contain meaningful homepage HTML",
);

if (failures.length) {
  console.error(
    "SEO regression check failed:\n" + failures.map((failure) => `- ${failure}`).join("\n"),
  );
  process.exit(1);
}

console.log(
  "SEO regression check passed: SSR content, canonical metadata, sitemap, and private-route safeguards are present.",
);
