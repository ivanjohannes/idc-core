import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import config from "../config.js";

const client = jwksClient({
  jwksUri: config.idc_gateway.url + "/jwks.json",
});

export async function attachClientSettings(req, res, next) {
  try {
    const bearer_token = req.headers["authorization"];
    const jwt_token = bearer_token?.split(" ")[1];

    if (!jwt_token) {
      throw new Error("No JWT token provided");
    }

    const decoded_token = await new Promise((resolve, reject) => {
      jwt.verify(jwt_token, getPublicKey, { algorithms: ["RS256"] }, (err, decoded) => {
        if (err) return reject(err);
        resolve(decoded);
      });
    });

    req.client_settings = decoded_token.client_settings;
  } catch (err) {
    console.error("Error attaching client settings:", err.message);
    
  } finally {
    next();
  }
}

function getPublicKey(header, callback) {
  client.getSigningKey(header.kid, function (err, key) {
    if (err) return callback(err);
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}
