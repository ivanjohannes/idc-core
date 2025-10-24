import { Redis } from "ioredis";
import config from "../config.js";

const redis_client = new Redis(config.redis.url);

export default redis_client;