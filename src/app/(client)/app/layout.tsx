"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";

const NAV_ITEMS = [
  { href: "/app", label: "Home", exact: true },
  { href: "/app/agents", label: "Agents" },
  { href: "/app/connections", label: "Connections" },
  { href: "/app/reports", label: "Reports" },
];

export default function ClientAppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--color-background, #f9fafb)" }}>
      {/* Sidebar */}
      <nav
        style={{
          width: "220px",
          flexShrink: 0,
          background: "#fff",
          borderRight: "1px solid #e5e7eb",
          display: "flex",
          flexDirection: "column",
          padding: "24px 0",
        }}
      >
        <div style={{ padding: "0 20px 20px", borderBottom: "1px solid #f3f4f6", marginBottom: "8px" }}>
          <span
            style={{
              fontSize: "1rem",
              fontWeight: 700,
              color: "var(--color-primary, #4f46e5)",
            }}
          >
            My Portal
          </span>
        </div>

        <ul style={{ listStyle: "none", margin: 0, padding: "0 12px", flex: 1 }}>
          {NAV_ITEMS.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href) && item.href !== "/app";

            return (
              <li key={item.href} style={{ marginBottom: "2px" }}>
                <Link
                  href={item.href}
                  style={{
                    display: "block",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    fontSize: "0.875rem",
                    fontWeight: isActive ? 600 : 400,
                    color: isActive
                      ? "var(--color-primary, #4f46e5)"
                      : "#374151",
                    background: isActive
                      ? "color-mix(in srgb, var(--color-primary, #4f46e5) 10%, transparent)"
                      : "transparent",
                    textDecoration: "none",
                    transition: "background 0.15s",
                  }}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Account */}
        <div
          style={{
            padding: "16px 20px",
            borderTop: "1px solid #f3f4f6",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <UserButton afterSignOutUrl="/sign-in" />
          <span style={{ fontSize: "0.875rem", color: "#374151" }}>Account</span>
        </div>
      </nav>

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
        {children}
      </div>
    </div>
  );
}
