"use client";

const verticalLabels: Record<string, string> = {
  spa: "Spa",
  course: "Course",
  speaker: "Speaker",
  consultant: "Consultant",
  other: "Other",
};

const statusConfig: Record<string, { label: string; bg: string; color: string }> = {
  active: { label: "Active", bg: "#d1fae5", color: "#065f46" },
  paused: { label: "Paused", bg: "#fef3c7", color: "#92400e" },
  churned: { label: "Churned", bg: "#f3f4f6", color: "#6b7280" },
};

interface ClientDetailHeaderProps {
  businessName: string;
  ownerName: string;
  vertical?: string | null;
  status: string;
}

export function ClientDetailHeader({
  businessName,
  ownerName,
  vertical,
  status,
}: ClientDetailHeaderProps) {
  const statusInfo = statusConfig[status] ?? { label: status, bg: "#f3f4f6", color: "#6b7280" };

  return (
    <div
      style={{
        padding: "24px 0 20px",
        borderBottom: "1px solid #e5e7eb",
        marginBottom: "24px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <h1
          style={{
            fontSize: "1.75rem",
            fontWeight: 700,
            color: "var(--color-foreground)",
            margin: 0,
          }}
        >
          {businessName}
        </h1>

        {vertical && (
          <span
            style={{
              display: "inline-block",
              padding: "2px 10px",
              borderRadius: "9999px",
              fontSize: "0.75rem",
              fontWeight: 600,
              backgroundColor: "#ede9fe",
              color: "#5b21b6",
            }}
          >
            {verticalLabels[vertical] ?? vertical}
          </span>
        )}

        <span
          style={{
            display: "inline-block",
            padding: "2px 10px",
            borderRadius: "9999px",
            fontSize: "0.75rem",
            fontWeight: 600,
            backgroundColor: statusInfo.bg,
            color: statusInfo.color,
          }}
        >
          {statusInfo.label}
        </span>
      </div>

      <p
        style={{
          marginTop: "6px",
          fontSize: "0.9rem",
          color: "#6b7280",
        }}
      >
        {ownerName}
      </p>
    </div>
  );
}
