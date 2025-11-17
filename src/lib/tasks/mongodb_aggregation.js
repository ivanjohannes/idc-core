/**
 * @description Does a MongoDB aggregation pipeline and returns the result.
 * @param {import("../types/index.js").TaskDefinition} task_definition
 * @param {import("../types/index.js").TaskMetrics} task_metrics
 * @param {import("../types/index.js").TaskResults} task_results
 * @param {import("../types/index.js").ActionContext} action_context
 * @param {import("../types/index.js").ExecutionContext} execution_context
 * @returns {Promise<object>} - The result of the MongoDB aggregation pipeline.
 */
export default async function (task_definition, task_metrics, task_results, action_context, execution_context) {
  const { collection_name, pipeline } = task_definition.params;

  // Validate input
  if (!collection_name || !pipeline) {
    throw "Invalid task definition";
  }

  // Perform MongoDB aggregation pipeline
  const data = await execution_context.mongodb.collection(collection_name).aggregate(pipeline).toArray();

  task_results.data = data;

  task_metrics.is_success = true;
}
