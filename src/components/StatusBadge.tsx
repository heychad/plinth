type Status = "active" | "paused" | "churned";

const statusConfig: Record<Status, { label: string; backgroundColor: string; color: string }> = {
  active: { label: "Active", backgroundColor: "#d1fae5", color: "#065f46" },
  paused: { label: "Paused", backgroundColor: "#fef3c7", color: "#92400e" },
  churned: { label: "Churned", backgroundColor: "#f3f4f6", color: "#6b7280" },
};

export function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status as Status] ?? {
    label: status,
    backgroundColor: "#f3f4f6",
    color: "#6b7280",
  };

  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: "9999px",
        fontSize: "0.75rem",
        fontWeight: 600,
        backgroundColor: config.backgroundColor,
        color: config.color,
      }}
    >
      {config.label}
    </span>
  );
}
