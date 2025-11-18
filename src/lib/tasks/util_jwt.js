import config from "../../config.js";
import jwt from "jsonwebtoken";
import { generateRandomString } from "../utils/index.js";
import redis_client from "../../redis/index.js";

/**
 * @description Creates a jwt token with custom payload.
 * @param {import("../types/index.js").TaskDefinition} task_definition
 * @param {import("../types/index.js").TaskMetrics} task_metrics
 * @param {import("../types/index.js").TaskResults} task_results
 * @param {import("../types/index.js").ActionContext} action_context
 * @param {import("../types/index.js").ExecutionContext} execution_context
 * @returns {Promise<object>} - Updates task_results with jwt token.
 */
export default async function (task_definition, task_metrics, task_results, action_context, execution_context) {
  const ninety_days_ms = 90 * 24 * 60 * 60 * 1000;
  const { payload, expiry_ms = ninety_days_ms, allowed_uses } = task_definition?.params ?? {};

  const expiry_seconds = Math.floor(expiry_ms / 1000);

  const client_id = execution_context.client_settings.client_id;

  const token_id = generateRandomString(24);

  // generate token for client
  task_results.token = jwt.sign(
    {
      sub: client_id,
      jti: token_id,
      payload,
    },
    config.jwt_keys.private,
    {
      algorithm: "RS256",
      issuer: execution_context.client_settings.environment_settings.idc_core_url,
      keyid: config.jwt_keys.key_id,
      expiresIn: expiry_seconds,
    }
  );

  // store in redis
  const redis_key = `${client_id}:tokens:${token_id}`;
  const redis_value = Number.isInteger(+allowed_uses) ? String(parseInt(allowed_uses, 10)) : "active";
  await redis_client.set(redis_key, redis_value, "EX", expiry_seconds);

  task_metrics.is_success = true;
}
