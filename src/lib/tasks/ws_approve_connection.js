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
  const { namespace } = task_definition?.params ?? {};

  const client_id = execution_context.client_settings.client_id;
  const formatted_namespace = `/${client_id}/` + (namespace ?? "").trim().toLowerCase().replace(/\s+/g, "_");

  // check if namespace exists already
  const namespace_exists = io._nsps.has(formatted_namespace);

  if (!namespace_exists) {
    // create namespace
    const nsp = io.of(formatted_namespace);

    nsp.on("connection", (socket) => {
      console.log(`[WebSocket] Client connected to namespace ${formatted_namespace}:`, socket.id);

      socket.emit("pingpong", "ping");

      socket.on("pingpong", (msg) => {
        console.log("Received from client:", msg);
        if (msg === "ping") {
          socket.emit("pingpong", "pong");
        }
      });
    });

    nsp.use((socket, next) => {
      console.log(`[WebSocket] Middleware for namespace ${formatted_namespace} - Socket ID:`, socket.id);
      next();
    });
  }

  task_results.token = jwt.sign(
    {
      sub: execution_context.client_settings.client_id,
      namespace: formatted_namespace,
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

  task_metrics.is_success = true;
}
