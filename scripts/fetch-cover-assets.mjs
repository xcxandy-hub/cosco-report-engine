import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const outputDirectory = path.resolve(import.meta.dirname, "..", "src", "assets", "brand", "covers");
const sources = [
  {
    file: "cover-aerial-port.jpg",
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Aerial_photograph_of_the_Port_of_Miami_Container_Port.jpg/1920px-Aerial_photograph_of_the_Port_of_Miami_Container_Port.jpg"
  },
  {
    file: "cover-city-ship.jpg",
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/ARUNA_IPSA_%28Container_Ship%29_%2816998193220%29.jpg/1920px-ARUNA_IPSA_%28Container_Ship%29_%2816998193220%29.jpg"
  },
  {
    file: "cover-terminal.jpg",
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/BG_Sapphire_%28ship%2C_2018%29_%28IMO_9803699%2C_MMSI_209247000%29_Container_Ship%2C_Amazone_harbor%2C_photo_2.jpg/1920px-BG_Sapphire_%28ship%2C_2018%29_%28IMO_9803699%2C_MMSI_209247000%29_Container_Ship%2C_Amazone_harbor%2C_photo_2.jpg"
  },
  {
    file: "cover-open-water.jpg",
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Container_ship_in_Koper_2013.jpg/1920px-Container_ship_in_Koper_2013.jpg"
  },
  {
    file: "cover-river.jpg",
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Container_ships_on_Saigon_River.jpg/1920px-Container_ships_on_Saigon_River.jpg"
  }
];

await mkdir(outputDirectory, { recursive: true });
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const download = async (source) => {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await fetch(source.url, { headers: { "User-Agent": "cosco-report-engine-cover-asset-builder/1.0 (https://github.com/xcxandy-hub/cosco-report-engine)" } });
    if (response.ok) return response;
    if (response.status !== 429 || attempt === 4) throw new Error(`${source.file} 下载失败：HTTP ${response.status}`);
    await wait(attempt * 1500);
  }
  throw new Error(`${source.file} 下载失败`);
};

for (const source of sources) {
  const response = await download(source);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.startsWith("image/jpeg")) throw new Error(`${source.file} 返回了非 JPEG 内容：${contentType}`);
  const input = Buffer.from(await response.arrayBuffer());
  await sharp(input)
    .rotate()
    .resize({ width: 1920, height: 1440, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 86, mozjpeg: true })
    .toFile(path.join(outputDirectory, source.file));
}

console.log(`已下载并去元数据重编码 ${sources.length} 张可再分发封面图。`);
