"use client";

const categoryColors: Record<string, { bg: string; color: string }> = {
  marketing: { bg: "#ede9fe", color: "#5b21b6" },
  sales: { bg: "#dbeafe", color: "#1e40af" },
  operations: { bg: "#ffedd5", color: "#9a3412" },
  coaching: { bg: "#dcfce7", color: "#14532d" },
};

type TemplateCardProps = {
  template: {
    _id: string;
    displayName: string;
    category: string;
    description?: string;
    integrationSlots: string[];
  };
  onDeploy: (templateId: string) => void;
};

export function TemplateCard({ template, onDeploy }: TemplateCardProps) {
  const categoryStyle = categoryColors[template.category] ?? {
    bg: "#f3f4f6",
    color: "#6b7280",
  };

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: "10px",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
        <h3
          style={{
            fontSize: "1rem",
            fontWeight: 600,
            color: "#111827",
            margin: 0,
            lineHeight: 1.4,
          }}
        >
          {template.displayName}
        </h3>
        <span
          style={{
            display: "inline-block",
            padding: "2px 10px",
            borderRadius: "9999px",
            fontSize: "0.7rem",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            backgroundColor: categoryStyle.bg,
            color: categoryStyle.color,
            whiteSpace: "nowrap",
          }}
        >
          {template.category}
        </span>
      </div>

      {template.description && (
        <p
          style={{
            fontSize: "0.875rem",
            color: "#6b7280",
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          {template.description}
        </p>
      )}

      {template.integrationSlots.length > 0 && (
        <div>
          <p
            style={{
              fontSize: "0.75rem",
              fontWeight: 500,
              color: "#9ca3af",
              margin: "0 0 6px 0",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Integrations needed
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {template.integrationSlots.map((slot) => (
              <span
                key={slot}
                style={{
                  display: "inline-block",
                  padding: "2px 8px",
                  borderRadius: "4px",
                  fontSize: "0.75rem",
                  background: "#f3f4f6",
                  color: "#374151",
                  border: "1px solid #e5e7eb",
                }}
              >
                {slot}
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: "auto", paddingTop: "4px" }}>
        <button
          onClick={() => onDeploy(template._id)}
          style={{
            width: "100%",
            padding: "8px 16px",
            background: "var(--color-primary, #4f46e5)",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            fontSize: "0.875rem",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Deploy to Client
        </button>
      </div>
    </div>
  );
}
