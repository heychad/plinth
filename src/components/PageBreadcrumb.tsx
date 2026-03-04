import React from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type BreadcrumbEntry = { label: string; href?: string };

function TruncatedLabel({ label }: { label: string }) {
  if (label.length > 40) {
    return <span title={label}>{label.slice(0, 40)}&hellip;</span>;
  }
  return <>{label}</>;
}

export function PageBreadcrumb({ items }: { items: BreadcrumbEntry[] }) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {items.map((item, index) => (
          <React.Fragment key={item.label}>
            {index > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              {item.href ? (
                <BreadcrumbLink href={item.href}>
                  <TruncatedLabel label={item.label} />
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>
                  <TruncatedLabel label={item.label} />
                </BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
