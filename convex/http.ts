import { httpRouter } from "convex/server";
import { composioCallback } from "./webhooks/composioCallback";
import { zoomWebhook } from "./webhooks/zoom";
import { githubWebhook } from "./webhooks/github";

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

http.route({
  path: "/webhooks/github-template-sync",
  method: "POST",
  handler: githubWebhook,
});

export default http;
