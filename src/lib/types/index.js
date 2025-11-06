import { Db } from "mongodb";

/**
 * @typedef {object} ExecutionContext
 * @property {object} client_settings
 * @property {string} [client_settings.name]
 * @property {string} [client_settings.client_id]
 * @property {string} [client_settings.environment_idc_id]
 * @property {object} [client_settings.environment_settings]
 * @property {string} [client_settings.environment_settings.name]
 * @property {string} [client_settings.environment_settings.idc_core_url]
 * @property {Db} [mongodb]
 * @property {Array<Function>} [on_error_callbacks]
*/

/**
 * @typedef {object} ActionContext
 * @property {ActionDefinition} action_definition
 * @property {string} [idc_id]
 * @property {ActionMetrics} [action_metrics]
 * @property {Record<string, TaskDefinition>} [evaluated_tasks_definitions]
 * @property {Record<string, TaskMetrics>} [tasks_metrics]
 * @property {Record<string, TaskResults>} [tasks_results]
*/

/**
 * @typedef {object} ActionMetrics
 * @property {number} [execution_time_ms]
 * @property {boolean} [is_success]
 * @property {string} [error_message]
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
 * @property {boolean} [is_secret_task_definition]
 * @property {string} [is_secret_task_results]
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
