import express from "express";
import router from "./routes.js";

const http_app = express();

http_app.use(router);

export default http_app;
