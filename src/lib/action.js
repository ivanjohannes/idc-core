import { evaluateTemplate, generateIdcID, precisionTimer } from "./utils/index.js";
import * as task_functions from "./tasks/index.js";
import { fanout_publish } from "../rabbitmq/index.js";

/**
 * @description Executes the given action.
 * @param {import("./types/index.js").ActionContext} action_context
 * @param {import("./types/index.js").ExecutionContext} execution_context
 * @returns {Promise<import("./types/index.js").ActionContext>} - The action context containing task results.
 */
export default async function (action_context, execution_context) {
  const action_timer = precisionTimer("action");
  // check there is a action_definition
  if (!action_context || !action_context.action_definition) {
    throw "No action_definition provided in action_context";
  }

  // set is_success to true
  action_context.action_metrics = {};
  action_context.action_metrics.is_success = true;

  // set the on_error_callbacks
  execution_context.on_error_callbacks = [];

  try {
    // default tasks_definitions to {}
    if (!action_context.action_definition.tasks_definitions) action_context.action_definition.tasks_definitions = {};

    // get the ordered list of tasks_definitions to execute
    const ordered_task_definitions = Object.entries(action_context.action_definition.tasks_definitions)
      .reduce((acc, [task_name, task_definition]) => {
        // validate function
        if (!task_definition.function || !(task_definition.function in task_functions)) {
          throw `Invalid function: ${task_definition.function}`;
        }

        // set defaults
        if (!task_definition.name) task_definition.name = task_name;
        if (!task_definition.execution_order) task_definition.execution_order = Number.MAX_SAFE_INTEGER;
        acc.push(task_definition);
        return acc;
      }, [])
      .sort((a, b) => a.execution_order - b.execution_order);

    // generate idc_id
    action_context.idc_id = await generateIdcID("idc-actions", execution_context);

    // set tasks_metrics to { is_attempted: false }
    action_context.tasks_metrics = ordered_task_definitions.reduce((acc, task_definition) => {
      acc[task_definition.name] = { is_attempted: false };
      return acc;
    }, {});

    // set tasks_results to {}
    action_context.tasks_results = {};
    action_context.evaluated_tasks_definitions = {};

    // execute tasks_definitions in order
    for (const task_definition of ordered_task_definitions) {
      const task_timer = precisionTimer(task_definition.name);
      const evaluated_task_definition = await evaluateTemplate(task_definition, action_context);
      const task_metrics = action_context.tasks_metrics[evaluated_task_definition.name];
      task_metrics.ms_since_action_start = action_timer(evaluated_task_definition.name);
      const task_results = (action_context.tasks_results[evaluated_task_definition.name] = {});
      task_metrics.is_conditions_passed = (evaluated_task_definition.conditions ?? []).every((c) =>
        Boolean(c.expression)
      );
      if (!task_metrics.is_conditions_passed) continue;
      task_metrics.is_attempted = true;
      try {
        await task_functions[evaluated_task_definition.function](
          evaluated_task_definition,
          task_metrics,
          task_results,
          action_context,
          execution_context
        );
      } catch (err) {
        console.error("🔴 - Task error -", evaluated_task_definition.name, err);
        task_metrics.error = String(err);
      }
      task_metrics.execution_time_ms = task_timer("stop");
      action_context.evaluated_tasks_definitions[evaluated_task_definition.name] = evaluated_task_definition;
      if (!task_metrics.is_success) {
        if (evaluated_task_definition.is_continue_if_error) {
          console.log(`🟡 - Task error but continuing: ${evaluated_task_definition.name}`);
        } else {
          throw "Task failed";
        }
      }
    }

    // publish task results to a fanout exchange
    for (const [task_name, task_results] of Object.entries(action_context.tasks_results)) {
      const evaluated_task_definition = action_context.evaluated_tasks_definitions[task_name];
      const task_function = evaluated_task_definition.function;

      const exchange_name = `idc-tasks.${execution_context.client_id}.${task_function}`;
      fanout_publish(
        exchange_name,
        JSON.stringify({
          task_name,
          task_results,
          evaluated_task_definition,
        })
      );
    }

    console.log(`🟢 - Action executed: ${action_context.idc_id}`);
  } catch (err) {
    console.error("🔴 - Action error:", err);
    action_context.action_metrics.is_success = false;

    // execute the on_error_callbacks in reverse order
    for (let i = execution_context.on_error_callbacks.length - 1; i >= 0; i--) {
      try {
        await execution_context.on_error_callbacks[i](action_context);
      } catch (callback_err) {
        console.error("🔴 - on_error_callback error:", callback_err);
      }
    }
  }

  // set action execution time
  action_context.action_metrics.execution_time_ms = action_timer("stop");

  // create the action document in the database
  await execution_context.mongodb.collection("idc-actions").insertOne({
    idc_id: action_context.idc_id,
    action_metrics: action_context.action_metrics,
    action_definition: action_context.action_definition,
    tasks_metrics: action_context.tasks_metrics,
    created_at: new Date(),
  });

  return action_context;
}
