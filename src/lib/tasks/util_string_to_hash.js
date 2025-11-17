import crypto from "crypto";
import _ from "lodash";

/**
 * @description Creates a hash of a string.
 * @param {import("../types/index.js").TaskDefinition} task_definition
 * @param {import("../types/index.js").TaskMetrics} task_metrics
 * @param {import("../types/index.js").TaskResults} task_results
 * @param {import("../types/index.js").ActionContext} action_context
 * @param {import("../types/index.js").ExecutionContext} execution_context
 * @returns {Promise<object>} - The result of the successful task.
 */
export default async function (task_definition, task_metrics, task_results, action_context, execution_context) {

  const unhashed_string = task_definition.params?.unhashed_string;

  const hashed_string = crypto.createHash("sha256").update(unhashed_string).digest("hex");

  _.set(task_results, "hashed_string", hashed_string);

  execution_context.on_error_callbacks.push(async () => {
    _.unset(task_results, "hashed_string");
  });
  
  task_metrics.is_success = true;
}
