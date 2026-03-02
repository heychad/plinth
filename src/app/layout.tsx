import React from "react";

export const metadata = {
  title: "Plinth",
  description: "White-label AI agent platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
