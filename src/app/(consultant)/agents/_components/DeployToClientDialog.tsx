"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { TemplateData } from "./TemplateCard";

type DeployToClientDialogProps = {
  template: TemplateData | null;
  onClose: () => void;
};

export function DeployToClientDialog({ template, onClose }: DeployToClientDialogProps) {
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [deploying, setDeploying] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tenantsResult = useQuery((api as any).tenants.listTenants, {
    paginationOpts: { numItems: 100, cursor: null },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deployMutation = useMutation((api as any).agentConfigs.deployAgentConfig);

  const tenants = tenantsResult?.page ?? [];
  const isLoadingTenants = tenantsResult === undefined;

  async function handleDeploy() {
    if (!selectedTenantId || !template) return;
    setDeploying(true);

    const selectedTenant = tenants.find(
      (t: { _id: string }) => t._id === selectedTenantId
    );
    const clientName = (selectedTenant as { businessName?: string })?.businessName ?? "client";

    try {
      await deployMutation({
        tenantId: selectedTenantId,
        templateId: template._id,
        ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
      });
      toast.success(`Agent deployed to ${clientName}`);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Deploy failed";
      if (message.includes("already exists")) {
        toast.error(`"${template.displayName}" is already deployed to ${clientName}.`);
      } else {
        toast.error(message);
      }
    } finally {
      setDeploying(false);
    }
  }

  return (
    <Dialog open={!!template} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Deploy to client</DialogTitle>
          <DialogDescription>
            Select a client and optionally set a display name for{" "}
            <strong>{template?.displayName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="client-select">Client</Label>
            <Select
              value={selectedTenantId}
              onValueChange={setSelectedTenantId}
              disabled={isLoadingTenants}
            >
              <SelectTrigger id="client-select" className="min-h-[44px]">
                <SelectValue placeholder={isLoadingTenants ? "Loading clients..." : "Select a client"} />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((tenant: { _id: string; businessName: string; ownerName: string }) => (
                  <SelectItem key={tenant._id} value={tenant._id}>
                    {tenant.businessName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="display-name">Display name (optional)</Label>
            <Input
              id="display-name"
              placeholder={template?.displayName ?? "Agent display name"}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="min-h-[44px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={deploying} className="min-h-[44px]">
            Cancel
          </Button>
          <Button
            onClick={handleDeploy}
            disabled={!selectedTenantId || deploying}
            className="min-h-[44px]"
          >
            {deploying ? "Deploying..." : "Deploy"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
