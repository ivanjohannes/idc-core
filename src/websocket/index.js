import { Server } from "socket.io";
import http from "../http/index.js";

// Socket.IO on the core service
const io = new Server(http, {
  cors: {
    origin: "*", // allow all because gateway may forward unknown origins
    methods: ["GET", "POST"],
  },
});

console.log("🟢 - WebSocket server initialized");

export default io;
