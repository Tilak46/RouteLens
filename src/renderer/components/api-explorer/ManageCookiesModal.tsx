import { useState, useEffect } from "react";
import { CookieItem } from "../../../types";
import apiClient from "@/lib/apiClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Cookie,
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
  Edit2,
  Shield,
  Clock,
  Globe,
  Radio,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ManageCookiesModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDomain?: string;
}

export function ManageCookiesModal({
  isOpen,
  onClose,
  initialDomain,
}: ManageCookiesModalProps) {
  const [activeTab, setActiveTab] = useState<"manage" | "sync">("manage");
  const [cookiesByDomain, setCookiesByDomain] = useState<Record<string, CookieItem[]>>({});
  const [newDomainInput, setNewDomainInput] = useState("");
  const [expandedDomains, setExpandedDomains] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Allowlist state
  const [showAllowlistModal, setShowAllowlistModal] = useState(false);
  const [allowlist, setAllowlist] = useState<string[]>([]);
  const [newAllowlistDomain, setNewAllowlistDomain] = useState("");

  // Cookie editing/adding state
  const [editingCookie, setEditingCookie] = useState<{
    domain: string;
    isNew: boolean;
    cookie: CookieItem;
  } | null>(null);

  // Sync tab state
  const [syncMode, setSyncMode] = useState<"interceptor" | "proxy">("proxy");
  const [proxyEnabled, setProxyEnabled] = useState(false);
  const [proxyPort, setProxyPort] = useState("5559");
  const [syncDomainInput, setSyncDomainInput] = useState("");
  const [syncDomains, setSyncDomains] = useState<string[]>([]);

  // Load cookies & allowlist from backend
  const refreshData = async () => {
    try {
      const [allCookies, al] = await Promise.all([
        apiClient.getCookies(),
        apiClient.getCookieAllowlist(),
      ]);
      setCookiesByDomain(allCookies || {});
      setAllowlist(al || []);

      // If initialDomain provided and not yet expanded, auto-expand it
      if (initialDomain) {
        const cleanInitial = initialDomain
          .replace(/^https?:\/\//i, "")
          .split("/")[0]
          .split(":")[0]
          .toLowerCase();
        setExpandedDomains((prev) => ({
          ...prev,
          [cleanInitial]: true,
        }));
      }
    } catch (err) {
      console.error("Failed to load cookies:", err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshData();
    } else {
      setEditingCookie(null);
      setShowAllowlistModal(false);
    }
  }, [isOpen, initialDomain]);

  const toggleDomainExpand = (domain: string) => {
    setExpandedDomains((prev) => ({
      ...prev,
      [domain]: !prev[domain],
    }));
  };

  const handleAddDomain = () => {
    const raw = newDomainInput.trim();
    if (!raw) return;
    const clean = raw
      .replace(/^https?:\/\//i, "")
      .split("/")[0]
      .split(":")[0]
      .toLowerCase();
    if (!clean) return;

    if (!cookiesByDomain[clean]) {
      setCookiesByDomain((prev) => ({
        ...prev,
        [clean]: [],
      }));
      setExpandedDomains((prev) => ({
        ...prev,
        [clean]: true,
      }));
      toast.success(`Domain "${clean}" added to Cookie Jar`);
    } else {
      setExpandedDomains((prev) => ({
        ...prev,
        [clean]: true,
      }));
      toast.info(`Domain "${clean}" already exists`);
    }
    setNewDomainInput("");
  };

  const handleDeleteDomain = async (domain: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiClient.deleteDomainCookies(domain);
      setCookiesByDomain((prev) => {
        const next = { ...prev };
        delete next[domain];
        return next;
      });
      toast.success(`Removed all cookies for domain "${domain}"`);
    } catch (err) {
      toast.error("Failed to delete domain cookies");
    }
  };

  const handleDeleteCookie = async (domain: string, cookieName: string) => {
    try {
      await apiClient.deleteCookie(domain, cookieName);
      setCookiesByDomain((prev) => {
        const list = (prev[domain] || []).filter((c) => c.name !== cookieName);
        if (list.length === 0) {
          const next = { ...prev };
          delete next[domain];
          return next;
        }
        return { ...prev, [domain]: list };
      });
      toast.success(`Deleted cookie "${cookieName}"`);
    } catch (err) {
      toast.error("Failed to delete cookie");
    }
  };

  const handleCopyValue = (cookie: CookieItem) => {
    navigator.clipboard.writeText(cookie.value);
    const key = `${cookie.domain}:${cookie.name}`;
    setCopiedKey(key);
    toast.success(`Cookie "${cookie.name}" value copied`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleOpenAddCookie = (domain: string) => {
    setEditingCookie({
      domain,
      isNew: true,
      cookie: {
        name: `cookie_${Date.now().toString().slice(-4)}`,
        value: "",
        domain,
        path: "/",
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });
  };

  const handleOpenEditCookie = (domain: string, cookie: CookieItem) => {
    setEditingCookie({
      domain,
      isNew: false,
      cookie: { ...cookie },
    });
  };

  const handleSaveEditedCookie = async () => {
    if (!editingCookie) return;
    const { cookie } = editingCookie;
    if (!cookie.name.trim()) {
      toast.error("Cookie name is required");
      return;
    }

    try {
      await apiClient.setCookie(cookie);
      await refreshData();
      setEditingCookie(null);
      toast.success(`Cookie "${cookie.name}" saved successfully`);
    } catch (err) {
      toast.error("Failed to save cookie");
    }
  };

  const handleAddAllowlistDomain = async () => {
    const trimmed = newAllowlistDomain.trim().toLowerCase();
    if (!trimmed) return;
    const nextList = Array.from(new Set([...allowlist, trimmed]));
    try {
      await apiClient.setCookieAllowlist(nextList);
      setAllowlist(nextList);
      setNewAllowlistDomain("");
      toast.success(`Added "${trimmed}" to domain allowlist`);
    } catch (err) {
      toast.error("Failed to update allowlist");
    }
  };

  const handleRemoveAllowlistDomain = async (domain: string) => {
    const nextList = allowlist.filter((d) => d !== domain);
    try {
      await apiClient.setCookieAllowlist(nextList);
      setAllowlist(nextList);
      toast.success(`Removed "${domain}" from allowlist`);
    } catch (err) {
      toast.error("Failed to update allowlist");
    }
  };

  const domainsList = Object.keys(cookiesByDomain);
  const totalCookiesCount = Object.values(cookiesByDomain).reduce(
    (acc, cur) => acc + (cur?.length || 0),
    0
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] h-[640px] flex flex-col p-0 overflow-hidden bg-[hsl(240,6%,10%)] border-border/70 select-none">
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border/40 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <Cookie size={18} />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground tracking-tight">
                  Cookies
                </DialogTitle>
                <p className="text-xs text-muted-foreground">
                  Manage stored cookies and configure sync for local and remote APIs.
                </p>
              </div>
            </div>
            {totalCookiesCount > 0 && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-secondary/80 text-muted-foreground border border-border/50">
                {totalCookiesCount} {totalCookiesCount === 1 ? "cookie" : "cookies"} stored
              </span>
            )}
          </div>
        </DialogHeader>

        {/* Top Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as "manage" | "sync")}
          className="flex-1 flex flex-col min-h-0"
        >
          <div className="px-6 border-b border-border/40 bg-card/10 shrink-0">
            <TabsList className="bg-transparent h-10 p-0 gap-6">
              <TabsTrigger
                value="manage"
                className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 py-2 font-semibold text-muted-foreground data-[state=active]:text-foreground transition-all"
              >
                Manage Cookies
              </TabsTrigger>
              <TabsTrigger
                value="sync"
                className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 py-2 font-semibold text-muted-foreground data-[state=active]:text-foreground transition-all"
              >
                Sync Cookies
              </TabsTrigger>
            </TabsList>
          </div>

          {/* TAB 1: MANAGE COOKIES */}
          <TabsContent value="manage" className="flex-1 flex flex-col min-h-0 m-0 focus-visible:outline-none">
            {/* Domain Add Input Bar */}
            <div className="p-4 border-b border-border/40 flex items-center gap-2.5 shrink-0 bg-secondary/10">
              <div className="relative flex-1">
                <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={newDomainInput}
                  onChange={(e) => setNewDomainInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddDomain()}
                  placeholder="Type a domain name (e.g. localhost, api.example.com)"
                  className="pl-9 h-9 text-xs bg-background/80 border-border/70 focus-visible:ring-primary/40"
                />
              </div>
              <Button
                onClick={handleAddDomain}
                size="sm"
                className="h-9 px-4 text-xs font-semibold gap-1.5"
              >
                <Plus size={14} />
                Add domain
              </Button>
            </div>

            {/* Domains & Cookies List */}
            <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-3">
              {domainsList.length === 0 ? (
                /* Empty State */
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <div className="w-16 h-16 rounded-full bg-secondary/40 border border-border/60 flex items-center justify-center text-muted-foreground mb-4 shadow-inner">
                    <Cookie size={32} className="opacity-40" />
                  </div>
                  <h4 className="text-sm font-semibold text-foreground mb-1">
                    No Cookies available
                  </h4>
                  <p className="text-xs text-muted-foreground max-w-sm leading-relaxed mb-4">
                    Cookies received from API responses (Set-Cookie) or added manually for a domain will be stored and automatically injected into subsequent requests.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setNewDomainInput("localhost");
                    }}
                    className="text-xs border-border/70 hover:bg-secondary/40"
                  >
                    Quick Add "localhost"
                  </Button>
                </div>
              ) : (
                /* Domain Accordion List */
                domainsList.map((domain) => {
                  const cookies = cookiesByDomain[domain] || [];
                  const isExpanded = !!expandedDomains[domain];

                  return (
                    <div
                      key={domain}
                      className="border border-border/60 rounded-lg overflow-hidden bg-card/30 transition-all"
                    >
                      {/* Domain Header Row */}
                      <div
                        onClick={() => toggleDomainExpand(domain)}
                        className="flex items-center justify-between px-3.5 py-2.5 bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                          <span className="font-semibold text-xs text-foreground font-mono truncate">
                            {domain}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-secondary text-muted-foreground border border-border/50">
                            {cookies.length} {cookies.length === 1 ? "cookie" : "cookies"}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenAddCookie(domain)}
                            className="h-7 px-2 text-[11px] font-semibold text-primary hover:text-primary hover:bg-primary/10 gap-1"
                          >
                            <Plus size={12} />
                            Add Cookie
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleDeleteDomain(domain, e)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10"
                            title="Delete all cookies for this domain"
                          >
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      </div>

                      {/* Domain Cookies Expanded */}
                      {isExpanded && (
                        <div className="p-3 border-t border-border/40 bg-background/50 space-y-2.5">
                          {cookies.length === 0 ? (
                            <div className="text-center py-4 text-xs text-muted-foreground italic">
                              No cookies stored for this domain. Click "+ Add Cookie" above to create one.
                            </div>
                          ) : (
                            cookies.map((cookie) => {
                              const copyKey = `${cookie.domain}:${cookie.name}`;
                              const isCopied = copiedKey === copyKey;

                              return (
                                <div
                                  key={cookie.name}
                                  className="p-2.5 rounded-md border border-border/50 bg-secondary/20 hover:bg-secondary/30 transition-colors flex flex-col gap-2"
                                >
                                  {/* Row 1: Name & Actions */}
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="text-xs font-bold text-primary font-mono truncate">
                                        {cookie.name}
                                      </span>
                                      {cookie.httpOnly && (
                                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                          HttpOnly
                                        </span>
                                      )}
                                      {cookie.secure && (
                                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                          Secure
                                        </span>
                                      )}
                                      {cookie.sameSite && (
                                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                          {cookie.sameSite}
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        onClick={() => handleCopyValue(cookie)}
                                        className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                                        title="Copy cookie value"
                                      >
                                        {isCopied ? (
                                          <Check size={12} className="text-emerald-400" />
                                        ) : (
                                          <Copy size={12} />
                                        )}
                                      </button>
                                      <button
                                        onClick={() => handleOpenEditCookie(domain, cookie)}
                                        className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                                        title="Edit cookie"
                                      >
                                        <Edit2 size={12} />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteCookie(domain, cookie.name)}
                                        className="p-1 rounded hover:bg-rose-500/10 text-muted-foreground hover:text-rose-400 transition-colors"
                                        title="Delete cookie"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Row 2: Value */}
                                  <div className="text-[11px] font-mono bg-black/30 px-2 py-1 rounded border border-border/30 text-foreground/90 break-all select-all">
                                    {cookie.value || <span className="italic text-muted-foreground/40">(empty value)</span>}
                                  </div>

                                  {/* Row 3: Meta details */}
                                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
                                    <span>
                                      Path: <strong className="text-foreground/80 font-mono">{cookie.path || "/"}</strong>
                                    </span>
                                    {cookie.expires && (
                                      <span className="flex items-center gap-1">
                                        <Clock size={10} />
                                        Expires: <strong className="text-foreground/80">{new Date(cookie.expires).toLocaleString()}</strong>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Footer with Domains Allowlist button */}
            <div className="px-5 py-3 border-t border-border/40 bg-secondary/10 flex items-center justify-between shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAllowlistModal(true)}
                className="h-8 text-xs font-semibold text-muted-foreground hover:text-foreground border-border/60 gap-1.5"
              >
                <Shield size={13} className="text-primary" />
                Domains Allowlist {allowlist.length > 0 && `(${allowlist.length})`}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Close
              </Button>
            </div>
          </TabsContent>

          {/* TAB 2: SYNC COOKIES */}
          <TabsContent value="sync" className="flex-1 flex flex-col min-h-0 p-6 overflow-y-auto space-y-6 m-0 focus-visible:outline-none">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">
                Sync Cookies with Interceptor & Proxy
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Capture session cookies automatically from your browser, mobile app, or backend services during development.
              </p>
            </div>

            {/* Interceptor vs Proxy toggle buttons */}
            <div className="flex items-center gap-2 p-1 bg-secondary/40 border border-border/60 rounded-lg w-fit">
              <button
                onClick={() => setSyncMode("interceptor")}
                className={cn(
                  "text-xs px-4 py-1.5 rounded-md font-semibold transition-all",
                  syncMode === "interceptor"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Interceptor
              </button>
              <button
                onClick={() => setSyncMode("proxy")}
                className={cn(
                  "text-xs px-4 py-1.5 rounded-md font-semibold transition-all",
                  syncMode === "proxy"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Proxy
              </button>
            </div>

            {/* Proxy Mode Details */}
            {syncMode === "proxy" && (
              <div className="space-y-5 border border-border/60 rounded-xl p-5 bg-card/30">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-bold text-foreground">
                      Enable RouteLens as a proxy
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Sync cookies from any device or browser with RouteLens's built-in proxy.
                    </p>
                  </div>
                  <Switch
                    checked={proxyEnabled}
                    onCheckedChange={(val) => {
                      setProxyEnabled(val);
                      if (val) {
                        toast.success(`Local proxy activated on port ${proxyPort}`);
                      } else {
                        toast.info("Local proxy deactivated");
                      }
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-foreground">Port</Label>
                  <Input
                    value={proxyPort}
                    onChange={(e) => setProxyPort(e.target.value)}
                    disabled={proxyEnabled}
                    className="h-8 text-xs font-mono max-w-[120px] bg-background border-border/70"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-foreground">
                    Target Domains Filter
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={syncDomainInput}
                      onChange={(e) => setSyncDomainInput(e.target.value)}
                      placeholder="Enter domain name (domain.com) or (sub.domain.com)"
                      className="h-8 text-xs bg-background border-border/70"
                    />
                    <Button
                      size="sm"
                      onClick={() => {
                        const trimmed = syncDomainInput.trim().toLowerCase();
                        if (trimmed && !syncDomains.includes(trimmed)) {
                          setSyncDomains([...syncDomains, trimmed]);
                          setSyncDomainInput("");
                        }
                      }}
                      className="h-8 text-xs shrink-0"
                    >
                      Add Domain
                    </Button>
                  </div>

                  {syncDomains.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {syncDomains.map((d) => (
                        <span
                          key={d}
                          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs bg-primary/10 text-primary border border-primary/20 font-mono"
                        >
                          {d}
                          <button
                            onClick={() => setSyncDomains(syncDomains.filter((x) => x !== d))}
                            className="hover:text-rose-400"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <Button
                    onClick={() => {
                      setProxyEnabled(!proxyEnabled);
                      if (!proxyEnabled) {
                        toast.success("Proxy syncing started");
                      } else {
                        toast.info("Proxy syncing stopped");
                      }
                    }}
                    className={cn(
                      "text-xs font-semibold h-8",
                      proxyEnabled ? "bg-rose-600 hover:bg-rose-700 text-white" : ""
                    )}
                  >
                    {proxyEnabled ? "Stop Syncing" : "Start Syncing"}
                  </Button>
                </div>
              </div>
            )}

            {syncMode === "interceptor" && (
              <div className="border border-border/60 rounded-xl p-5 bg-card/30 space-y-3">
                <div className="flex items-center gap-2 text-primary font-semibold text-xs">
                  <Radio size={16} />
                  Browser Interceptor
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  RouteLens automatically captures session cookies whenever you execute requests in the API Explorer. All headers returned via <code>Set-Cookie</code> are stored in the local Cookie Jar and injected automatically.
                </p>
                <div className="p-3 bg-secondary/30 rounded-lg text-xs font-mono text-muted-foreground">
                  Status: <span className="text-emerald-400 font-bold">Active & Capturing</span>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* MODAL: EDIT / ADD COOKIE DIALOG */}
        {editingCookie && (
          <Dialog open={true} onOpenChange={() => setEditingCookie(null)}>
            <DialogContent className="max-w-md bg-[hsl(240,6%,11%)] border-border/80 p-5 space-y-4 select-none">
              <DialogHeader>
                <DialogTitle className="text-sm font-bold text-foreground">
                  {editingCookie.isNew ? "Add New Cookie" : "Edit Cookie"}
                </DialogTitle>
                <p className="text-xs text-muted-foreground font-mono">
                  Domain: {editingCookie.domain}
                </p>
              </DialogHeader>

              <div className="space-y-3 text-xs">
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-foreground">Cookie Name</Label>
                  <Input
                    value={editingCookie.cookie.name}
                    onChange={(e) =>
                      setEditingCookie({
                        ...editingCookie,
                        cookie: { ...editingCookie.cookie, name: e.target.value },
                      })
                    }
                    placeholder="e.g. session_token"
                    className="h-8 text-xs font-mono bg-background border-border/70"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-foreground">Cookie Value</Label>
                  <Input
                    value={editingCookie.cookie.value}
                    onChange={(e) =>
                      setEditingCookie({
                        ...editingCookie,
                        cookie: { ...editingCookie.cookie, value: e.target.value },
                      })
                    }
                    placeholder="Value"
                    className="h-8 text-xs font-mono bg-background border-border/70"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-foreground">Path</Label>
                    <Input
                      value={editingCookie.cookie.path}
                      onChange={(e) =>
                        setEditingCookie({
                          ...editingCookie,
                          cookie: { ...editingCookie.cookie, path: e.target.value },
                        })
                      }
                      placeholder="/"
                      className="h-8 text-xs font-mono bg-background border-border/70"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-foreground">SameSite</Label>
                    <Select
                      value={editingCookie.cookie.sameSite || "Lax"}
                      onValueChange={(v) =>
                        setEditingCookie({
                          ...editingCookie,
                          cookie: { ...editingCookie.cookie, sameSite: v as any },
                        })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs bg-background border-border/70">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border text-foreground">
                        <SelectItem value="Lax" className="text-xs">Lax</SelectItem>
                        <SelectItem value="Strict" className="text-xs">Strict</SelectItem>
                        <SelectItem value="None" className="text-xs">None</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-6 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={editingCookie.cookie.httpOnly}
                      onCheckedChange={(checked) =>
                        setEditingCookie({
                          ...editingCookie,
                          cookie: { ...editingCookie.cookie, httpOnly: checked === true },
                        })
                      }
                    />
                    <span className="text-xs font-medium text-foreground">HttpOnly</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={editingCookie.cookie.secure}
                      onCheckedChange={(checked) =>
                        setEditingCookie({
                          ...editingCookie,
                          cookie: { ...editingCookie.cookie, secure: checked === true },
                        })
                      }
                    />
                    <span className="text-xs font-medium text-foreground">Secure</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingCookie(null)}
                  className="h-8 text-xs font-semibold text-muted-foreground"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveEditedCookie}
                  className="h-8 text-xs font-semibold px-4"
                >
                  Save Cookie
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* MODAL: DOMAINS ALLOWLIST DIALOG */}
        {showAllowlistModal && (
          <Dialog open={true} onOpenChange={() => setShowAllowlistModal(false)}>
            <DialogContent className="max-w-md bg-[hsl(240,6%,11%)] border-border/80 p-5 space-y-4 select-none">
              <DialogHeader>
                <DialogTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Shield size={16} className="text-primary" />
                  Domains Allowlist
                </DialogTitle>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  When specified, RouteLens will only capture and send cookies for allowed domains. If the list is empty, cookies for all domains are permitted.
                </p>
              </DialogHeader>

              <div className="flex items-center gap-2">
                <Input
                  value={newAllowlistDomain}
                  onChange={(e) => setNewAllowlistDomain(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddAllowlistDomain()}
                  placeholder="e.g. localhost, api.mysite.com"
                  className="h-8 text-xs bg-background border-border/70"
                />
                <Button
                  size="sm"
                  onClick={handleAddAllowlistDomain}
                  className="h-8 text-xs shrink-0"
                >
                  Add
                </Button>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5 border border-border/40 rounded-lg p-2.5 bg-background/50">
                {allowlist.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic text-center py-3">
                    Allowlist is empty (all domains allowed).
                  </p>
                ) : (
                  allowlist.map((d) => (
                    <div
                      key={d}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded bg-secondary/30 text-xs font-mono"
                    >
                      <span>{d}</span>
                      <button
                        onClick={() => handleRemoveAllowlistDomain(d)}
                        className="text-muted-foreground hover:text-rose-400 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  size="sm"
                  onClick={() => setShowAllowlistModal(false)}
                  className="h-8 text-xs font-semibold px-4"
                >
                  Done
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
