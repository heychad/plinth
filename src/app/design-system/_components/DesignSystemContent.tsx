"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Star, Bell, Settings, Search, Plus, Check } from "lucide-react";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <Separator />
      {children}
    </section>
  );
}

function ColorSwatch({
  name,
  cssVar,
  hex,
}: {
  name: string;
  cssVar: string;
  hex: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-10 w-10 rounded-md border"
        style={{ backgroundColor: `var(${cssVar})` }}
      />
      <div>
        <p className="text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">
          {cssVar} &middot; {hex}
        </p>
      </div>
    </div>
  );
}

export function DesignSystemContent() {
  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background p-8 max-w-6xl mx-auto space-y-12">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">
            Plinth Design System
          </h1>
          <p className="text-lg text-muted-foreground mt-2">
            Visual reference for all shadcn/ui components with Plinth tokens.
            Dev-only.
          </p>
        </div>

        {/* Color Palette */}
        <Section title="Color Palette">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            <ColorSwatch
              name="Primary"
              cssVar="--color-primary"
              hex="#6366F1"
            />
            <ColorSwatch
              name="Secondary"
              cssVar="--color-secondary"
              hex="#818CF8"
            />
            <ColorSwatch name="Accent / CTA" cssVar="--color-cta" hex="#10B981" />
            <ColorSwatch
              name="Background"
              cssVar="--color-background"
              hex="#F5F3FF"
            />
            <ColorSwatch name="Text" cssVar="--color-text" hex="#1E1B4B" />
            <ColorSwatch
              name="Muted"
              cssVar="--muted"
              hex="#EDE9FE"
            />
            <ColorSwatch
              name="Destructive"
              cssVar="--destructive"
              hex="#EF4444"
            />
            <ColorSwatch name="Border" cssVar="--border" hex="#E2E8F0" />
          </div>
        </Section>

        {/* Typography */}
        <Section title="Typography">
          <div className="space-y-3">
            <p className="text-4xl font-bold">
              Plus Jakarta Sans — Heading 1 (4xl bold)
            </p>
            <p className="text-3xl font-semibold">
              Heading 2 (3xl semibold)
            </p>
            <p className="text-2xl font-semibold">
              Heading 3 (2xl semibold)
            </p>
            <p className="text-xl font-medium">Heading 4 (xl medium)</p>
            <p className="text-lg">Body Large (lg)</p>
            <p className="text-base">Body (base)</p>
            <p className="text-sm">Body Small (sm)</p>
            <p className="text-xs text-muted-foreground">
              Caption (xs, muted)
            </p>
          </div>
        </Section>

        {/* Spacing */}
        <Section title="Spacing Tokens">
          <div className="flex flex-wrap gap-4 items-end">
            {[
              { name: "xs", size: "0.25rem" },
              { name: "sm", size: "0.5rem" },
              { name: "md", size: "1rem" },
              { name: "lg", size: "1.5rem" },
              { name: "xl", size: "2rem" },
              { name: "2xl", size: "3rem" },
              { name: "3xl", size: "4rem" },
            ].map((token) => (
              <div key={token.name} className="flex flex-col items-center gap-1">
                <div
                  className="bg-primary rounded"
                  style={{ width: token.size, height: token.size }}
                />
                <span className="text-xs text-muted-foreground">
                  --space-{token.name}
                </span>
              </div>
            ))}
          </div>
        </Section>

        {/* Buttons */}
        <Section title="Button">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 items-center">
              <Button variant="default">Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="link">Link</Button>
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <Button size="sm">Small</Button>
              <Button size="default">Default Size</Button>
              <Button size="lg">Large</Button>
              <Button size="icon" aria-label="Star">
                <Star />
              </Button>
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <Button disabled>Disabled</Button>
              <Button>
                <Plus className="mr-1" /> With Icon
              </Button>
            </div>
          </div>
        </Section>

        {/* Card */}
        <Section title="Card">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Card Title</CardTitle>
                <CardDescription>
                  Card description with muted text styling.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p>
                  Card content area with --card background (#FFFFFF) and --border
                  color (#E2E8F0).
                </p>
              </CardContent>
              <CardFooter>
                <Button size="sm">Action</Button>
              </CardFooter>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Stats Card</CardTitle>
                <CardDescription>Example metric display</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold">2,847</p>
                <p className="text-sm text-muted-foreground">
                  Total sessions this month
                </p>
              </CardContent>
            </Card>
          </div>
        </Section>

        {/* Badge */}
        <Section title="Badge">
          <div className="flex flex-wrap gap-3 items-center">
            <Badge variant="default">Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge variant="outline">Outline</Badge>
          </div>
        </Section>

        {/* Input */}
        <Section title="Input">
          <div className="grid md:grid-cols-2 gap-4 max-w-2xl">
            <div className="space-y-2">
              <Label htmlFor="ds-input">Default Input</Label>
              <Input id="ds-input" placeholder="Type something..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ds-input-disabled">Disabled Input</Label>
              <Input
                id="ds-input-disabled"
                placeholder="Disabled"
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ds-input-icon">With Icon</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="ds-input-icon" className="pl-9" placeholder="Search..." />
              </div>
            </div>
          </div>
        </Section>

        {/* Select */}
        <Section title="Select">
          <div className="max-w-xs">
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Select an option" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="option-1">Option 1</SelectItem>
                <SelectItem value="option-2">Option 2</SelectItem>
                <SelectItem value="option-3">Option 3</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Section>

        {/* Checkbox */}
        <Section title="Checkbox">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox id="ds-check-1" />
              <Label htmlFor="ds-check-1">Unchecked</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="ds-check-2" defaultChecked />
              <Label htmlFor="ds-check-2">Checked</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="ds-check-3" disabled />
              <Label htmlFor="ds-check-3">Disabled</Label>
            </div>
          </div>
        </Section>

        {/* Textarea */}
        <Section title="Textarea">
          <div className="max-w-lg space-y-2">
            <Label htmlFor="ds-textarea">Description</Label>
            <Textarea
              id="ds-textarea"
              placeholder="Enter a longer text..."
              rows={3}
            />
          </div>
        </Section>

        {/* Avatar */}
        <Section title="Avatar">
          <div className="flex gap-4 items-center">
            <Avatar>
              <AvatarImage src="" alt="User" />
              <AvatarFallback>JD</AvatarFallback>
            </Avatar>
            <Avatar>
              <AvatarImage src="" alt="User" />
              <AvatarFallback>AB</AvatarFallback>
            </Avatar>
            <Avatar>
              <AvatarImage src="" alt="User" />
              <AvatarFallback>
                <Settings className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
          </div>
        </Section>

        {/* Breadcrumb */}
        <Section title="Breadcrumb">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="#">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="#">Clients</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Acme Corp</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </Section>

        {/* Tabs */}
        <Section title="Tabs">
          <Tabs defaultValue="tab-1" className="max-w-lg">
            <TabsList>
              <TabsTrigger value="tab-1">Overview</TabsTrigger>
              <TabsTrigger value="tab-2">Analytics</TabsTrigger>
              <TabsTrigger value="tab-3">Settings</TabsTrigger>
            </TabsList>
            <TabsContent value="tab-1">
              <p className="text-sm text-muted-foreground pt-2">
                Overview tab content.
              </p>
            </TabsContent>
            <TabsContent value="tab-2">
              <p className="text-sm text-muted-foreground pt-2">
                Analytics tab content.
              </p>
            </TabsContent>
            <TabsContent value="tab-3">
              <p className="text-sm text-muted-foreground pt-2">
                Settings tab content.
              </p>
            </TabsContent>
          </Tabs>
        </Section>

        {/* Table */}
        <Section title="Table">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Alice Johnson</TableCell>
                  <TableCell>
                    <Badge variant="default">Active</Badge>
                  </TableCell>
                  <TableCell>Admin</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Bob Smith</TableCell>
                  <TableCell>
                    <Badge variant="secondary">Pending</Badge>
                  </TableCell>
                  <TableCell>Member</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Carol Davis</TableCell>
                  <TableCell>
                    <Badge variant="destructive">Inactive</Badge>
                  </TableCell>
                  <TableCell>Viewer</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Card>
        </Section>

        {/* Tooltip */}
        <Section title="Tooltip">
          <div className="flex gap-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Notifications">
                  <Bell />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Notifications</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Settings">
                  <Settings />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Settings</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </Section>

        {/* Skeleton */}
        <Section title="Skeleton">
          <div className="space-y-3 max-w-sm">
            <Skeleton className="h-10 w-full" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          </div>
        </Section>

        {/* Shadow Tokens */}
        <Section title="Shadow Tokens">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { name: "sm", var: "--shadow-sm" },
              { name: "md", var: "--shadow-md" },
              { name: "lg", var: "--shadow-lg" },
              { name: "xl", var: "--shadow-xl" },
            ].map((shadow) => (
              <div
                key={shadow.name}
                className="bg-card rounded-lg p-6 text-center"
                style={{ boxShadow: `var(${shadow.var})` }}
              >
                <p className="text-sm font-medium">{shadow.var}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Combined Example */}
        <Section title="Combined Example">
          <Card className="max-w-md">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback>PL</AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-lg">Create Agent</CardTitle>
                  <CardDescription>
                    Configure a new AI agent for your client.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ds-agent-name">Agent Name</Label>
                <Input id="ds-agent-name" placeholder="e.g. Sales Coach" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ds-agent-type">Type</Label>
                <Select>
                  <SelectTrigger id="ds-agent-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="coaching">Coaching</SelectItem>
                    <SelectItem value="analysis">Analysis</SelectItem>
                    <SelectItem value="reporting">Reporting</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="ds-agent-auto" />
                <Label htmlFor="ds-agent-auto">Enable auto-run</Label>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline">Cancel</Button>
              <Button>
                <Check className="mr-1" /> Create
              </Button>
            </CardFooter>
          </Card>
        </Section>

        <footer className="text-center text-sm text-muted-foreground pb-8 pt-4">
          Plinth Design System &middot; Dev-only reference page
        </footer>
      </div>
    </TooltipProvider>
  );
}
