import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertCircle, Terminal, Loader2 } from "lucide-react";
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

export function ResponsePanel({ response, loading = false, tabId, lastCompletedAt }: ResponsePanelProps) {
  const [blink, setBlink] = useState<"success" | "error" | null>(null);
  const [blinkTrigger, setBlinkTrigger] = useState(0);
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

  const isError = response ? (response.status >= 400 || !response.ok) : false;
  const timeLabel = (response && !loading) ? (response.timeMs ? `${response.timeMs} ms` : null) : null;
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

  // Format headers counts
  const headerCount = response ? Object.keys(response.headers || {}).length : 0;
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

        {/* Status Indicators */}
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
              {response.status || "000"} {response.statusText || "Network Request"}
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
            {(hasJson || (loading && !response)) && (
              <TabsTrigger
                value="raw"
                className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 py-1 h-full font-medium"
              >
                Raw Output
              </TabsTrigger>
            )}
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
                editable={true}
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
        </Tabs>
      </div>
    </div>
  );
}

