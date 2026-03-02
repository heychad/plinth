import { WorkflowManager } from "@convex-dev/workflow";
import { v } from "convex/values";
import { components, internal } from "../_generated/api";

// WorkflowManager requires the workflow component from convex.config.ts.
// components.workflow is typed as any during codegen bootstrap.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const simpleWorkflowManager = new WorkflowManager(
  (components as any).workflow
);

/**
 * Fallback workflow for simple (non-agentic) execution using Client SDK.
 *
 * Used when agentTemplate.executionMode === "simple". Performs a single
 * Claude call with structured output — no tool use, no looping.
 *
 * Default model: claude-haiku-4-5 (faster/cheaper for simple operations).
 */
export const simpleWorkflow = simpleWorkflowManager.define({
  args: { runId: v.id("agentRuns") },
  handler: async (step, { runId }): Promise<void> => {
    // Read the run record
    const run = await step.runQuery(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (internal as any).agentRuns.getById,
      { runId }
    );

    if (!run) {
      throw new Error(`Agent run not found: ${runId}`);
    }

    // Resolve merged config
    const config = await step.runQuery(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (internal as any).agentConfigs.getResolved,
      { agentConfigId: run.agentConfigId }
    );

    if (!config) {
      throw new Error(`Agent config not found for run: ${runId}`);
    }

    // Transition run to "running"
    await step.runMutation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (internal as any).agentRuns.updateRunStatus,
      { runId, status: "running" }
    );

    try {
      // Execute the simple Client SDK action (created by Builder C)
      const result = await step.runAction(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (internal as any).execution.executeSimple,
        {
          runId,
          systemPrompt: config.mergedSystemPrompt,
          mergedConfig: config.mergedConfig,
          model: config.model ?? "claude-haiku-4-5",
          input: run.input,
        }
      );

      // Mark run as completed
      await step.runMutation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (internal as any).agentRuns.updateRunStatus,
        {
          runId,
          status: "completed",
          output: result,
        }
      );
    } catch (error: unknown) {
      // Mark run as failed
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorDetail =
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : { raw: String(error) };

      await step.runMutation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (internal as any).agentRuns.updateRunStatus,
        {
          runId,
          status: "failed",
          errorMessage,
          errorDetail,
        }
      );
    }
  },
});
