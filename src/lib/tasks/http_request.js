/**
 * @description Does an HTTP request and returns the response.
 * @param {import("../types/index.js").TaskDefinition} task_definition
 * @param {import("../types/index.js").TaskMetrics} task_metrics
 * @param {import("../types/index.js").TaskResults} task_results
 * @param {import("../types/index.js").ActionContext} action_context
 * @param {import("../types/index.js").ExecutionContext} execution_context
 * @returns {Promise<object>} - The result of the http request.
 */
export default async function (task_definition, task_metrics, task_results, action_context, execution_context) {
  const { url, method, headers, body } = task_definition.params;

  // Validate input
  if (!url || !method) {
    throw "Invalid task definition";
  }

  // Perform HTTP request
  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  task_results.response_status = response.status;
  task_results.response_headers = {};
  response.headers.forEach((value, key) => {
    task_results.response_headers[key] = value;
  });
  task_results.response_body = await response.text();
  try {
    task_results.response_json = JSON.parse(task_results.response_body);
  } catch (e) {
    // ignore JSON parse errors
  }

  task_metrics.is_success = response.ok;
}
