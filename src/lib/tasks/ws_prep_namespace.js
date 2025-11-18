import config from "../../config.js";
import io from "../../websocket/index.js";
import { verifyJWT } from "../utils/index.js";

/**
 * @description Makes sure a namespace is prepared for WebSocket connections.
 * @param {import("../types/index.js").TaskDefinition} task_definition
 * @param {import("../types/index.js").TaskMetrics} task_metrics
 * @param {import("../types/index.js").TaskResults} task_results
 * @param {import("../types/index.js").ActionContext} action_context
 * @param {import("../types/index.js").ExecutionContext} execution_context
 * @returns {Promise<object>} - Updates task_results with websocket connection info.
 */
export default async function (task_definition, task_metrics, task_results, action_context, execution_context) {
  const { namespace = "" } = task_definition?.params ?? {};

  if (!namespace) {
    throw "Invalid task definition";
  }

  const client_id = execution_context.client_settings.client_id;

  const formatted_namespace = (namespace ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const client_namespace = `/${client_id}/` + formatted_namespace;

  // check if namespace exists already
  const namespace_exists = io._nsps.has(client_namespace);

  if (!namespace_exists) {
    // create namespace
    const nsp = io.of(client_namespace);

    nsp.on("connection", (socket) => {
      // for debugging purposes
      socket.on("pingpong", (msg) => {
        if (msg === "ping") {
          socket.emit("pingpong", "pong");
        }
      });

      socket.on("join_rooms", async (msg) => {
        const token = msg.token;

        const verified_token = await verifyJWT(token, client_id);

        if (!verified_token || verified_token.payload?.namespace !== formatted_namespace) {
          socket.emit("auth_error", "Authentication error");
          return;
        }

        const rooms_to_join = verified_token.payload?.rooms || [];

        for (const room of rooms_to_join) {
          // check if socket is already in room
          if (socket.rooms.has(room)) {
            continue;
          }
          socket.join(room);
        }

        socket.emit("join_rooms_success", rooms_to_join);
      });

      socket.on("leave_rooms", async (msg) => {
        const rooms_to_leave = msg?.rooms || [];

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

      const verified_token = await verifyJWT(token, client_id);

      if (!verified_token || verified_token.payload?.namespace !== formatted_namespace) {
        next(new Error("Authentication error"));
        socket.disconnect(true);
        return;
      }

      next();
    });
  }

  task_results.url = config.idc_gateway.url + client_namespace;

  task_results.client_id = client_id;

  task_metrics.is_success = true;
}
