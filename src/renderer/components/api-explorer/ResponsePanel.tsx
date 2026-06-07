import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiHttpResponse } from "../../../types";

type ResponsePanelProps = {
  response: ApiHttpResponse | null;
};

export function ResponsePanel({ response }: ResponsePanelProps) {
  if (!response) {
    return (
      <div className="flex-1 bg-[#0f0f0f] rounded-xl border border-white/10 p-4 flex flex-col min-h-[200px]">
        <div className="text-sm font-medium text-gray-300 mb-4 flex justify-between items-center">
          <span>Response</span>
        </div>
        <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
          Hit Send to test endpoint.
        </div>
      </div>
    );
  }

  const isError = response.status >= 400 || !response.ok;
  const timeLabel = `${response.timeMs}ms`;
  const sizeLabel = `${response.sizeBytes}B`;

  const hasJson = response.parsedJson !== undefined;
  const prettyBody = hasJson
    ? JSON.stringify(response.parsedJson, null, 2)
    : response.bodyText;

  return (
    <div className="flex-1 bg-[#0f0f0f] rounded-xl border border-white/10 p-4 flex flex-col min-h-[200px] animate-in fade-in duration-200">
      {/* RESPONSE HEADER */}
      <div className="text-sm font-medium text-gray-300 mb-4 flex justify-between items-center">
        <span>Response</span>
        <div className="flex gap-3 text-xs">
          <span
            className={cn(
              "flex items-center gap-1",
              isError ? "text-red-400" : "text-green-400",
            )}
          >
            {isError ? <XCircle size={12} /> : <CheckCircle2 size={12} />}
            {response.status} {response.statusText}
          </span>
          <span className="text-gray-500">{timeLabel}</span>
          <span className="text-gray-500">{sizeLabel}</span>
        </div>
      </div>

      {response.error && (
        <div className="mb-3 text-xs text-red-400 font-mono bg-black/40 border border-red-500/20 rounded p-2">
          {response.error}
        </div>
      )}

      <Tabs defaultValue="body">
        <TabsList className="bg-black/30 border border-white/10">
          <TabsTrigger value="body" className="text-xs">
            Body
          </TabsTrigger>
          <TabsTrigger value="headers" className="text-xs">
            Headers
          </TabsTrigger>
          {hasJson && (
            <TabsTrigger value="raw" className="text-xs">
              Raw
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="body" className="mt-3">
          <pre className="flex-1 font-mono text-xs text-blue-300 bg-black p-4 rounded border border-white/5 overflow-auto whitespace-pre-wrap">
            {prettyBody || ""}
          </pre>
        </TabsContent>

        <TabsContent value="raw" className="mt-3">
          <pre className="flex-1 font-mono text-xs text-blue-300 bg-black p-4 rounded border border-white/5 overflow-auto whitespace-pre-wrap">
            {response.bodyText || ""}
          </pre>
        </TabsContent>

        <TabsContent value="headers" className="mt-3">
          <div className="bg-black rounded border border-white/5 overflow-auto">
            <pre className="font-mono text-xs text-gray-300 p-4 whitespace-pre-wrap">
              {Object.keys(response.headers || {}).length === 0
                ? "(no headers)"
                : Object.entries(response.headers)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([k, v]) => `${k}: ${v}`)
                    .join("\n")}
            </pre>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
