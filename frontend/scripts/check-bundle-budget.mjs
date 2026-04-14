import { statSync } from "node:fs";
import { globSync } from "glob";
import { resolve } from "node:path";

const budgetKb = Number(process.env.MAIN_BUNDLE_BUDGET_KB || 320);
const distDir = resolve(process.cwd(), "dist", "assets");
const candidates = globSync("index-*.js", { cwd: distDir, absolute: true });

if (candidates.length === 0) {
  console.error("No main bundle file found in dist/assets");
  process.exit(1);
}

const bundlePath = candidates.sort().at(-1);
const sizeKb = statSync(bundlePath).size / 1024;

if (sizeKb > budgetKb) {
  console.error(
    `Main bundle budget exceeded: ${sizeKb.toFixed(2)}KB > ${budgetKb}KB (${bundlePath})`,
  );
  process.exit(1);
}

console.log(`Main bundle within budget: ${sizeKb.toFixed(2)}KB <= ${budgetKb}KB`);