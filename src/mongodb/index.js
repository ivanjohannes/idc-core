import { MongoClient } from "mongodb";
import config from "../config.js";

const mongodb_client = new MongoClient(config.mongodb.url);

export default mongodb_client;