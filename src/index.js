import config from "./config.js";
import http_app from "./http/index.js";
import mongodb_client from "./mongodb/index.js";

console.log("🟡 - idc-core starting");

// Redis connection
if (config.redis.url) {
  const redis_client = await import("./redis/index.js").then((mod) => mod.default);
  await new Promise((resolve, reject) => {
    checkStatus();
    function checkStatus() {
      if (redis_client.status === "ready") {
        console.log("🟢 - Redis connected");
        resolve();
      } else if (redis_client.status === "end" || redis_client.status === "reconnecting") {
        console.error("🔴 - Redis failed to connect:", redis_client.status);
        reject(new Error("Redis connection failed"));
        process.exit(1);
      } else {
        setTimeout(checkStatus, 100);
      }
    }
  });
} else {
  console.error("🔴 - REDIS_CLIENT_URL is not defined in the environment variables.");
  process.exit(1);
}
// END Redis connection

// MongoDB connection
if (config.mongodb.url) {
  await mongodb_client
    .connect()
    .then(() => {
      console.log("🟢 - MongoDB connected");
    })
    .catch((err) => {
      console.error(`🔴 - MongoDB failed to connect:`, err);
      process.exit(1);
    });
} else {
  console.error("🔴 - MONGODB_CLIENT_URL is not defined in the environment variables.");
  process.exit(1);
}
// END MongoDB connection

// RabbitMQ connection
if (config.rabbitmq.url) {
  try {
    await import("./rabbitmq/index.js");
    console.log("🟢 - RabbitMQ connected");
  } catch (err) {
    console.error("🔴 - RabbitMQ failed to connect:", err);
  }
} else {
  console.error("🔴 - RABBITMQ_CLIENT_URL is not defined in the environment variables.");
  process.exit(1);
}
// END RabbitMQ connection

// HTTP server
if (config.http.port) {
  await new Promise((resolve) => {
    http_app.listen(config.http.port, (err) => {
      if (err) {
        console.error(`🔴 - HTTP failed to start:`, err);
        process.exit(1);
      }
      console.log(`🟢 - HTTP listening on port ${config.http.port}`);
      resolve();
    });
  });
} else {
  console.error("🔴 - HTTP_PORT is not defined in the environment variables.");
  process.exit(1);
}
// END HTTP server

console.log("🟢 - idc-core started");
