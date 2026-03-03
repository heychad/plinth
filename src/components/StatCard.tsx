type StatCardProps = {
  title: string;
  value: string | number;
  accent?: string;
};

export function StatCard({ title, value, accent }: StatCardProps) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        minWidth: 0,
      }}
    >
      <span
        style={{
          fontSize: "0.8rem",
          fontWeight: 500,
          color: "#6b7280",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {title}
      </span>
      <span
        style={{
          fontSize: "2rem",
          fontWeight: 700,
          color: accent ?? "var(--color-primary, #111827)",
          lineHeight: 1,
        }}
      >
        {value}
      </span>
    </div>
  );
}
