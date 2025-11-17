import { executeWithRedisLock, extractCollectionNameFromIdcID } from "../utils/index.js";

/**
 * @description Restores a deleted document in the specified collection.
 * @param {import("../types/index.js").TaskDefinition} task_definition
 * @param {import("../types/index.js").TaskMetrics} task_metrics
 * @param {import("../types/index.js").TaskResults} task_results
 * @param {import("../types/index.js").ActionContext} action_context
 * @param {import("../types/index.js").ExecutionContext} execution_context
 * @returns {Promise<object>} - The result of the document restoration.
 */
export default async function (task_definition, task_metrics, task_results, action_context, execution_context) {
  const lock_key = task_definition.params?.idc_id;

  async function task() {
    const { idc_id } = task_definition.params;

    // Validate input
    if (!idc_id) {
      throw "Invalid task definition";
    }

    // check db
    const collection_name = extractCollectionNameFromIdcID(idc_id);
    const versions_collection_name = "idc-versions";
    const db_result = await execution_context.mongodb
      .collection(versions_collection_name)
      .aggregate([
        {
          $match: {
            document_idc_id: idc_id,
          },
        },
        {
          $sort: { idc_version: -1 },
        },
        { $limit: 1 },
        {
          $lookup: {
            from: collection_name,
            localField: "document_idc_id",
            foreignField: "idc_id",
            as: "current_document",
          },
        },
        {
          $unwind: {
            path: "$current_document",
            preserveNullAndEmptyArrays: true,
          },
        },
      ])
      .toArray();
    const version_data = db_result[0];

    if (!version_data) {
      throw `Cannot restore document ${idc_id}: No version history found`;
    }

    if (version_data.current_document) {
      throw `Cannot restore document ${idc_id}: Document already exists`;
    }

    // restore the document
    const updated_document = await execution_context.mongodb.collection(collection_name).findOneAndUpdate(
      { idc_id },
      {
        $set: {
          ...version_data.document,
          idc_version: version_data.idc_version + 1,
          from_idc_version: version_data.idc_version,
        },
      },
      {
        returnDocument: "after",
        upsert: true,
      }
    );

    // set a callback to delete the recreated document
    execution_context.on_error_callbacks.push(async () => {
      await execution_context.mongodb.collection(collection_name).deleteOne({ idc_id });
    });

    task_results.document = updated_document;

    task_metrics.is_success = true;
  }

  const lockedTask = executeWithRedisLock(lock_key, execution_context, task);

  await lockedTask();
}
