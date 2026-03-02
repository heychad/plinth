import { httpRouter } from "convex/server";
import { composioCallback } from "./webhooks/composioCallback";

const http = httpRouter();

http.route({
  path: "/oauth/composio/callback",
  method: "GET",
  handler: composioCallback,
});

export default http;
