import dotenv from "dotenv";
dotenv.config({
  quiet: true,
});

export default {
  show_timer_logs: process.env.SHOW_TIMER_LOGS === "true",
  mongodb: {
    url: process.env.MONGODB_CLIENT_URL,
  },
  rabbitmq: {
    url: process.env.RABBITMQ_CLIENT_URL,
  },
  redis: {
    url: process.env.REDIS_CLIENT_URL,
  },
  http: {
    port: process.env.HTTP_PORT,
  },
};
