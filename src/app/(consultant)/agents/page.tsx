"use client";

import { useState } from "react";
import { usePaginatedQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { TemplateCard } from "@/components/TemplateCard";
import { ClientPickerModal } from "@/components/ClientPickerModal";

type Template = {
  _id: string;
  displayName: string;
  category: string;
  description?: string;
  integrationSlots: string[];
};

export default function AgentTemplatesPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { results, status, loadMore } = usePaginatedQuery(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api as any).agentTemplates.listAgentTemplates,
    {},
    { initialNumItems: 50 }
  );

  const isLoading = status === "LoadingFirstPage";
  const canLoadMore = status === "CanLoadMore";

  function handleDeploy(templateId: string) {
    const template = results.find((t: Template) => t._id === templateId);
    if (template) {
      setSelectedTemplate(template as Template);
    }
  }

  return (
    <main style={{ padding: "32px", maxWidth: "1200px", margin: "0 auto" }}>
      <h1
        style={{
          fontSize: "1.5rem",
          fontWeight: 700,
          color: "#111827",
          marginBottom: "8px",
        }}
      >
        Agent Templates
      </h1>
      <p style={{ color: "#6b7280", marginBottom: "32px" }}>
        Browse available templates and deploy them to your clients.
      </p>

      {isLoading ? (
        <div style={{ padding: "60px", textAlign: "center", color: "#9ca3af" }}>
          Loading templates...
        </div>
      ) : results.length === 0 ? (
        <div
          style={{
            padding: "60px",
            textAlign: "center",
            color: "#6b7280",
            border: "1px dashed #d1d5db",
            borderRadius: "10px",
          }}
        >
          No agent templates available yet.
        </div>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: "20px",
            }}
          >
            {results.map((template: Template) => (
              <TemplateCard
                key={template._id}
                template={template}
                onDeploy={handleDeploy}
              />
            ))}
          </div>

          {canLoadMore && (
            <div style={{ marginTop: "32px", textAlign: "center" }}>
              <button
                onClick={() => loadMore(50)}
                style={{
                  padding: "10px 28px",
                  background: "var(--color-primary, #4f46e5)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Load more
              </button>
            </div>
          )}
        </>
      )}

      {selectedTemplate && (
        <ClientPickerModal
          templateId={selectedTemplate._id}
          templateName={selectedTemplate.displayName}
          onClose={() => setSelectedTemplate(null)}
          onSuccess={() => setSelectedTemplate(null)}
        />
      )}
    </main>
  );
}
