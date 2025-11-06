import config from "../../config.js";
import jwt from "jsonwebtoken";

/**
 * @description Generates settings that allow the client to establish a WebSocket connection.
 * @param {import("../types/index.js").TaskDefinition} task_definition
 * @param {import("../types/index.js").TaskMetrics} task_metrics
 * @param {import("../types/index.js").TaskResults} task_results
 * @param {import("../types/index.js").ActionContext} action_context
 * @param {import("../types/index.js").ExecutionContext} execution_context
 * @returns {Promise<object>} - Updates task_results with websocket connection info.
 */
export default async function (task_definition, task_metrics, task_results, action_context, execution_context) {
  task_results.token = jwt.sign(
    {
      sub: execution_context.client_settings.client_id,
    },
    config.jwt_keys.private,
    {
      algorithm: "RS256",
      expiresIn: "20m",
      issuer: execution_context.client_settings.environment_settings.idc_core_url,
      keyid: config.jwt_keys.key_id,
    }
  );

  task_results.url = config.idc_gateway.url;

  task_metrics.is_success = true;
}
