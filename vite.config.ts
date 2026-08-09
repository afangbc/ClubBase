// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Each host runs a different server format, and a build made for the wrong one
// deploys as static files with nothing behind them — every SSR route and server
// function 404s. Detect the host from the variable its build injects and fall
// back to Lovable's Cloudflare default in its own preview environment.
const hostPreset = process.env["NETLIFY"]
  ? "netlify"
  : process.env["VERCEL"]
    ? "vercel"
    : undefined;

export default defineConfig({
  ...(hostPreset ? { nitro: { preset: hostPreset } } : {}),
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
