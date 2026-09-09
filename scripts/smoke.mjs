/**
 * Dev-server smoke check — proves the browser bundler shim actually works,
 * not just that the build compiles.
 *
 * Starts `next dev`, opens /passport/<e2e-demo wallet> in a real headless
 * Chrome, and asserts the rendered reputation score is 50 (the value
 * proofowl-backend/docs/testnet/e2e-demo.md records on-chain for that
 * wallet). That single live read exercises:
 *   - the next.config webpack `node:crypto` alias — the SDK barrel pulls
 *     in identifiers.ts's `import { createHash } from "node:crypto"`, so
 *     without the shim this page would not run in the browser at all;
 *   - `createReadClient` reading the live testnet contract from the
 *     browser (`@proofowl/contract-sdk`, npm-installed — no sibling
 *     checkout);
 *   - the SDK's own `getAttestationsPage` decode, via the attestation
 *     history (no consumer-side decode shim as of SDK 0.3.0).
 *
 * This is a LOCAL check (needs a Chrome binary); it is not part of CI.
 * Skips cleanly if no Chrome is found. Set CHROME_PATH to override.
 *
 *   npm run smoke
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";

const PORT = 3199;
const WALLET = "GAXZZJW7Y4GYRG32MKSAU3YMHQ4PZRHDVDE53DNLNBMK4O4NXLHTPWER";
const EXPECTED_SCORE = "50";

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  return candidates.find((p) => existsSync(p));
}

function waitForPort(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = () => {
      const s = net.connect(port, "127.0.0.1");
      s.on("connect", () => {
        s.destroy();
        resolve();
      });
      s.on("error", () => {
        s.destroy();
        if (Date.now() > deadline) reject(new Error(`port ${port} not up in ${timeoutMs}ms`));
        else setTimeout(tick, 400);
      });
    };
    tick();
  });
}

const chrome = findChrome();
if (!chrome) {
  console.log("smoke: no Chrome binary found (set CHROME_PATH) — skipping.");
  process.exit(0);
}

const { default: puppeteer } = await import("puppeteer-core");

const server = spawn("npx", ["next", "dev", "-p", String(PORT)], {
  stdio: ["ignore", "inherit", "inherit"],
  env: process.env,
});

let browser;
let failed = false;
try {
  await waitForPort(PORT, 60_000);
  browser = await puppeteer.launch({
    executablePath: chrome,
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push(String(e)));

  await page.goto(`http://127.0.0.1:${PORT}/passport/${WALLET}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });

  // Wait for the client read to resolve and the score stat to render.
  await page.waitForFunction(
    () => {
      const el = [...document.querySelectorAll(".stat")].find((n) =>
        /reputation score/i.test(n.textContent || ""),
      );
      return el && /\d/.test(el.querySelector(".stat__value")?.textContent || "");
    },
    { timeout: 45_000 },
  );

  const score = await page.evaluate(() => {
    const el = [...document.querySelectorAll(".stat")].find((n) =>
      /reputation score/i.test(n.textContent || ""),
    );
    return el?.querySelector(".stat__value")?.textContent?.trim();
  });

  // Give the history read a moment to resolve, then record whether it
  // rendered a row or an error (both prove the SDK read path ran).
  await page
    .waitForFunction(
      () => document.querySelector(".attn-list li") || document.querySelector(".callout--danger"),
      { timeout: 30_000 },
    )
    .catch(() => {});
  const historyText = await page
    .evaluate(
      () =>
        document.querySelector(".attn-list")?.textContent ||
        document.querySelector(".callout--danger")?.textContent ||
        "(no history element)",
    )
    .catch(() => "(eval failed)");

  console.log(`smoke: /passport/${WALLET.slice(0, 8)}… rendered reputation score = ${score}`);
  console.log(
    `smoke: attestation history = ${JSON.stringify(historyText.replace(/\s+/g, " ").slice(0, 160))}`,
  );

  if (score !== EXPECTED_SCORE) {
    failed = true;
    console.error(`smoke: FAIL — expected reputation score ${EXPECTED_SCORE}, got ${score}`);
  } else {
    console.log("smoke: PASS — live browser read via the npm-installed SDK returned the expected value.");
  }
  if (consoleErrors.length) {
    console.error("smoke: page errors:\n" + consoleErrors.join("\n"));
    failed = true;
  }
} catch (err) {
  failed = true;
  console.error("smoke: ERROR —", err instanceof Error ? err.stack : err);
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}

process.exit(failed ? 1 : 0);
