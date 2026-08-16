import type { ReportAsset, ReportDocument } from "./model";
import colorLogo from "./assets/brand/cosco-logo-color.png?inline";
import whiteLogo from "./assets/brand/cosco-logo-white.png?inline";
import lockupLogo from "./assets/brand/cosco-logo-lockup.png?inline";
import coverAerialPort from "./assets/brand/covers/cover-aerial-port.jpg?inline";
import coverCityShip from "./assets/brand/covers/cover-city-ship.jpg?inline";
import coverTerminal from "./assets/brand/covers/cover-terminal.jpg?inline";
import coverOpenWater from "./assets/brand/covers/cover-open-water.jpg?inline";
import coverRiver from "./assets/brand/covers/cover-river.jpg?inline";

export const BRAND_ASSET_IDS = {
  logoColor: "builtin-cosco-logo-color-v1",
  logoWhite: "builtin-cosco-logo-white-v1",
  logoLockup: "builtin-cosco-logo-lockup-v1",
  coverAerialPort: "builtin-cover-aerial-port-v1",
  coverCityShip: "builtin-cover-city-ship-v1",
  coverTerminal: "builtin-cover-terminal-v1",
  coverOpenWater: "builtin-cover-open-water-v1",
  coverRiver: "builtin-cover-river-v1"
} as const;

export type BrandAssetId = (typeof BRAND_ASSET_IDS)[keyof typeof BRAND_ASSET_IDS];

const asset = (
  id: BrandAssetId,
  mime: "image/png" | "image/jpeg",
  width: number,
  height: number,
  byteSize: number,
  hash: string,
  sourceName: string
): ReportAsset => ({ id, kind: "image", mime, width, height, byteSize, hash, sourceName, optimized: true, originalRetained: false });

export const BUILT_IN_BRAND_ASSETS: ReportAsset[] = [
  asset(BRAND_ASSET_IDS.logoColor, "image/png", 1024, 663, 44109, "f944dbd16b59cfcea7206296c2c77acc9ccb7ef102d252a9b89fd2e6d61055e1", "cosco-logo-color.png"),
  asset(BRAND_ASSET_IDS.logoWhite, "image/png", 1024, 663, 34440, "f54876776ed20b028aa57dbd56465284f9cc956051658714ad55650d0abb6679", "cosco-logo-white.png"),
  asset(BRAND_ASSET_IDS.logoLockup, "image/png", 1800, 480, 53098, "d35b745dec85909188e14d7ae65f394142d68f9f8b1e7ca96f55530aa4f57f09", "cosco-logo-lockup.png"),
  asset(BRAND_ASSET_IDS.coverAerialPort, "image/jpeg", 1920, 1268, 606722, "642e51140d723ac0c163833c6026fe2e9cbaae2397c9a4c3bb99b37f771a8ebb", "cover-aerial-port.jpg"),
  asset(BRAND_ASSET_IDS.coverCityShip, "image/jpeg", 1920, 1210, 628342, "aab835231134a7bda5fffdece2ef8ca9b828efc62c014c7a9cf681a3501ccb5f", "cover-city-ship.jpg"),
  asset(BRAND_ASSET_IDS.coverTerminal, "image/jpeg", 1920, 1440, 584887, "22cd87b76ce2023d55b12f34bb9045e41aa9b6aef5ff2ef918f54ff7ff11111a", "cover-terminal.jpg"),
  asset(BRAND_ASSET_IDS.coverOpenWater, "image/jpeg", 1920, 1280, 285042, "ec1c0f5948958f0b0c049deb47e3d3bf471ec0b29cdfabe2560b27147e8dfefd", "cover-open-water.jpg"),
  asset(BRAND_ASSET_IDS.coverRiver, "image/jpeg", 1912, 1440, 741816, "d887c7402fb76a51a657124aeac5c97be5d0ab16460b42b8d14f749de8105d53", "cover-river.jpg")
];

export const BUILT_IN_BRAND_ASSET_DATA: Record<BrandAssetId, string> = {
  [BRAND_ASSET_IDS.logoColor]: colorLogo,
  [BRAND_ASSET_IDS.logoWhite]: whiteLogo,
  [BRAND_ASSET_IDS.logoLockup]: lockupLogo,
  [BRAND_ASSET_IDS.coverAerialPort]: coverAerialPort,
  [BRAND_ASSET_IDS.coverCityShip]: coverCityShip,
  [BRAND_ASSET_IDS.coverTerminal]: coverTerminal,
  [BRAND_ASSET_IDS.coverOpenWater]: coverOpenWater,
  [BRAND_ASSET_IDS.coverRiver]: coverRiver
};

export function installBuiltInBrandAssets(
  document: ReportDocument,
  assetData: Record<string, string>,
  ids: readonly BrandAssetId[]
) {
  const installed = new Set(document.assets.map((item) => item.id));
  ids.forEach((id) => {
    const metadata = BUILT_IN_BRAND_ASSETS.find((item) => item.id === id);
    if (metadata && !installed.has(id)) document.assets.push(structuredClone(metadata));
    assetData[id] = BUILT_IN_BRAND_ASSET_DATA[id];
  });
}
