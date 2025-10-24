import { Db } from "mongodb";

/**
 * @typedef {object} ExecutionContext
 * @property {string} [client_id]
 * @property {Db} [mongodb]
 * @property {Array<Function>} [on_error_callbacks]
 */

/**
 * @typedef {object} ActionContext
 * @property {ActionDefinition} action_definition
 * @property {string} [idc_id]
 * @property {ActionMetrics} [action_metrics]
 * @property {Record<string, TaskMetrics>} [tasks_metrics]
 * @property {Record<string, TaskResults>} [tasks_results]
 * @property {import("mongodb").Document} [document]
 * @property {Record<string, TaskDefinition>} [evaluated_tasks_definitions]
*/

/**
 * @typedef {object} ActionMetrics
 * @property {number} [execution_time_ms]
 * @property {boolean} [is_success]
 */

/**
 * @typedef {object} ActionDefinition
 * @property {Record<string, TaskDefinition>} tasks_definitions
 */

/**
 * @typedef {object} TaskDefinition
 * @property {string} function
 * @property {string} [name]
 * @property {number} [execution_order]
 * @property {object} [params]
 * @property {object} [conditions]
 * @property {boolean} [is_continue_if_error]
 * @property {TaskCondition[]} [conditions]
 */

/**
 * @typedef {object} TaskMetrics
 * @property {boolean} is_attempted
 * @property {boolean} [is_success]
 * @property {number} [execution_time_ms]
 * @property {number} [ms_since_action_start]
 * @property {boolean} [is_reverted]
 * @property {boolean} [is_conditions_passed]
 * @property {string} [error]
 */

/**
 * @typedef {any} TaskResults
 */

/**
 * @typedef {object} TaskCondition
 * @property {string} expression
 */
