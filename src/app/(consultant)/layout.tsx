import { ReactNode } from "react";
import Link from "next/link";

const navLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/clients", label: "Clients" },
  { href: "/agents", label: "Agents" },
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "Settings" },
];

export default function ConsultantLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          padding: "0 32px",
          borderBottom: "1px solid #e5e7eb",
          background: "#fff",
          height: "52px",
        }}
      >
        <span
          style={{
            fontWeight: 700,
            fontSize: "1rem",
            color: "var(--color-primary, #2563eb)",
            marginRight: "24px",
            letterSpacing: "-0.01em",
          }}
        >
          Plinth
        </span>
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            style={{
              padding: "6px 14px",
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "#374151",
              textDecoration: "none",
              borderRadius: "6px",
              transition: "background 0.12s, color 0.12s",
            }}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      {children}
    </>
  );
}
