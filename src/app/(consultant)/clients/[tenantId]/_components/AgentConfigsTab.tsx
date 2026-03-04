"use client";

import { useState, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Settings2,
  Pause,
  Play,
  Rocket,
  RefreshCw,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

// --- types ---

interface AgentConfig {
  _id: Id<"agentConfigs">;
  displayName: string;
  status: string;
  version: number;
  templateDisplayName: string;
  templateCategory: string | null;
  templateVersion: number | null;
  lastRunAt?: number;
  runCountThisMonth: number;
  createdAt: number;
}

interface AgentConfigsTabProps {
  tenantId: Id<"tenants">;
  agentConfigs: AgentConfig[];
  onAgentDeployed: () => void;
}

// --- helpers ---

const statusVariant: Record<
  string,
  { label: string; className: string }
> = {
  building: {
    label: "Building",
    className: "bg-blue-100 text-blue-800 border-blue-200",
  },
  testing: {
    label: "Testing",
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  deployed: {
    label: "Deployed",
    className: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  paused: {
    label: "Paused",
    className: "bg-muted text-muted-foreground border-muted",
  },
  archived: {
    label: "Archived",
    className: "bg-red-100 text-red-800 border-red-200",
  },
};

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function SortIcon({ isSorted }: { isSorted: false | "asc" | "desc" }) {
  if (isSorted === "asc") return <ArrowUp className="ml-1 h-3.5 w-3.5" />;
  if (isSorted === "desc") return <ArrowDown className="ml-1 h-3.5 w-3.5" />;
  return <ArrowUpDown className="ml-1 h-3.5 w-3.5 opacity-50" />;
}

// --- deploy dialog ---

function DeployAgentDialog({
  tenantId,
  open,
  onOpenChange,
  onDeployed,
}: {
  tenantId: Id<"tenants">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeployed: () => void;
}) {
  const [deploying, setDeploying] = useState(false);
  const templatesResult = useQuery(api.agentTemplates.listAgentTemplates, {
    paginationOpts: { numItems: 50, cursor: null },
  });
  const deployAgentConfig = useMutation(api.agentConfigs.deployAgentConfig);

  const templates = templatesResult?.page ?? [];

  const categoryBadge: Record<string, string> = {
    marketing: "bg-blue-100 text-blue-800 border-blue-200",
    sales: "bg-emerald-100 text-emerald-800 border-emerald-200",
    operations: "bg-amber-100 text-amber-800 border-amber-200",
    coaching: "bg-violet-100 text-violet-800 border-violet-200",
  };

  async function handleDeploy(
    templateId: Id<"agentTemplates">,
    templateName: string
  ) {
    setDeploying(true);
    try {
      await deployAgentConfig({ tenantId, templateId, displayName: templateName });
      toast.success(`Agent "${templateName}" deployed`);
      onDeployed();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to deploy agent");
    } finally {
      setDeploying(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Deploy New Agent</DialogTitle>
          <DialogDescription>
            Select an agent template to deploy to this client.
          </DialogDescription>
        </DialogHeader>

        {templatesResult === undefined ? (
          <div className="space-y-3 py-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : templates.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No active agent templates available.
          </p>
        ) : (
          <div className="space-y-3">
            {templates.map((template) => (
              <div
                key={template._id}
                className="flex items-start justify-between gap-4 rounded-lg border p-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold text-sm">
                      {template.displayName}
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        categoryBadge[template.category] ??
                        "bg-muted text-muted-foreground border-muted"
                      }
                    >
                      {template.category}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {template.description}
                  </p>
                  {template.integrationSlots.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      <span className="font-medium">Integrations: </span>
                      {template.integrationSlots.join(", ")}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  onClick={() => handleDeploy(template._id, template.displayName)}
                  disabled={deploying}
                  className="shrink-0 min-h-[44px] min-w-[44px]"
                >
                  {deploying ? "Deploying..." : "Deploy"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// --- main component ---

export function AgentConfigsTab({
  tenantId,
  agentConfigs,
  onAgentDeployed,
}: AgentConfigsTabProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [syncingId, setSyncingId] = useState<Id<"agentConfigs"> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const syncMutation = useMutation((api as any).agentConfigs.syncAgentConfigWithTemplate);

  async function handleSync(configId: Id<"agentConfigs">) {
    setSyncingId(configId);
    try {
      await syncMutation({ agentConfigId: configId });
      toast.success("Agent synced to latest template version");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncingId(null);
    }
  }

  const columns = useMemo<ColumnDef<AgentConfig>[]>(
    () => [
      {
        accessorKey: "displayName",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Name
            <SortIcon isSorted={column.getIsSorted()} />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.getValue("displayName")}</span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const status = row.getValue("status") as string;
          const info = statusVariant[status] ?? {
            label: status,
            className: "bg-muted text-muted-foreground border-muted",
          };
          return (
            <Badge
              role="status"
              aria-label={`Status: ${info.label}`}
              variant="outline"
              className={info.className}
            >
              {info.label}
            </Badge>
          );
        },
      },
      {
        accessorKey: "templateDisplayName",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Template
            <SortIcon isSorted={column.getIsSorted()} />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.getValue("templateDisplayName")}
          </span>
        ),
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Deployed
            <SortIcon isSorted={column.getIsSorted()} />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground whitespace-nowrap">
            {formatDate(row.getValue("createdAt"))}
          </span>
        ),
      },
      {
        accessorKey: "version",
        header: "Version",
        cell: ({ row }) => {
          const version = row.getValue("version") as number;
          const templateVersion = row.original.templateVersion;
          const hasUpdate =
            templateVersion !== null && version < templateVersion;
          return (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">v{version}</span>
              {hasUpdate && (
                <Badge
                  variant="outline"
                  className="bg-yellow-50 text-yellow-800 border-yellow-200 text-xs"
                >
                  Update
                </Badge>
              )}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const config = row.original;
          const hasUpdate =
            config.templateVersion !== null &&
            config.version < config.templateVersion;
          const isSyncing = syncingId === config._id;

          return (
            <div className="flex items-center gap-1">
              {hasUpdate && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 min-w-[44px]"
                  onClick={() => handleSync(config._id)}
                  disabled={isSyncing}
                  title="Sync to latest template"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`}
                  />
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 min-w-[44px]"
                  >
                    <Settings2 className="h-4 w-4" />
                    <span className="sr-only">Actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <Settings2 className="mr-2 h-4 w-4" />
                    Configure
                  </DropdownMenuItem>
                  {config.status === "deployed" ? (
                    <DropdownMenuItem>
                      <Pause className="mr-2 h-4 w-4" />
                      Pause
                    </DropdownMenuItem>
                  ) : config.status === "paused" ? (
                    <DropdownMenuItem>
                      <Play className="mr-2 h-4 w-4" />
                      Resume
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [syncingId, syncMutation]
  );

  const table = useReactTable({
    data: agentConfigs,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (agentConfigs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed rounded-lg">
        <Rocket className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm font-semibold mb-1">No agents deployed yet</p>
        <p className="text-sm text-muted-foreground mb-4">
          Deploy an agent template to get started.
        </p>
        <Button
          onClick={() => setDialogOpen(true)}
          className="min-h-[44px] min-w-[44px]"
        >
          Deploy your first agent
        </Button>
        <DeployAgentDialog
          tenantId={tenantId}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onDeployed={onAgentDeployed}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold">Deployed Agents</h3>
        <Button
          onClick={() => setDialogOpen(true)}
          size="sm"
          className="min-h-[44px]"
        >
          <Rocket className="mr-2 h-4 w-4" />
          Add agent config
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableCaption className="sr-only">
            Agent configurations deployed to this client
          </TableCaption>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} scope="col">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <DeployAgentDialog
        tenantId={tenantId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onDeployed={onAgentDeployed}
      />
    </div>
  );
}
