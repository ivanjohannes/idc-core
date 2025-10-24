import Redlock from "redlock";
import redis_client from "./index.js";

const redlock = new Redlock([redis_client], {
  driftFactor: 0.01, // time in ms
  retryCount: 10,
  retryDelay: 200, // time in ms
  retryJitter: 200, // time in ms
});

export default redlock;