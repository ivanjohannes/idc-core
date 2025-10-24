/**
 * @description Throws an error to simulate a task error.
 * @param {import("../types/index.js").TaskDefinition} task_definition
 * @param {import("../types/index.js").TaskMetrics} task_metrics
 * @param {import("../types/index.js").TaskResults} task_results
 * @param {import("../types/index.js").ActionContext} action_context
 * @param {import("../types/index.js").ExecutionContext} execution_context
 * @returns {Promise<object>} - Throws an error.
 */
export default async function (task_definition, task_metrics, task_results, action_context, execution_context) {
    throw "Simulated task error";
}
