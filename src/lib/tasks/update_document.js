import { executeWithRedisLock, extractCollectionNameFromIdcID, saveDocumentVersion } from "../utils/index.js";

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
  const lock_key = task_definition.params?.idc_id;

  async function task() {
    const { idc_id, update } = task_definition.params;

    // Validate input
    if (!idc_id || !update) {
      throw "Invalid task definition";
    }

    // check db
    const collection_name = extractCollectionNameFromIdcID(idc_id);
    const versions_collection_name = "idc-versions";
    const db_result = await execution_context.mongodb
      .collection(collection_name)
      .aggregate([
        {
          $match: {
            idc_id,
          },
        },
        {
          $replaceRoot: {
            newRoot: {
              document: "$$ROOT",
            },
          },
        },
        {
          $lookup: {
            from: versions_collection_name,
            let: { document_idc_id: idc_id },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [{ $eq: ["$document_idc_id", "$$document_idc_id"] }],
                  },
                },
              },
              { $sort: { idc_version: -1 } },
              { $limit: 1 },
            ],
            as: "latest_version",
          },
        },
        {
          $unwind: {
            path: "$latest_version",
            preserveNullAndEmptyArrays: true,
          },
        },
      ])
      .toArray();
    const document_data = db_result[0];

    if (!document_data?.document) {
      throw `Cannot update document ${idc_id}: Document not found`;
    }

    const doc_is_latest = document_data?.document?.idc_version > (document_data?.latest_version?.idc_version || 0);
    if (doc_is_latest) {
      // save the document version
      const version_result = await saveDocumentVersion(document_data.document, action_context, execution_context);

      // set a callback to delete the created version document
      execution_context.on_error_callbacks.push(async () => {
        await execution_context.mongodb
          .collection(versions_collection_name)
          .deleteOne({ idc_id: version_result.idc_id });
      });
    }

    const new_idc_version = doc_is_latest
      ? document_data.document.idc_version + 1
      : (document_data.latest_version?.idc_version || 0) + 1;
    const new_from_idc_version = document_data.document.idc_version;

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
        idc_version: new_idc_version,
        from_idc_version: new_from_idc_version,
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
      await execution_context.mongodb.collection(collection_name).findOneAndUpdate(
        { idc_id },
        {
          $set: document_data.document,
        },
        {
          returnDocument: "after",
        }
      );
    });

    task_results.document = updated_document;

    task_metrics.is_success = true;
  }

  const lockedTask = executeWithRedisLock(lock_key, execution_context, task);

  await lockedTask();
}
