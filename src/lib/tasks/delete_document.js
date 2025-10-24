import { executeWithRedisLock, extractCollectionNameFromIdcID, revertDocumentVersion } from "../utils/index.js";

/**
 * @description Deletes a document in the specified collection.
 * @param {import("../types/index.js").TaskDefinition} task_definition
 * @param {import("../types/index.js").TaskMetrics} task_metrics
 * @param {import("../types/index.js").TaskResults} task_results
 * @param {import("../types/index.js").ActionContext} action_context
 * @param {import("../types/index.js").ExecutionContext} execution_context
 * @returns {Promise<object>} - The result of the document deletion.
 */
export default async function (task_definition, task_metrics, task_results, action_context, execution_context) {
  // register a is_reverted callback
  execution_context.on_error_callbacks.push(function () {
    task_metrics.is_reverted = true;
  });

  const lock_key = task_definition.params?.idc_id;

  async function task() {
    const { idc_id } = task_definition.params;

    // Validate input
    if (!idc_id) {
      throw "Invalid task definition";
    }

    // get the collection name
    const collection_name = extractCollectionNameFromIdcID(idc_id);

    // get the last version_doc
    const document = await execution_context.mongodb.collection(collection_name).findOne({ idc_id });

    // delete the document
    await execution_context.mongodb.collection(collection_name).deleteOne({ idc_id });

    // set a callback to recreate the deleted document
    execution_context.on_error_callbacks.push(async () => {
      await revertDocumentVersion(idc_id, document?.idc_version, action_context, execution_context);
    });

    task_results.is_document_deleted = true;
    task_results.document = { idc_id };

    task_metrics.is_success = true;
  }

  const lockedTask = executeWithRedisLock(lock_key, execution_context, task);

  await lockedTask();
}
