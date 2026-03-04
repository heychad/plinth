"use client";

import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link2, Unlink } from "lucide-react";

type IntegrationSlot = {
  slotName: string;
  provider: string;
  connected: boolean;
  connectedAt?: number;
  agentNames: string[];
};

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function humanizeSlotName(slotName: string): string {
  return slotName
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function ConnectionCard({
  slot,
  onConnect,
  onDisconnect,
}: {
  slot: IntegrationSlot;
  onConnect: (slotName: string, provider: string) => Promise<void>;
  onDisconnect: (slotName: string) => Promise<void>;
}) {
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    setConnecting(true);
    setError(null);
    try {
      await onConnect(slot.slotName, slot.provider);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    const confirmed = window.confirm(
      `Unlink ${humanizeSlotName(slot.slotName)}? Agents that rely on this connection will stop working until reconnected.`
    );
    if (!confirmed) return;

    setDisconnecting(true);
    setError(null);
    try {
      await onDisconnect(slot.slotName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unlink");
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-base font-semibold text-foreground">
              {humanizeSlotName(slot.slotName)}
            </span>
            <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">
              {slot.provider}
            </span>
          </div>

          {/* Status badge */}
          {slot.connected ? (
            <Badge className="border-transparent bg-accent text-accent-foreground hover:bg-accent/80">
              Connected
            </Badge>
          ) : (
            <Badge variant="secondary">Not Connected</Badge>
          )}
        </div>

        {/* Connected date */}
        {slot.connected && slot.connectedAt && (
          <p className="m-0 text-sm text-muted-foreground">
            Connected {formatDate(slot.connectedAt)}
          </p>
        )}

        {/* Agents that use this slot */}
        {slot.agentNames.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              Used by:
            </p>
            <div className="flex flex-wrap gap-1">
              {slot.agentNames.map((name) => (
                <span
                  key={name}
                  className="rounded bg-muted px-2 py-0.5 text-xs text-foreground"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="m-0 text-sm text-destructive">{error}</p>
        )}

        {/* Action button */}
        <div>
          {slot.connected ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="text-destructive hover:text-destructive"
            >
              <Unlink className="mr-1.5 h-3.5 w-3.5" />
              {disconnecting ? "Unlinking..." : "Unlink"}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleConnect}
              disabled={connecting}
            >
              <Link2 className="mr-1.5 h-3.5 w-3.5" />
              {connecting ? "Linking..." : "Link account"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardContent className="flex flex-col gap-3 p-5">
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-8 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function ConnectionsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentUser = useQuery((api as any).auth.getCurrentUser);
  const tenantId = currentUser?.tenantId as string | undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const slots = useQuery((api as any).credentials.listIntegrationsForTenant) as
    | IntegrationSlot[]
    | undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const disconnectCredential = useMutation((api as any).credentials.disconnectCredential);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const initiateOAuth = useAction((api as any).integrations.composio.initiateComposioOAuth);

  const isLoading = currentUser === undefined || slots === undefined;

  async function handleConnect(slotName: string, provider: string) {
    if (!tenantId) throw new Error("No tenant");

    const redirectUrl = `${window.location.origin}/oauth/composio/callback`;
    const result = await initiateOAuth({
      tenantId,
      slotName,
      provider: provider.toLowerCase(),
      redirectUrl,
    });

    if (result?.authUrl) {
      window.open(result.authUrl, "_blank", "noopener,noreferrer");
    }
  }

  async function handleDisconnect(slotName: string) {
    if (!tenantId) throw new Error("No tenant");
    await disconnectCredential({ tenantId, slotName });
  }

  // Group slots by provider
  const groupedByProvider: Record<string, IntegrationSlot[]> = {};
  if (slots) {
    for (const slot of slots) {
      if (!groupedByProvider[slot.provider]) {
        groupedByProvider[slot.provider] = [];
      }
      groupedByProvider[slot.provider].push(slot);
    }
  }

  const providers = Object.keys(groupedByProvider).sort();

  return (
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-5xl p-8">
      <h1 className="mb-2 text-2xl font-bold text-foreground">
        Link your apps
      </h1>
      <p className="mb-8 text-muted-foreground">
        Connect the tools your agents need to work their magic.
      </p>

      {isLoading ? (
        <LoadingSkeleton />
      ) : providers.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="mb-2 font-medium text-foreground">
              No apps needed yet.
            </p>
            <p className="text-muted-foreground">
              Your consultant will let you know when you need to link something.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-10">
          {providers.map((provider) => (
            <section key={provider}>
              <h2 className="mb-4 border-b pb-2 text-base font-bold text-foreground">
                Connected apps
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {groupedByProvider[provider].map((slot) => (
                  <ConnectionCard
                    key={slot.slotName}
                    slot={slot}
                    onConnect={handleConnect}
                    onDisconnect={handleDisconnect}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
