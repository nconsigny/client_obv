import { build } from "esbuild";
import { mkdirSync, cpSync } from "fs";

// Build browser bundle
await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  outfile: "dist-demo/oblivious-client.js",
  format: "esm",
  platform: "browser",
  target: "es2022",
  sourcemap: true,
  minify: false,
});

// Copy demo HTML
mkdirSync("dist-demo", { recursive: true });
cpSync("demo/index.html", "dist-demo/index.html");

console.log("Browser bundle built → dist-demo/oblivious-client.js");
