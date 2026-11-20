// Prints the published JSON Schema; `npm run generate:schema` writes it to schema/.
import { projectJsonSchema } from "../src/document.ts";

console.log(JSON.stringify(projectJsonSchema(), null, 2));
