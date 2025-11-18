import mongodb from "../src/mongodb/index.js";
import { createHash, generateIdcID } from "../src/lib/utils/index.js";
import readline from "readline/promises";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const idc_core_url = await rl.question("Enter the environment core url: ");
if (!idc_core_url) {
  console.log("Environment core url is required");
  process.exit(1);
}
const client_id = await rl.question("Enter the client id: ");
if (!client_id) {
  console.log("Client id is required");
  process.exit(1);
}
const api_key = await rl.question("Enter the client api key: ");
if (!api_key) {
  console.log("Client api key is required");
  process.exit(1);
}
const client_name = (await rl.question("Enter the client name (defaults to " + client_id + "): ")) || client_id;
const environment_name =
  (await rl.question("Enter the environment name (defaults to " + client_id + "): ")) || client_id;

const db = mongodb.db(client_id);
const api_key_hash = createHash(api_key);
const environment_idc_id = await generateIdcID("environments", { mongodb: db });
const timestamp = new Date();
const base_doc = {
  from_idc_version: 0,
  idc_version: 1,
  createdAt: timestamp,
  updatedAt: timestamp,
};

await db.collection("environments").insertOne({
  ...base_doc,
  idc_id: environment_idc_id,
  settings: {
    name: environment_name,
    idc_core_url,
  },
});

await db.collection("clients").insertOne({
  ...base_doc,
  idc_id: await generateIdcID("clients", { mongodb: db }),
  api_key_hash,
  settings: {
    name: client_name,
    client_id: client_id,
    environment_idc_id: environment_idc_id,
  },
});

process.exit(0);
