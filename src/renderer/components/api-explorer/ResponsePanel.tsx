import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  Loader2,
  Copy,
  Check,
  Cookie,
  FileCheck,
  FileText,
  Layers,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiHttpResponse } from "../../../types";
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { postmanTheme, postmanTransparentTheme } from "./codemirrorTheme";

const HTTP_STATUS_TEXT: Record<number, string> = {
  200: "OK",
  201: "Created",
  202: "Accepted",
  204: "No Content",
  206: "Partial Content",
  301: "Moved Permanently",
  302: "Found",
  304: "Not Modified",
  307: "Temporary Redirect",
  308: "Permanent Redirect",
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  408: "Request Timeout",
  409: "Conflict",
  410: "Gone",
  413: "Payload Too Large",
  415: "Unsupported Media Type",
  422: "Unprocessable Entity",
  429: "Too Many Requests",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
};

export function getStatusText(status: number, fallback?: string): string {
  if (status === 0) return "Could Not Connect";
  return fallback || HTTP_STATUS_TEXT[status] || "";
}

function getStatusTextStyle(status: number) {
  if (status === 0) {
    return "text-rose-400";
  }
  if (status >= 200 && status < 300) {
    return "text-emerald-400";
  }
  if (status >= 300 && status < 400) {
    return "text-sky-400";
  }
  if (status >= 400 && status < 500) {
    return "text-amber-400";
  }
  return "text-rose-400";
}

type ResponsePanelProps = {
  response: ApiHttpResponse | null;
  loading?: boolean;
  tabId?: string;
  url?: string;
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

function formatNetworkError(rawError?: string, url?: string): string {
  if (!rawError) return "Error: connect ECONNREFUSED";
  let target = "";
  try {
    if (url) {
      const clean = url.match(/^https?:\/\//i) ? url : `http://${url}`;
      const u = new URL(clean);
      target = ` ${u.hostname}:${u.port || (u.protocol === "https:" ? "443" : "80")}`;
    }
  } catch {}

  if (rawError.includes("AggregateError") || rawError.includes("fetch failed")) {
    return `Error: connect ECONNREFUSED${target || " 127.0.0.1:3000"}`;
  }
  if (!rawError.toLowerCase().startsWith("error")) {
    return `Error: ${rawError}`;
  }
  return rawError;
}

export function ResponsePanel({
  response,
  loading = false,
  tabId,
  url,
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

  const isError = response ? (response.status >= 400 || !response.ok || response.status === 0) : false;
  const timeLabel = (response && !loading && typeof response.timeMs === "number")
    ? response.timeMs >= 1000
      ? `${(response.timeMs / 1000).toFixed(2)} s`
      : `${response.timeMs} ms`
    : null;
  const sizeLabel = (response && !loading && response.status > 0)
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
    <Tabs defaultValue="body" className="relative flex-grow flex flex-col overflow-hidden min-h-0 select-none px-4 pt-2 pb-2 bg-transparent">
      {/* Top Blink Highlight Line */}
      {blink && (
        <div
          key={blinkTrigger}
          className={cn(
            "absolute top-0 left-0 right-0 h-[2px] z-50 pointer-events-none",
            blink === "success" ? "animate-blink-success" : "animate-blink-error"
          )}
        />
      )}
      
      {/* Top Unified Header Bar: Tabs on Left, Status/Metrics on Right */}
      <TabsList className="bg-transparent border-b border-white/[0.06] w-full justify-between rounded-none h-9 p-0 gap-4 shrink-0">
        {/* Left: Persistent Tab Triggers */}
        <div className="flex items-center gap-4 h-full">
          <TabsTrigger
            value="body"
            className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 py-1.5 h-full font-medium"
          >
            Body
          </TabsTrigger>
          <TabsTrigger
            value="headers"
            className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 py-1.5 h-full font-medium"
          >
            Headers {headerCount > 0 && `(${headerCount})`}
          </TabsTrigger>
          <TabsTrigger
            value="cookies"
            className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 py-1.5 h-full font-medium"
          >
            Cookies {cookieCount > 0 && `(${cookieCount})`}
          </TabsTrigger>
          <TabsTrigger
            value="raw"
            className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 py-1.5 h-full font-medium"
          >
            Raw Output
          </TabsTrigger>
        </div>

        {/* Right: Status Indicators, Timers, Size & Action Buttons */}
        <div className="flex items-center gap-3 text-xs pr-1">
          {loading ? (
            <span className="flex items-center gap-1.5 font-medium text-primary text-xs animate-pulse">
              <Loader2 className="animate-spin" size={12} />
              Sending Request...
            </span>
          ) : response ? (
            <span
              className={cn(
                "flex items-center gap-1.5 font-semibold text-xs select-none transition-colors",
                getStatusTextStyle(response.status)
              )}
            >
              {response.status === 0 ? (
                <AlertCircle size={13} className="text-rose-400" />
              ) : response.status >= 200 && response.status < 300 ? (
                <CheckCircle2 size={13} className="text-emerald-400" />
              ) : response.status >= 300 && response.status < 400 ? (
                <ArrowUpRight size={13} className="text-sky-400" />
              ) : response.status >= 400 && response.status < 500 ? (
                <AlertTriangle size={13} className="text-amber-400" />
              ) : (
                <AlertCircle size={13} className="text-rose-400" />
              )}
              {response.status === 0
                ? "Could Not Connect"
                : `${response.status} ${getStatusText(response.status, response.statusText)}`.trim()}
            </span>
          ) : null}

          {timeLabel && (
            <span className="text-sky-400 font-mono text-xs font-medium animate-in fade-in duration-200">
              {timeLabel}
            </span>
          )}

          {sizeLabel && (
            <span className="text-violet-400 font-mono text-xs font-medium animate-in fade-in duration-200">
              {sizeLabel}
            </span>
          )}

          {response && !loading && response.status > 0 && (
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground/70 hover:text-foreground transition-colors cursor-pointer select-none ml-0.5"
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
      </TabsList>

      {/* Tabs Content Container */}
      <div className={cn("flex-grow flex flex-col min-h-0 transition-opacity duration-300", shouldFade ? "opacity-30 pointer-events-none" : "opacity-100")}>
        {/* PRETTY BODY (Syntax Highlighting) */}
        <TabsContent value="body" className="flex-grow flex flex-col min-h-0 mt-2 focus-visible:outline-none select-text">
          {(!response && !loading) ? (
            // STATE 1: IDLE / EMPTY STATE (Bare icon, zero box/border)
            <div className="flex-1 flex flex-col items-center justify-center p-6 select-none text-center animate-in fade-in duration-300">
              <Send size={22} className="text-muted-foreground/35 mb-2.5 ml-0.5" />
              <h4 className="text-xs font-semibold text-foreground/80 mb-1 tracking-tight">
                Click Send to get a response
              </h4>
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground/50">
                <span>Hit</span>
                <span className="font-mono text-foreground/75 font-medium">Ctrl + Enter</span>
                <span>to run</span>
              </div>
            </div>
          ) : (response && response.status === 0 && !loading) ? (
            // STATE 2: CONNECTION ERROR (Status 0)
            (() => {
              const cleanError = formatNetworkError(response.error, url);
              return (
                <div className="flex-1 flex flex-col items-center justify-center p-6 select-none text-center animate-in fade-in duration-300 overflow-y-auto">
                  <AlertCircle size={22} className="text-rose-400/80 mb-2" />
                  <h4 className="text-xs font-semibold text-foreground/90 tracking-tight mb-2.5">
                    Could not send request
                  </h4>

                  {/* Clean Red Error Card */}
                  <div className="w-full max-w-lg bg-[#2e1010]/80 border border-rose-800/50 rounded-lg p-2.5 px-3.5 mb-2.5 flex items-center justify-between gap-3 shadow-md shadow-rose-950/20">
                    <div className="flex items-center gap-2 min-w-0 flex-1 text-left">
                      <AlertCircle size={14} className="text-rose-400 shrink-0" />
                      <span className="font-mono text-xs text-rose-200 select-all truncate font-medium">
                        {cleanError}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(cleanError);
                        toast.success("Error copied to clipboard");
                      }}
                      className="shrink-0 flex items-center gap-1 text-[11px] font-medium text-rose-300 hover:text-white bg-rose-900/40 hover:bg-rose-900/70 border border-rose-700/50 px-2 py-0.5 rounded transition-colors cursor-pointer"
                      title="Copy Error"
                    >
                      <Copy size={11} />
                      <span>Copy</span>
                    </button>
                  </div>

                  {/* Centered Troubleshooting Line (Postman Style) */}
                  <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground/80 max-w-lg text-center">
                    <span className="text-foreground/75 font-medium">Make sure backend is running</span>
                    <span className="text-muted-foreground/40">•</span>
                    <span>Verify port & Base URL</span>
                    <span className="text-muted-foreground/40">•</span>
                    <span>Check firewall</span>
                  </div>
                </div>
              );
            })()
          ) : loading && !response ? (
            <div className="flex-grow flex flex-col gap-2.5 p-3 animate-pulse">
              <div className="h-4 bg-white/[0.04] rounded w-1/4" />
              <div className="h-4 bg-white/[0.04] rounded w-3/4" />
              <div className="h-4 bg-white/[0.04] rounded w-1/2" />
              <div className="h-4 bg-white/[0.04] rounded w-2/3" />
              <div className="h-4 bg-white/[0.04] rounded w-1/3" />
            </div>
          ) : (prettyBody && prettyBody.trim().length > 0) ? (
            <CodeMirror
              value={prettyBody}
              theme={postmanTransparentTheme}
              extensions={hasJson ? [json()] : []}
              readOnly={true}
              editable={false}
              className="flex-grow overflow-hidden text-[13px]"
              height="100%"
            />
          ) : (
            <div className="flex-grow flex flex-col items-center justify-center p-8 text-center select-none animate-in fade-in duration-200">
              <FileCheck size={22} className="text-muted-foreground/40 mb-2" />
              <h5 className="text-xs font-semibold text-foreground/85 mb-1">
                No Response Body
              </h5>
              <p className="text-[11px] text-muted-foreground/60 max-w-sm leading-relaxed">
                The server returned status {response?.status} {getStatusText(response?.status || 200, response?.statusText)} with no content in the response body.
              </p>
            </div>
          )}
        </TabsContent>

        {/* RAW BODY */}
        <TabsContent value="raw" className="flex-grow flex flex-col min-h-0 mt-2 focus-visible:outline-none select-text">
          {loading && !response ? (
            <div className="flex-grow flex flex-col gap-2.5 p-3 animate-pulse">
              <div className="h-3 bg-white/[0.04] rounded w-1/2" />
              <div className="h-3 bg-white/[0.04] rounded w-5/6" />
              <div className="h-3 bg-white/[0.04] rounded w-3/4" />
            </div>
          ) : !response ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 select-none text-center animate-in fade-in duration-300">
              <FileText size={22} className="text-muted-foreground/35 mb-2.5" />
              <h4 className="text-xs font-semibold text-foreground/80 mb-1 tracking-tight">
                Click Send to get a response
              </h4>
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground/50">
                <span>Hit</span>
                <span className="font-mono text-foreground/75 font-medium">Ctrl + Enter</span>
                <span>to run</span>
              </div>
            </div>
          ) : (
            <pre className="flex-grow font-mono text-xs text-muted-foreground bg-transparent py-2 overflow-auto leading-relaxed select-text scrollbar-thin">
              <code>{response?.bodyText && response.bodyText.trim().length > 0 ? response.bodyText : <span className="text-muted-foreground/40 italic">No response body content</span>}</code>
            </pre>
          )}
        </TabsContent>

        {/* HEADERS */}
        <TabsContent value="headers" className="flex-grow flex flex-col min-h-0 mt-2 focus-visible:outline-none select-text">
          {loading && !response ? (
            <div className="flex-grow flex flex-col gap-2.5 p-3 animate-pulse">
              <div className="h-3 bg-white/[0.04] rounded w-1/3" />
              <div className="h-3 bg-white/[0.04] rounded w-2/3" />
              <div className="h-3 bg-white/[0.04] rounded w-1/2" />
            </div>
          ) : !response ? (
            <div className="h-full flex flex-col items-center justify-center py-8 text-center select-none animate-in fade-in duration-300">
              <Layers size={22} className="text-muted-foreground/35 mb-2.5" />
              <div className="text-xs text-muted-foreground/50 font-medium">No headers to display yet</div>
            </div>
          ) : (
            <div className="flex-grow overflow-auto py-2 scrollbar-thin">
              {headerCount === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-8 text-center select-none">
                  <Layers size={24} className="text-muted-foreground/30 mb-2" />
                  <div className="text-xs text-muted-foreground font-medium">No headers received</div>
                </div>
              ) : response ? (
                <>
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/[0.06] select-none">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Response Headers ({headerCount})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const formatted = Object.entries(response.headers)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join("\n");
                        navigator.clipboard.writeText(formatted);
                        toast.success("All headers copied to clipboard");
                      }}
                      className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] px-2.5 py-1 rounded transition-all cursor-pointer"
                      title="Copy all headers"
                    >
                      <Copy size={11} />
                      <span>Copy All</span>
                    </button>
                  </div>
                  <table className="w-full text-xs font-mono select-text border-collapse">
                    <thead>
                      <tr className="border-b border-white/[0.06] text-left text-muted-foreground font-sans text-[11px]">
                        <th className="pb-2 font-semibold">Header Name</th>
                        <th className="pb-2 font-semibold pl-4">Value</th>
                        <th className="pb-2 font-semibold text-right w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {Object.entries(response.headers)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([key, value]) => (
                          <tr key={key} className="hover:bg-white/5 transition-colors group">
                            <td className="py-2 pr-4 font-semibold text-sky-400 select-all truncate max-w-xs">{key}</td>
                            <td className="py-2 pl-4 text-foreground/85 select-all break-all">{value}</td>
                            <td className="py-2 pl-2 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(String(value));
                                  toast.success(`Copied ${key}`);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded text-muted-foreground hover:text-foreground transition-all cursor-pointer inline-flex items-center justify-center"
                                title={`Copy value of ${key}`}
                              >
                                <Copy size={11} />
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </>
              ) : null}
            </div>
          )}
        </TabsContent>

        {/* COOKIES */}
        <TabsContent value="cookies" className="flex-grow flex flex-col min-h-0 mt-2 focus-visible:outline-none select-text">
          {loading && !response ? (
            <div className="flex-grow flex flex-col gap-2.5 p-3 animate-pulse">
              <div className="h-3 bg-white/[0.04] rounded w-1/3" />
              <div className="h-3 bg-white/[0.04] rounded w-2/3" />
            </div>
          ) : !response ? (
            <div className="h-full flex flex-col items-center justify-center py-8 text-center select-none animate-in fade-in duration-300">
              <Cookie size={22} className="text-muted-foreground/35 mb-2.5" />
              <div className="text-xs text-muted-foreground/50 font-medium">No cookies to display yet</div>
            </div>
          ) : (
            <div className="flex-grow overflow-auto py-2 scrollbar-thin">
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
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/[0.06]">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Response Cookies ({cookieCount})
                    </span>
                    {onOpenCookies && (
                      <button
                        type="button"
                        onClick={onOpenCookies}
                        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] px-2.5 py-1 rounded transition-all cursor-pointer"
                      >
                        <Cookie size={12} className="text-amber-400" />
                        <span>Manage in Cookie Jar</span>
                      </button>
                    )}
                  </div>
                  <table className="w-full text-xs font-mono select-text border-collapse">
                    <thead>
                      <tr className="border-b border-white/[0.06] text-left text-muted-foreground font-sans text-[11px]">
                        <th className="pb-2 font-semibold">Name</th>
                        <th className="pb-2 font-semibold pl-3">Value</th>
                        <th className="pb-2 font-semibold pl-3">Domain</th>
                        <th className="pb-2 font-semibold pl-3">Path</th>
                        <th className="pb-2 font-semibold pl-3">Expires</th>
                        <th className="pb-2 font-semibold pl-3 text-right">Flags</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
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
      </div>
    </Tabs>
  );
}

