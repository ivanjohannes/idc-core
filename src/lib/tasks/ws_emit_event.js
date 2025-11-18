import io from "../../websocket/index.js";

/**
 * @description Emits an event to a WebSocket namespace and optional rooms.
 * @param {import("../types/index.js").TaskDefinition} task_definition
 * @param {import("../types/index.js").TaskMetrics} task_metrics
 * @param {import("../types/index.js").TaskResults} task_results
 * @param {import("../types/index.js").ActionContext} action_context
 * @param {import("../types/index.js").ExecutionContext} execution_context
 * @returns {Promise<object>} - Updates task_results with emission status.
 */
export default async function (task_definition, task_metrics, task_results, action_context, execution_context) {
  const { namespace = "", room, event, payload } = task_definition?.params ?? {};

  if (!event) {
    throw "Event name is required to emit a WebSocket event";
  }

  const client_id = execution_context.client_settings.client_id;
  const formatted_namespace = `/${client_id}/` + (namespace ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const formatted_room = room?.trim().toLowerCase().replace(/\s+/g, "_");

  // check if namespace exists already
  const namespace_exists = io._nsps.has(formatted_namespace);

  if (namespace_exists) {
    // emit event
    const nsp = io.of(formatted_namespace);
    if (formatted_room) {
      nsp.to(formatted_room).emit(event, payload);
    } else {
      nsp.emit(event, payload);
    }
  }

  task_metrics.is_success = true;
}
