import "./env.js";

import { checkListingsStillOnline } from "./liveness.js";

const result = await checkListingsStillOnline();
console.log(
  `Availability check: ${result.checked} checked, ${result.gone} gone, ${result.unknown} inconclusive`,
);
