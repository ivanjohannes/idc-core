import config from "../../config.js";
import jwt from "jsonwebtoken";
import io from "../../websocket/index.js";

/**
 * @description Creates a token that allows the client to establish a WebSocket connection to a specific namespace.
 * @param {import("../types/index.js").TaskDefinition} task_definition
 * @param {import("../types/index.js").TaskMetrics} task_metrics
 * @param {import("../types/index.js").TaskResults} task_results
 * @param {import("../types/index.js").ActionContext} action_context
 * @param {import("../types/index.js").ExecutionContext} execution_context
 * @returns {Promise<object>} - Updates task_results with websocket connection info.
 */
export default async function (task_definition, task_metrics, task_results, action_context, execution_context) {
  const { namespace = "", rooms = [] } = task_definition?.params ?? {};

  const client_id = execution_context.client_settings.client_id;
  const formatted_namespace = `/${client_id}/` + (namespace ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const formatted_rooms = rooms.map((room) => room.trim().toLowerCase().replace(/\s+/g, "_"));

  // check if namespace exists already
  const namespace_exists = io._nsps.has(formatted_namespace);

  if (!namespace_exists) {
    // create namespace
    const nsp = io.of(formatted_namespace);

    nsp.on("connection", (socket) => {
      // for debugging purposes
      socket.on("pingpong", (msg) => {
        console.log("Message from client:", msg);
        if (msg === "ping") {
          socket.emit("pingpong", "pong");
        }
      });

      socket.on("join_rooms", async (msg) => {
        const token = msg.token;

        const verified_token = await verifyToken(token, formatted_namespace, client_id);

        if (!verified_token) {
          socket.emit("auth_error", "Authentication error");
          return;
        }

        const rooms_to_join = verified_token.rooms || [];

        for (const room of rooms_to_join) {
          // check if socket is already in room
          if (socket.rooms.has(room)) {
            continue;
          }
          socket.join(room);
        }

        console.log(`Socket ${socket.id} joined rooms:`, rooms_to_join);

        socket.emit("join_rooms_success", rooms_to_join);
      });

      socket.on("leave_rooms", async (msg) => {
        const token = msg.token;

        const verified_token = await verifyToken(token, formatted_namespace, client_id);

        if (!verified_token) {
          socket.emit("auth_error", "Authentication error");
          return;
        }

        const rooms_to_leave = verified_token.rooms || [];

        for (const room of rooms_to_leave) {
          // check if socket is actually in room
          if (!socket.rooms.has(room)) {
            continue;
          }
          socket.leave(room);
        }

        socket.emit("leave_rooms_success", rooms_to_leave);
      });
    });

    nsp.use(async (socket, next) => {
      // authenticate the socket connection
      const token = socket.handshake.auth.token;

      const verified_token = await verifyToken(token, formatted_namespace, client_id);

      if (!verified_token) {
        next(new Error("Authentication error"));
        socket.disconnect(true);
        return;
      }

      socket.data.auth_token = verified_token;

      next();
    });
  }

  // generate token for client
  task_results.token = jwt.sign(
    {
      sub: execution_context.client_settings.client_id,
      namespace: formatted_namespace,
      rooms: formatted_rooms,
    },
    config.jwt_keys.private,
    {
      algorithm: "RS256",
      expiresIn: "20m",
      issuer: execution_context.client_settings.environment_settings.idc_core_url,
      keyid: config.jwt_keys.key_id,
    }
  );

  task_results.url = config.idc_gateway.url + formatted_namespace;
  task_results.client_id = client_id;

  task_metrics.is_success = true;
}

async function verifyToken(token, namespace, client_id) {
  try {
    const verified_token = await new Promise((resolve, reject) => {
      jwt.verify(token, config.jwt_keys.public, { algorithms: ["RS256"] }, (err, decoded) => {
        if (err) return reject(err);
        resolve(decoded);
      });
    });

    if (verified_token.sub !== client_id) {
      throw new Error("Invalid token subject");
    }

    if (verified_token.namespace !== namespace) {
      throw new Error("Invalid token namespace");
    }

    return verified_token;
  } catch (err) {
    return null;
  }
}
