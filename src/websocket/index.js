import { Server } from "socket.io";
import http from "../http/index.js";

// Socket.IO on the core service
const io = new Server(http, {
  cors: {
    origin: "*", // allow all because gateway may forward unknown origins
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("[Core] Client connected:", socket.id);

  socket.on("message", (msg) => {
    console.log("[Primary] Received:", msg);
    socket.emit("reply", `Primary echoes: ${msg}`);
  });
});

console.log("🟢 - WebSocket server initialized");

export default io;
