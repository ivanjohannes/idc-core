import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);

// Socket.IO on the primary service
const io = new Server(server, {
  cors: {
    origin: "*", // allow all because gateway may forward unknown origins
    methods: ["GET", "POST"]
  }
});

io.on("connection", (socket) => {
  console.log("[Primary] Client connected:", socket.id);

  socket.on("message", (msg) => {
    console.log("[Primary] Received:", msg);
    socket.emit("reply", `Primary echoes: ${msg}`);
  });
});

app.get("/test", (req, res) => {
  res.send("Primary service running.");
});

server.listen(3001, () => {
  console.log("Primary service listening on http://localhost:3001");
});
