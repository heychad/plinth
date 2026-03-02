import { httpRouter } from "convex/server";
import { composioCallback } from "./webhooks/composioCallback";
import { zoomWebhook } from "./webhooks/zoom";

const http = httpRouter();

http.route({
  path: "/oauth/composio/callback",
  method: "GET",
  handler: composioCallback,
});

http.route({
  path: "/webhooks/zoom",
  method: "POST",
  handler: zoomWebhook,
});

export default http;
