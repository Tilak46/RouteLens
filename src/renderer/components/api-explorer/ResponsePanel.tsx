import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertCircle, Terminal, Loader2, Copy, Check, Cookie } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiHttpResponse } from "../../../types";
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { postmanTheme } from "./codemirrorTheme";

type ResponsePanelProps = {
  response: ApiHttpResponse | null;
  loading?: boolean;
  tabId?: string;
  lastCompletedAt?: number;
  onOpenCookies?: () => void;
};

// Simple tokenizer to color-code JSON strings for a premium developer feel
function highlightJson(jsonStr: string): string {
  if (!jsonStr) return "";
  try {
    return jsonStr
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(
        /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
        (match) => {
          let cls = "text-[#98c379]"; // Default to soothing soft green for numbers
          if (/^"/.test(match)) {
            if (/:$/.test(match)) {
              const colonIndex = match.lastIndexOf(":");
              const keyPart = match.substring(0, colonIndex);
              const colonPart = match.substring(colonIndex);
              return `<span class="text-sky-300 font-medium">${keyPart}</span><span class="text-white">${colonPart}</span>`;
            } else {
              cls = "text-[#ffb86c]"; // Warm vibrant gold/orange for string values
            }
          } else if (/true|false/.test(match)) {
            cls = "text-[#ffb86c]"; // Warm vibrant gold/orange for booleans
          } else if (/null/.test(match)) {
            cls = "text-zinc-500 italic"; // Gray for nulls
          }
          return `<span class="${cls}">${match}</span>`;
        }
      );
  } catch {
    return jsonStr;
  }
}

export function ResponsePanel({
  response,
  loading = false,
  tabId,
  lastCompletedAt,
  onOpenCookies,
}: ResponsePanelProps) {
  const [blink, setBlink] = useState<"success" | "error" | null>(null);
  const [blinkTrigger, setBlinkTrigger] = useState(0);
  const [copied, setCopied] = useState(false);
  const [copiedCookie, setCopiedCookie] = useState<string | null>(null);
  const prevLastCompletedAtRef = useRef<number | undefined>(undefined);
  const prevTabIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    // Only trigger blink if the request timestamp changed on the same active tab
    if (lastCompletedAt && lastCompletedAt !== prevLastCompletedAtRef.current && prevTabIdRef.current === tabId) {
      const isOk = response && response.ok && response.status < 400;
      setBlink(isOk ? "success" : "error");
      setBlinkTrigger(prev => prev + 1);
      const timer = setTimeout(() => {
        setBlink(null);
      }, 1500);
      return () => clearTimeout(timer);
    }
    prevLastCompletedAtRef.current = lastCompletedAt;
    prevTabIdRef.current = tabId;
  }, [lastCompletedAt, tabId, response]);

  if (!response && !loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[hsl(240,5%,9%)]/30 border border-border/40 rounded-xl min-h-[220px] select-none text-center">
        <div className="p-4 bg-muted/40 border border-border/80 rounded-full mb-3 text-muted-foreground/60 shadow-inner">
          <Terminal size={32} />
        </div>
        <h4 className="text-sm font-semibold text-foreground/80 mb-1">Response Pane</h4>
        <p className="text-xs text-muted-foreground max-w-xs leading-normal">
          Enter an endpoint URL above and click "Send" to trigger a request and inspect the response.
        </p>
      </div>
    );
  }

  const isError = response ? (response.status >= 400 || !response.ok || response.status === 0) : false;
  const timeLabel = (response && !loading && typeof response.timeMs === "number")
    ? response.timeMs >= 1000
      ? `${(response.timeMs / 1000).toFixed(2)} s`
      : `${response.timeMs} ms`
    : null;
  const sizeLabel = (response && !loading)
    ? response.sizeBytes
      ? response.sizeBytes > 1024
        ? `${(response.sizeBytes / 1024).toFixed(2)} KB`
        : `${response.sizeBytes} B`
      : null
    : null;

  const hasJson = response ? response.parsedJson !== undefined : false;
  const prettyBody = response
    ? (hasJson ? JSON.stringify(response.parsedJson, null, 2) : response.bodyText)
    : "";

  const handleCopy = () => {
    if (!response) return;
    const textToCopy = prettyBody || response.bodyText || "";
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    toast.success("Response copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  // Format headers counts
  const headerCount = response ? Object.keys(response.headers || {}).length : 0;
  const responseCookies = response?.cookies || [];
  const cookieCount = responseCookies.length;
  const shouldFade = loading && !!response;

  return (
    <div
      className="relative flex-grow flex flex-col overflow-hidden min-h-[260px] border border-border/60 bg-[hsl(240,5%,9%)]/20 rounded-xl p-4 select-none"
    >
      {/* Top Blink Highlight Line */}
      {blink && (
        <div
          key={blinkTrigger}
          className={cn(
            "absolute top-0 left-0 right-0 h-[2px] rounded-t-xl z-50 pointer-events-none",
            blink === "success" ? "animate-blink-success" : "animate-blink-error"
          )}
        />
      )}
      
      {/* Top Details Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 shrink-0 pb-3 border-b border-border/50">
        <span className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">
          Response Console
        </span>

        {/* Status Indicators & Actions */}
        <div className="flex items-center gap-3 text-xs">
          {loading ? (
            <span className="flex items-center gap-1.5 font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 animate-pulse">
              <Loader2 className="animate-spin" size={12} />
              Sending Request...
            </span>
          ) : response ? (
            <span
              className={cn(
                "flex items-center gap-1 font-semibold px-2 py-0.5 rounded",
                isError
                  ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                  : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              )}
            >
              {isError ? <AlertCircle size={12} /> : <CheckCircle2 size={12} />}
              {response.status === 0
                ? (response.statusText || "Could Not Connect")
                : `${response.status} ${response.statusText || ""}`.trim()}
            </span>
          ) : null}

          {timeLabel && (
            <span className="text-muted-foreground/80 font-mono font-medium bg-secondary/40 px-2 py-0.5 rounded border border-border/30 animate-in fade-in duration-200">
              {timeLabel}
            </span>
          )}

          {sizeLabel && (
            <span className="text-muted-foreground/80 font-mono font-medium bg-secondary/40 px-2 py-0.5 rounded border border-border/30 animate-in fade-in duration-200">
              {sizeLabel}
            </span>
          )}

          {response && !loading && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-secondary/40 hover:bg-secondary/70 border border-border/40 px-2 py-0.5 rounded transition-all cursor-pointer select-none"
              title="Copy Response JSON to Clipboard"
            >
              {copied ? (
                <>
                  <Check size={12} className="text-emerald-400" />
                  <span className="text-emerald-400 font-semibold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={12} />
                  <span>Copy</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {!loading && response && response.error && (
        <div className="mb-4 text-xs text-rose-400 font-mono bg-rose-950/20 border border-rose-900/30 rounded-lg p-3 whitespace-pre-wrap leading-relaxed select-text">
          {response.error}
        </div>
      )}

      {/* Response body tabs */}
      <div className={cn("flex-grow flex flex-col min-h-0 transition-opacity duration-300", shouldFade ? "opacity-30 pointer-events-none" : "opacity-100")}>
        <Tabs defaultValue="body" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="bg-transparent border-b border-border/40 w-full justify-start rounded-none h-8 p-0 gap-4 shrink-0">
            <TabsTrigger
              value="body"
              className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 py-1 h-full font-medium"
            >
              Pretty Body
            </TabsTrigger>
            <TabsTrigger
              value="headers"
              className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 py-1 h-full font-medium"
            >
              Headers {headerCount > 0 && `(${headerCount})`}
            </TabsTrigger>
            <TabsTrigger
              value="cookies"
              className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 py-1 h-full font-medium"
            >
              Cookies {cookieCount > 0 && `(${cookieCount})`}
            </TabsTrigger>
            <TabsTrigger
              value="raw"
              className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 py-1 h-full font-medium"
            >
              Raw Output
            </TabsTrigger>
          </TabsList>

          {/* PRETTY BODY (Syntax Highlighting) */}
          <TabsContent value="body" className="flex-grow flex flex-col min-h-0 mt-3 focus-visible:outline-none select-text">
            {loading && !response ? (
              <div className="flex-grow flex flex-col gap-2.5 p-4 border border-border/40 rounded-lg bg-input/50 animate-pulse">
                <div className="h-4 bg-muted/40 rounded w-1/4" />
                <div className="h-4 bg-muted/40 rounded w-3/4" />
                <div className="h-4 bg-muted/40 rounded w-1/2" />
                <div className="h-4 bg-muted/40 rounded w-2/3" />
                <div className="h-4 bg-muted/40 rounded w-1/3" />
              </div>
            ) : prettyBody ? (
              <CodeMirror
                value={prettyBody}
                theme={postmanTheme}
                extensions={hasJson ? [json()] : []}
                readOnly={true}
                editable={false}
                className="flex-grow border border-border/40 rounded-lg overflow-hidden text-[13px]"
                height="100%"
              />
            ) : (
              <div className="flex-grow font-mono text-xs text-muted-foreground/30 bg-input border border-border/40 p-4 rounded-lg italic">
                Empty body content
              </div>
            )}
          </TabsContent>

          {/* RAW BODY */}
          <TabsContent value="raw" className="flex-grow flex flex-col min-h-0 mt-3 focus-visible:outline-none select-text">
            {loading && !response ? (
              <div className="flex-grow flex flex-col gap-2.5 p-4 border border-border/40 rounded-lg bg-input/50 animate-pulse">
                <div className="h-3 bg-muted/40 rounded w-1/2" />
                <div className="h-3 bg-muted/40 rounded w-5/6" />
                <div className="h-3 bg-muted/40 rounded w-3/4" />
              </div>
            ) : (
              <pre className="flex-grow font-mono text-xs text-muted-foreground bg-input border border-border/40 p-4 rounded-lg overflow-auto leading-relaxed select-text scrollbar-thin">
                <code>{response?.bodyText || <span className="text-muted-foreground/30 italic">Empty body content</span>}</code>
              </pre>
            )}
          </TabsContent>

          {/* HEADERS */}
          <TabsContent value="headers" className="flex-grow flex flex-col min-h-0 mt-3 focus-visible:outline-none select-text">
            {loading && !response ? (
              <div className="flex-grow flex flex-col gap-2.5 p-4 border border-border/40 rounded-lg bg-input/50 animate-pulse">
                <div className="h-3 bg-muted/40 rounded w-1/3" />
                <div className="h-3 bg-muted/40 rounded w-2/3" />
                <div className="h-3 bg-muted/40 rounded w-1/2" />
              </div>
            ) : (
              <div className="flex-grow bg-input border border-border/40 rounded-lg overflow-auto p-4 scrollbar-thin">
                {headerCount === 0 ? (
                  <div className="text-xs text-muted-foreground italic">No headers received.</div>
                ) : response ? (
                  <table className="w-full text-xs font-mono select-text border-collapse">
                    <thead>
                      <tr className="border-b border-border/30 text-left text-muted-foreground font-sans">
                        <th className="pb-2 font-semibold">Header Name</th>
                        <th className="pb-2 font-semibold pl-4">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {Object.entries(response.headers)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([key, value]) => (
                          <tr key={key} className="hover:bg-white/5 transition-colors">
                            <td className="py-2 pr-4 font-semibold text-sky-400 select-all truncate max-w-xs">{key}</td>
                            <td className="py-2 pl-4 text-foreground/85 select-all break-all">{value}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                ) : null}
              </div>
            )}
          </TabsContent>

          {/* COOKIES */}
          <TabsContent value="cookies" className="flex-grow flex flex-col min-h-0 mt-3 focus-visible:outline-none select-text">
            {loading && !response ? (
              <div className="flex-grow flex flex-col gap-2.5 p-4 border border-border/40 rounded-lg bg-input/50 animate-pulse">
                <div className="h-3 bg-muted/40 rounded w-1/3" />
                <div className="h-3 bg-muted/40 rounded w-2/3" />
              </div>
            ) : (
              <div className="flex-grow bg-input border border-border/40 rounded-lg overflow-auto p-4 scrollbar-thin">
                {cookieCount === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center py-8 text-center">
                    <Cookie size={28} className="text-muted-foreground/30 mb-2" />
                    <div className="text-xs text-muted-foreground font-medium">
                      No cookies returned in this response
                    </div>
                    <p className="text-[11px] text-muted-foreground/60 max-w-xs mt-1 leading-relaxed">
                      When an endpoint responds with <code>Set-Cookie</code> headers, they are parsed, displayed here, and automatically stored in the Cookie Jar for future requests.
                    </p>
                    {onOpenCookies && (
                      <button
                        type="button"
                        onClick={onOpenCookies}
                        className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/20 border border-primary/20 px-3 py-1.5 rounded transition-colors cursor-pointer"
                      >
                        <Cookie size={12} />
                        <span>Open Cookie Jar</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-border/30">
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Response Cookies ({cookieCount})
                      </span>
                      {onOpenCookies && (
                        <button
                          type="button"
                          onClick={onOpenCookies}
                          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-secondary/40 hover:bg-secondary/70 border border-border/40 px-2.5 py-1 rounded transition-all cursor-pointer"
                        >
                          <Cookie size={12} className="text-amber-400" />
                          <span>Manage in Cookie Jar</span>
                        </button>
                      )}
                    </div>
                    <table className="w-full text-xs font-mono select-text border-collapse">
                    <thead>
                      <tr className="border-b border-border/30 text-left text-muted-foreground font-sans text-[11px]">
                        <th className="pb-2 font-semibold">Name</th>
                        <th className="pb-2 font-semibold pl-3">Value</th>
                        <th className="pb-2 font-semibold pl-3">Domain</th>
                        <th className="pb-2 font-semibold pl-3">Path</th>
                        <th className="pb-2 font-semibold pl-3">Expires</th>
                        <th className="pb-2 font-semibold pl-3 text-right">Flags</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {responseCookies.map((c, i) => {
                        const isCopied = copiedCookie === c.name;
                        return (
                          <tr key={`${c.name}-${i}`} className="hover:bg-white/5 transition-colors">
                            <td className="py-2.5 pr-3 font-semibold text-primary select-all truncate max-w-[140px]">
                              {c.name}
                            </td>
                            <td className="py-2.5 pl-3 text-foreground/85 select-all max-w-[200px]">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate">{c.value}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(c.value);
                                    setCopiedCookie(c.name);
                                    toast.success(`Cookie "${c.name}" copied to clipboard`);
                                    setTimeout(() => setCopiedCookie(null), 2000);
                                  }}
                                  className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground shrink-0 transition-colors"
                                  title="Copy cookie value"
                                >
                                  {isCopied ? (
                                    <Check size={11} className="text-emerald-400" />
                                  ) : (
                                    <Copy size={11} />
                                  )}
                                </button>
                              </div>
                            </td>
                            <td className="py-2.5 pl-3 text-muted-foreground select-all font-mono text-[11px]">
                              {c.domain}
                            </td>
                            <td className="py-2.5 pl-3 text-muted-foreground select-all font-mono text-[11px]">
                              {c.path || "/"}
                            </td>
                            <td className="py-2.5 pl-3 text-muted-foreground select-all text-[11px]">
                              {c.expires ? new Date(c.expires).toLocaleDateString() : "Session"}
                            </td>
                            <td className="py-2.5 pl-3 text-right">
                              <div className="flex items-center justify-end gap-1 font-sans">
                                {c.httpOnly && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                    HttpOnly
                                  </span>
                                )}
                                {c.secure && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    Secure
                                  </span>
                                )}
                                {c.sameSite && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                    {c.sameSite}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

