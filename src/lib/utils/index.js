import { v4 as uuidv4 } from "uuid";
import config from "../../config.js";
import jsonata from "jsonata";
import Handlebars from "handlebars";
import redlock from "../../redis/redlock.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import redis_client from "../../redis/index.js";

/**
 * @description Timer function to precisely time operations.
 * @param {string} [name="timer"] - The name of the timer.
 * @param {boolean} [is_silent=false] - Whether to suppress console output.
 * @returns {object} - An object with `stop` and `tick` methods.
 */
export function precisionTimer(name = "unnamed", is_silent = !config.show_timer_logs) {
  const _start = process.hrtime();
  if (!is_silent) console.log(`⚪ - start timer ${name}`);
  return function (tick_name = "tick") {
    const _end = process.hrtime(_start);
    const msSinceStart = _end[0] * 1000 + _end[1] / 1000000;
    if (!is_silent) console.log(`⚪ - ${tick_name} timer ${name} - since start: ${msSinceStart}ms`);
    return msSinceStart;
  };
}

/**
 * @description Generates a random string of specified length.
 * @param {number} length - The length of the random string to generate.
 * @returns {string} - The generated random string.
 */
export function generateRandomString(length = 20) {
  return crypto
    .randomBytes(Math.ceil(length / 2))
    .toString("hex")
    .slice(0, length);
}

/**
 * @description Generate a unique document ID for a given collection and database.
 * @param {string} collection_name - The name of the collection.
 * @param {import("../types/index.js").ExecutionContext} execution_context - The tech stack containing the MongoDB instance.
 * @returns {Promise<string>} - The generated document ID.
 */
export async function generateIdcID(collection_name, execution_context) {
  let uuid = uuidv4();
  const idc_id = `${collection_name}~${uuid}`;

  const duplicate = await execution_context.mongodb?.collection(collection_name).findOne({ idc_id });
  if (duplicate) return generateIdcID(collection_name, execution_context);

  return idc_id;
}

/**
 * @description extracts the collection_name from the idc_id assuming the idc_id always ends with ~[uuid]
 * @param {string} idc_id - The IDC ID of the document.
 * @returns {string} - The collection name.
 */
export function extractCollectionNameFromIdcID(idc_id) {
  const parts = idc_id.split("~");
  parts.pop(); // remove the uuid part
  return parts.join("~");
}

/**
 * @description Function to create a new version document
 * @param {import("mongodb").Document} document - The document to create a version for.
 * @param {import("../types/index.js").ActionContext} action_context - The action context containing the MongoDB instance and the idc_id.
 * @param {import("../types/index.js").ExecutionContext} execution_context - The tech stack containing the MongoDB instance.
 * @returns {Promise<object>} - The result of the version creation and update.
 */
export async function saveDocumentVersion(document, action_context, execution_context) {
  const versions_collection_name = "idc-versions";

  if (!document) {
    throw "Cannot save document version: Document not found";
  }

  // create the version document
  const version_idc_id = await generateIdcID(versions_collection_name, execution_context);
  const version_doc = {
    document_idc_id: document.idc_id,
    idc_version: document.idc_version,
    from_idc_version: document.from_idc_version,
    action_idc_id: action_context.idc_id,
    document,
    createdAt: new Date(),
  };
  await execution_context.mongodb.collection(versions_collection_name).findOneAndUpdate(
    {
      document_idc_id: document.idc_id,
      idc_version: document.idc_version,
    },
    {
      $set: version_doc,
      $setOnInsert: {
        idc_id: version_idc_id,
      },
    },
    {
      upsert: true,
      returnDocument: "after",
    }
  );

  return {
    idc_id: version_idc_id,
  };
}

/**
 * @description Evaluates a template using Handlebars or JSONata based on the context provided.
 * @param {any} [template]
 * @param {any} [context]
 * @returns {Promise<any>}
 */
export async function evaluateTemplate(template, context) {
  if (template === undefined) return;
  if (!context) return template;
  let result;

  if (Array.isArray(template)) {
    const promises = template.map((item) => evaluateTemplate(item, context));
    result = await Promise.all(promises);
  } else if (typeof template === "object") {
    const promises = Object.entries(template).map(async ([key, value]) => {
      const evaluatedValue = await evaluateTemplate(value, context);
      return [key, evaluatedValue];
    });
    result = Object.fromEntries(await Promise.all(promises));
  } else if (typeof template === "string") {
    // get the templating key from the start of the template (if any). The templating key must be at the start of the template inside two square brackets like [[jsonata]] = templating language - jsonata
    const templating_key = template.match(/^\[\[(.*?)\]\]/)?.[1];

    if (templating_key === "jsonata") {
      const template_part = template.match(/^\[\[jsonata\]\](.*)/)?.[1] ?? "";
      result = await jsonata(template_part).evaluate(context);
    } else {
      // default to handlebars
      const template_function = Handlebars.compile(template);
      result = template_function(context);
    }
  } else {
    result = template;
  }
  return result;
}

/**
 * @description execute a function by first getting a lock on redis
 * @param {string} lock_key
 * @param {import("../types/index.js").ExecutionContext} execution_context
 * @param {Function} func
 * @returns {Function}
 */
export function executeWithRedisLock(lock_key, execution_context, func) {
  const resource_key = `${execution_context.client_settings.client_id}:locks:${lock_key}`;
  const lock_ttl_ms = 10000; // 10 seconds

  return async function (...args) {
    const lock = await redlock.acquire([resource_key], lock_ttl_ms);

    const interval = setInterval(async () => {
      try {
        await lock.extend(lock_ttl_ms);
      } catch (err) {
        console.error("🔴 - Failed to extend redis lock:", err);
      }
    }, lock_ttl_ms / 2);

    try {
      return await func(...args);
    } catch (err) {
      throw err;
    } finally {
      clearInterval(interval);
      await redlock.release(lock);
    }
  };
}

/**
 * @description Verifies a JWT token
 * @param {string} token
 * @param {string} client_id
 * @returns {Promise<object|null>} - The verified token payload or null if verification fails.
 */
export async function verifyJWT(token, client_id) {
  try {
    const verified_token = await new Promise((resolve, reject) => {
      jwt.verify(token, config.jwt_keys.public, { algorithms: ["RS256"] }, (err, decoded) => {
        if (err) return reject(err);
        resolve(decoded);
      });
    });

    if (verified_token.sub !== client_id) {
      throw new Error("Invalid token subject");
    }

    const redis_key = `${client_id}:tokens:${verified_token.jti}`;
    const token_status = await redis_client.get(redis_key);

    if (token_status === "active") {
      return verified_token;
    } else if (!isNaN(parseInt(token_status, 10))) {
      const remaining_uses = await redis_client.decr(redis_key);
      if (remaining_uses <= 0) {
        await redis_client.del(redis_key);
      }
      if (remaining_uses < 0) {
        return null;
      } else {
        return verified_token;
      }
    }

    return null;
  } catch (err) {
    return null;
  }
}
