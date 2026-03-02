import { WorkflowManager } from "@convex-dev/workflow";
import { v } from "convex/values";
import { components, internal } from "../_generated/api";

// WorkflowManager requires the workflow component from convex.config.ts.
// components.workflow is typed as any during codegen bootstrap.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const workflowManager = new WorkflowManager(
  (components as any).workflow,
  {
    workpoolOptions: {
      defaultRetryBehavior: {
        maxAttempts: 3,
        initialBackoffMs: 2000,
        base: 2,
      },
      retryActionsByDefault: false,
    },
  }
);

/**
 * Primary agent workflow using the Agent SDK (autonomous mode).
 *
 * Reads the agentRun, resolves config, sets status to "running",
 * runs executeAgent, and marks the run completed or failed.
 *
 * Retry behavior: transient failures (network, rate limits) are retried
 * up to 3 times with 2s/4s/8s backoff. Non-transient failures fail
 * immediately.
 */
export const agentWorkflow = workflowManager.define({
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

    // Resolve merged config (merges template defaults with tenant overrides)
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
      // Execute the agent via the Agent SDK action (created by Builder C)
      const result = await step.runAction(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (internal as any).execution.executeAgent,
        {
          runId,
          systemPrompt: config.mergedSystemPrompt,
          mergedConfig: config.mergedConfig,
          model: config.model ?? "claude-sonnet-4-6",
          tools: config.resolvedTools ?? [],
          integrationCredentials: config.resolvedCredentials ?? {},
          maxTurns: config.mergedConfig?.maxTurns ?? 25,
          enableThinking: config.mergedConfig?.enableThinking ?? true,
        },
        // Retry transient errors (network, rate limits) up to 3 times
        {
          retry: {
            maxAttempts: 3,
            initialBackoffMs: 2000,
            base: 2,
          },
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
      // Mark run as failed with error details
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
