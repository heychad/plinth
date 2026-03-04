"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClientsTable } from "./_components/ClientsTable";
import { AddClientDialog } from "./_components/AddClientDialog";

export default function ClientsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientsResult = useQuery((api as any).dashboard.listClientsForConsultant, {});

  const tenants = clientsResult?.tenants ?? [];
  const isLoading = clientsResult === undefined;

  return (
    <main id="main-content" tabIndex={-1} className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground">
            Manage your client roster
          </p>
        </div>
        {tenants.length > 0 && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add client
          </Button>
        )}
      </div>

      <ClientsTable
        data={tenants}
        isLoading={isLoading}
        onAddClient={() => setDialogOpen(true)}
      />

      <AddClientDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </main>
  );
}
