import action from "../lib/action.js";
import mongodb_client from "../mongodb/index.js";

export async function ping_controller(req, res) {
  try {
    console.log("🟢 - Ping received");

    res.status(200).send("idc-core is alive!");
  } catch (err) {
    console.error("🔴 - Error occurred in ping_controller:", err);
    res.status(500).json({ error: err.message });
  }
}

export async function task_controller(req, res) {
  try {
    // check that there is a task_definition in the body
    if (!req.body?.task_definition)
      return res.status(400).json({ error: "No task_definition provided in request body" });

    // update the request body with an action_definition that wraps the task_definition
    req.body.action_definition = {
      tasks_definitions: {
        task: req.body.task_definition,
      },
    };

    console.log("🟡 - Wrapping task_definition in action_definition");

    // pass to the action_controller
    await action_controller(req, res);
  } catch (err) {
    console.error("🔴 - Error occurred in task_controller:", err);
    res.status(500).json({ error: err.message });
  }
}

export async function action_controller(req, res) {
  try {
    const client_settings = req.client_settings;
    if (!client_settings?.client_id) {
      throw "no client_id";
    }

    // check that there is an action_definition in the body
    if (!req.body?.action_definition)
      return res.status(400).json({ error: "No action_definition provided in request body" });

    // build action_context
    const action_context = {};

    // build a execution_context
    const execution_context = {};

    // populate execution_context
    execution_context.client_settings = client_settings;
    execution_context.mongodb = mongodb_client.db(execution_context.client_settings.client_id);
    
    // set action_definition
    action_context.action_definition = req.body.action_definition;
    
    // execute action
    await action(action_context, execution_context);

    res.status(action_context?.action_metrics?.is_success ? 200 : 400).json(action_context);
  } catch (err) {
    console.error("🔴 - Error occurred in action_controller:", err);
    res.status(500).json({ error: err.message });
  }
}
