import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Always load the repo-root .env regardless of where the scraper is run from.
const dir = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(dir, "..", "..", ".env") });
