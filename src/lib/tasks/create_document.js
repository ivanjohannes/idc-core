import { generateIdcID, saveDocumentVersion } from "../utils/index.js";

/**
 * @description Creates a document in the specified collection.
 * @param {import("../types/index.js").TaskDefinition} task_definition
 * @param {import("../types/index.js").TaskMetrics} task_metrics
 * @param {import("../types/index.js").TaskResults} task_results
 * @param {import("../types/index.js").ActionContext} action_context
 * @param {import("../types/index.js").ExecutionContext} execution_context
 * @returns {Promise<object>} - The result of the document creation.
 */
export default async function (task_definition, task_metrics, task_results, action_context, execution_context) {
  // register a is_reverted callback
  execution_context.on_error_callbacks.push(function () {
    task_metrics.is_reverted = true;
  });

  const { collection_name, payload } = task_definition.params;

  // Validate input
  if (!collection_name || !payload) {
    throw "Invalid task definition";
  }

  // generate the idc_id
  const idc_id = await generateIdcID(collection_name, execution_context);

  // create the document
  const timestamp = new Date();
  const document = await execution_context.mongodb.collection(collection_name).findOneAndUpdate(
    { idc_id },
    {
      $set: {
        ...payload,
        idc_id,
        idc_version: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    },
    {
      upsert: true,
      returnDocument: "after",
    }
  );

  // set a callback to delete the created document
  execution_context.on_error_callbacks.push(async () => {
    await execution_context.mongodb.collection(collection_name).deleteOne({ idc_id });
  });
  
  // update the document version
  const version_result = await saveDocumentVersion(idc_id, action_context, execution_context);


  // set a callback to delete the created version document
  execution_context.on_error_callbacks.push(async () => {
    await execution_context.mongodb.collection("idc-versions").deleteOne({ idc_id: version_result.idc_id });
  });

  task_results.document = document;

  task_metrics.is_success = true;
}
