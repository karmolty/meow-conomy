import fs from "node:fs";
import { execSync } from "node:child_process";

const ROOT = new URL("../", import.meta.url);
const INDEX = new URL("../site/index.html", import.meta.url);

function readText(url) {
  return fs.readFileSync(url, "utf8");
}

function writeText(url, text) {
  fs.writeFileSync(url, text, "utf8");
}

function getGitSha() {
  try {
    const sha = execSync("git rev-parse --short HEAD", {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "ignore"]
    })
      .toString("utf8")
      .trim();
    return sha || null;
  } catch {
    return null;
  }
}

const desired = (process.env.VERSION || getGitSha() || "dev").trim();

let html = readText(INDEX);

const metaRe = /<meta\s+name="meow-conomy-version"\s+content="([^"]*)"\s*\/?>/;

if (metaRe.test(html)) {
  html = html.replace(metaRe, `<meta name="meow-conomy-version" content="${desired}" />`);
} else {
  // Insert after <title> if missing.
  const titleRe = /<title>Meow-conomy<\/title>\s*\n/;
  if (titleRe.test(html)) {
    html = html.replace(titleRe, match => match + `  <meta name="meow-conomy-version" content="${desired}" />\n`);
  } else {
    throw new Error("Could not find <title> to insert version meta tag.");
  }
}

writeText(INDEX, html);
console.log(`Stamped version: ${desired}`);
