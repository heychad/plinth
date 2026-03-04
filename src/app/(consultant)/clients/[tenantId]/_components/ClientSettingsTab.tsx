"use client";

import { useMutation } from "convex/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

const verticalOptions = [
  { value: "spa", label: "Spa" },
  { value: "course", label: "Course" },
  { value: "speaker", label: "Speaker" },
  { value: "consultant", label: "Consultant" },
  { value: "other", label: "Other" },
] as const;

const clientSettingsSchema = z.object({
  businessName: z.string().min(1, "Business name is required"),
  ownerName: z.string().min(1, "Owner name is required"),
  ownerEmail: z.string().email("Invalid email address"),
  website: z.string().url("Invalid URL").or(z.literal("")).optional(),
  vertical: z
    .enum(["spa", "course", "speaker", "consultant", "other"])
    .optional(),
  notes: z.string().optional(),
});

type ClientSettingsFormData = z.infer<typeof clientSettingsSchema>;

interface Tenant {
  _id: Id<"tenants">;
  consultantId: Id<"consultants">;
  businessName: string;
  ownerName: string;
  ownerEmail: string;
  websiteUrl?: string;
  vertical?: "spa" | "course" | "speaker" | "consultant" | "other";
  notes?: string;
  createdAt: number;
}

interface ClientSettingsTabProps {
  tenantId: Id<"tenants">;
  tenant: Tenant;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function ClientSettingsTab({ tenantId, tenant }: ClientSettingsTabProps) {
  const updateTenant = useMutation(api.tenants.updateTenant);

  const form = useForm<ClientSettingsFormData>({
    resolver: zodResolver(clientSettingsSchema),
    defaultValues: {
      businessName: tenant.businessName,
      ownerName: tenant.ownerName,
      ownerEmail: tenant.ownerEmail,
      website: tenant.websiteUrl ?? "",
      vertical: tenant.vertical,
      notes: tenant.notes ?? "",
    },
  });

  async function onSubmit(data: ClientSettingsFormData) {
    try {
      await updateTenant({
        tenantId,
        businessName: data.businessName,
        ownerName: data.ownerName,
        ownerEmail: data.ownerEmail,
        website: data.website || undefined,
        vertical: data.vertical,
        notes: data.notes || undefined,
      });
      toast.success("Client settings saved");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save settings"
      );
    }
  }

  return (
    <div className="max-w-2xl">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="businessName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Business name</FormLabel>
                <FormControl>
                  <Input placeholder="Acme Inc." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="ownerName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Owner name</FormLabel>
                <FormControl>
                  <Input placeholder="Jane Doe" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="ownerEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Owner email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="jane@example.com"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="website"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Website</FormLabel>
                <FormControl>
                  <Input placeholder="https://example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="vertical"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Vertical</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger className="min-h-[44px]">
                      <SelectValue placeholder="Select a vertical" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {verticalOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Internal notes about this client..."
                    className="min-h-[100px]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Separator />

          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">
              Read-only
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Consultant ID</p>
                <p className="text-sm font-mono mt-1 truncate">
                  {tenant.consultantId}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tenant ID</p>
                <p className="text-sm font-mono mt-1 truncate">
                  {tenantId}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="text-sm mt-1">
                  {formatDate(tenant.createdAt)}
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="min-h-[44px] min-w-[120px]"
            >
              {form.formState.isSubmitting ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
