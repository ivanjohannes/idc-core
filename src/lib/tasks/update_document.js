import {
  executeWithRedisLock,
  extractCollectionNameFromIdcID,
  revertDocumentVersion,
  saveDocumentVersion,
} from "../utils/index.js";

/**
 * @description Updates a document in the specified collection.
 * @param {import("../types/index.js").TaskDefinition} task_definition
 * @param {import("../types/index.js").TaskMetrics} task_metrics
 * @param {import("../types/index.js").TaskResults} task_results
 * @param {import("../types/index.js").ActionContext} action_context
 * @param {import("../types/index.js").ExecutionContext} execution_context
 * @returns {Promise<object>} - The result of the document update.
 */
export default async function (task_definition, task_metrics, task_results, action_context, execution_context) {
  // register a is_reverted callback
  execution_context.on_error_callbacks.push(function () {
    task_metrics.is_reverted = true;
  });

  const lock_key = task_definition.params?.idc_id;

  async function task() {
    const versions_collection_name = "idc-versions";
    const { idc_id, update } = task_definition.params;

    // Validate input
    if (!idc_id || !update) {
      throw "Invalid task definition";
    }

    // get the collection name
    const collection_name = extractCollectionNameFromIdcID(idc_id);

    // get the last version_doc
    const document = await execution_context.mongodb.collection(collection_name).findOne({ idc_id });

    const latest_version_doc = await execution_context.mongodb
      .collection(versions_collection_name)
      .findOne({ document_idc_id: idc_id }, { sort: { "document.idc_version": -1 } });

    // set updates
    let updates;
    if (Array.isArray(update)) {
      updates = [...update];
    } else {
      updates = [update];
    }
    updates.push({
      $set: {
        updatedAt: new Date(),
        idc_version: (latest_version_doc?.document?.idc_version || 0) + 1,
      },
    });

    // update the document
    const updated_document = await execution_context.mongodb
      .collection(collection_name)
      .findOneAndUpdate({ idc_id }, updates, {
        returnDocument: "after",
      });

    // set a callback to revert the updated document
    execution_context.on_error_callbacks.push(async () => {
      await revertDocumentVersion(idc_id, document?.idc_version, action_context, execution_context);
    });

    // update the document version
    const version_result = await saveDocumentVersion(idc_id, action_context, execution_context);

    // set a callback to delete the created version document
    execution_context.on_error_callbacks.push(async () => {
      await execution_context.mongodb.collection("idc-versions").deleteOne({ idc_id: version_result.idc_id });
    });

    task_results.document = updated_document;

    task_metrics.is_success = true;
  }

  const lockedTask = executeWithRedisLock(lock_key, execution_context, task);

  await lockedTask();
}
