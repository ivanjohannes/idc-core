import express from "express";
import { action_controller, ping_controller, task_controller } from "./controllers.js";

const router = express.Router();

// MIDDLEWARE
router.use(express.json());
// END MIDDLEWARE

// ROUTES
router.get("/ping", ping_controller);
router.post("/task", task_controller);
router.post("/action", action_controller);
// END ROUTES

export default router;
