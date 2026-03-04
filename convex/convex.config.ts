import { defineApp } from "convex/server";
import workflow from "@convex-dev/workflow/convex.config.js";
import rag from "@convex-dev/rag/convex.config.js";
import agent from "@convex-dev/agent/convex.config.js";
import persistentTextStreaming from "@convex-dev/persistent-text-streaming/convex.config.js";

const app = defineApp();
app.use(workflow);
app.use(rag);
app.use(agent);
app.use(persistentTextStreaming);
export default app;
