import { notFound } from "next/navigation";
import { DesignSystemContent } from "./_components/DesignSystemContent";

export const metadata = {
  title: "Design System | Plinth",
};

export default function DesignSystemPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <DesignSystemContent />;
}
