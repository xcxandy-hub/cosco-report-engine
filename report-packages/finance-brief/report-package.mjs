import { readFileSync } from "node:fs";

const reportPackage = JSON.parse(readFileSync(new URL("./report-package.json", import.meta.url), "utf8"));

export { reportPackage };
export default reportPackage;
