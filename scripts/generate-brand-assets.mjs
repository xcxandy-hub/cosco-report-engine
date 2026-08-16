import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const BRAND_DIR = path.join(ROOT, "src", "assets", "brand");
const COVER_DIR = path.join(BRAND_DIR, "covers");

const BRAND_FILES = [
  ["cosco-logo-color.png", "image/png"],
  ["cosco-logo-white.png", "image/png"],
  ["cosco-logo-lockup.png", "image/png"],
  ["covers/cover-aerial-port.jpg", "image/jpeg"],
  ["covers/cover-city-ship.jpg", "image/jpeg"],
  ["covers/cover-terminal.jpg", "image/jpeg"],
  ["covers/cover-open-water.jpg", "image/jpeg"],
  ["covers/cover-river.jpg", "image/jpeg"]
];

const EXPECTED = {
  "cosco-logo-color.png": [1024, 663, 44109, "f944dbd16b59cfcea7206296c2c77acc9ccb7ef102d252a9b89fd2e6d61055e1"],
  "cosco-logo-white.png": [1024, 663, 34440, "f54876776ed20b028aa57dbd56465284f9cc956051658714ad55650d0abb6679"],
  "cosco-logo-lockup.png": [1800, 480, 53098, "d35b745dec85909188e14d7ae65f394142d68f9f8b1e7ca96f55530aa4f57f09"],
  "covers/cover-aerial-port.jpg": [1920, 1268, 606722, "642e51140d723ac0c163833c6026fe2e9cbaae2397c9a4c3bb99b37f771a8ebb"],
  "covers/cover-city-ship.jpg": [1920, 1210, 628342, "aab835231134a7bda5fffdece2ef8ca9b828efc62c014c7a9cf681a3501ccb5f"],
  "covers/cover-terminal.jpg": [1920, 1440, 584887, "22cd87b76ce2023d55b12f34bb9045e41aa9b6aef5ff2ef918f54ff7ff11111a"],
  "covers/cover-open-water.jpg": [1920, 1280, 285042, "ec1c0f5948958f0b0c049deb47e3d3bf471ec0b29cdfabe2560b27147e8dfefd"],
  "covers/cover-river.jpg": [1912, 1440, 741816, "d887c7402fb76a51a657124aeac5c97be5d0ab16460b42b8d14f749de8105d53"]
};

function sourceArg() {
  const index = process.argv.indexOf("--source");
  return index >= 0 ? process.argv[index + 1] : "";
}

function extractLogoSvg(html) {
  const match = html.match(/const V4_DEFAULT_LOGO_SRC = "data:image\/svg\+xml;base64,([A-Za-z0-9+/=]+)"/);
  if (!match) throw new Error("未在旧版 HTML 中找到 V4_DEFAULT_LOGO_SRC");
  return Buffer.from(match[1], "base64").toString("utf8");
}

function whiteLogoSvg(svg) {
  return svg.replace(/fill:#[0-9a-f]{6}/gi, "fill:#ffffff");
}

function lockupSvg(logoSvg) {
  const encoded = Buffer.from(logoSvg).toString("base64");
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="1800" height="480" viewBox="0 0 1800 480">
      <image href="data:image/svg+xml;base64,${encoded}" x="36" y="58" width="520" height="364" preserveAspectRatio="xMidYMid meet"/>
      <rect x="610" y="92" width="3" height="296" fill="#d70110"/>
      <text x="680" y="230" font-family="PingFang SC, Microsoft YaHei, Arial, sans-serif" font-size="108" font-weight="700" fill="#00508e">中远海运</text>
      <text x="686" y="312" font-family="Helvetica Neue, Arial, sans-serif" font-size="48" font-weight="600" letter-spacing="5" fill="#52616b">COSCO SHIPPING REPORTS</text>
    </svg>`;
}

async function generate(sourcePath) {
  if (!sourcePath) throw new Error("生成品牌资源需要 --source <旧版财务简报 HTML>");
  const html = await readFile(path.resolve(sourcePath), "utf8");
  const logoSvg = extractLogoSvg(html);
  await mkdir(COVER_DIR, { recursive: true });

  await sharp(Buffer.from(logoSvg)).resize({ width: 1024 }).png({ compressionLevel: 9 }).toFile(path.join(BRAND_DIR, "cosco-logo-color.png"));
  await sharp(Buffer.from(whiteLogoSvg(logoSvg))).resize({ width: 1024 }).png({ compressionLevel: 9 }).toFile(path.join(BRAND_DIR, "cosco-logo-white.png"));
  await sharp(Buffer.from(lockupSvg(logoSvg))).png({ compressionLevel: 9 }).toFile(path.join(BRAND_DIR, "cosco-logo-lockup.png"));

}

async function verify() {
  const results = [];
  for (const [relativePath, mime] of BRAND_FILES) {
    const file = path.join(BRAND_DIR, relativePath);
    const bytes = await readFile(file);
    const metadata = await sharp(bytes).metadata();
    const info = await stat(file);
    if (mime === "image/png") {
      if (bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") throw new Error(`${relativePath} 不是有效 PNG`);
      if (!metadata.hasAlpha || metadata.channels !== 4) throw new Error(`${relativePath} 缺少透明 alpha 通道`);
      const { data, info: rawInfo } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const cornerAlpha = [3, (rawInfo.width - 1) * 4 + 3, (rawInfo.width * (rawInfo.height - 1)) * 4 + 3, (rawInfo.width * rawInfo.height - 1) * 4 + 3].map((index) => data[index]);
      if (cornerAlpha.some((alpha) => alpha !== 0)) throw new Error(`${relativePath} 四角存在不透明底色`);
    } else if (bytes.subarray(0, 3).toString("hex") !== "ffd8ff" || bytes.subarray(-2).toString("hex") !== "ffd9") {
      throw new Error(`${relativePath} 不是有效 JPEG`);
    }
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const expected = EXPECTED[relativePath];
    if (!expected || metadata.width !== expected[0] || metadata.height !== expected[1] || info.size !== expected[2] || sha256 !== expected[3]) {
      throw new Error(`${relativePath} 与固化尺寸、字节数或 SHA-256 不一致`);
    }
    results.push({
      file: relativePath,
      mime,
      width: metadata.width,
      height: metadata.height,
      bytes: info.size,
      sha256
    });
  }
  console.log(JSON.stringify(results, null, 2));
}

if (!process.argv.includes("--verify")) await generate(sourceArg());
await verify();
