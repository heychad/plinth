"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AddClientDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AddClientDialog({ open, onOpenChange }: AddClientDialogProps) {
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createTenant = useMutation(api.tenants.createTenant);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!businessName.trim() || !ownerName.trim() || !ownerEmail.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await createTenant({
        businessName: businessName.trim(),
        ownerName: ownerName.trim(),
        ownerEmail: ownerEmail.trim(),
      });
      toast.success(`"${businessName.trim()}" added successfully`);
      onOpenChange(false);
      setBusinessName("");
      setOwnerName("");
      setOwnerEmail("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add client"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Client</DialogTitle>
          <DialogDescription>
            Add a new client to your roster. You can configure agents and
            settings after creating the client.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="business-name">Business name</Label>
            <Input
              id="business-name"
              placeholder="Acme Corp"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="owner-name">Owner name</Label>
            <Input
              id="owner-name"
              placeholder="Jane Smith"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="owner-email">Owner email</Label>
            <Input
              id="owner-email"
              type="email"
              placeholder="jane@acme.com"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              required
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add client"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
