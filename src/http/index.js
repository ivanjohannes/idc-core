import express from "express";
import { createServer } from "http";
import { attachClientSettings } from "./middleware.js";
import { action_controller, ping_controller, task_controller } from "./controllers.js";

const app = express();

// MIDDLEWARE
app.use(express.json());
app.use(attachClientSettings)
// END MIDDLEWARE

// ROUTES
app.get("/ping", ping_controller);
app.post("/task", task_controller);
app.post("/action", action_controller);
// END ROUTES

// HTTP Server
const http = createServer(app);

export default http;
