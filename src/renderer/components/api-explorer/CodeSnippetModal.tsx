import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Check, Code2, Download, Terminal, ArrowRight } from "lucide-react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { postmanTheme } from "./codemirrorTheme";
import { toast } from "sonner";
import {
  RequestSnippetParams,
  generateCurlCommand,
  generateFetchCode,
  generateAxiosCode,
  generatePythonCode,
  parseCurlCommand,
} from "../../lib/curlUtils";

interface CodeSnippetModalProps {
  isOpen: boolean;
  onClose: () => void;
  requestParams: RequestSnippetParams;
  onImportCurl?: (parsed: Partial<RequestSnippetParams>) => void;
  defaultMode?: "export" | "import";
}

export function CodeSnippetModal({
  isOpen,
  onClose,
  requestParams,
  onImportCurl,
  defaultMode = "export",
}: CodeSnippetModalProps) {
  const [activeTab, setActiveTab] = useState<string>("curl");
  const [copied, setCopied] = useState(false);
  const [importCurlText, setImportCurlText] = useState("");

  const curlCode = useMemo(() => generateCurlCommand(requestParams), [requestParams]);
  const fetchCode = useMemo(() => generateFetchCode(requestParams), [requestParams]);
  const axiosCode = useMemo(() => generateAxiosCode(requestParams), [requestParams]);
  const pythonCode = useMemo(() => generatePythonCode(requestParams), [requestParams]);

  const activeSnippet = useMemo(() => {
    switch (activeTab) {
      case "curl":
        return curlCode;
      case "fetch":
        return fetchCode;
      case "axios":
        return axiosCode;
      case "python":
        return pythonCode;
      default:
        return curlCode;
    }
  }, [activeTab, curlCode, fetchCode, axiosCode, pythonCode]);

  const handleCopy = () => {
    navigator.clipboard.writeText(activeSnippet);
    setCopied(true);
    toast.success("Code snippet copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImport = () => {
    const trimmed = importCurlText.trim();
    if (!trimmed) {
      toast.error("Please paste a valid cURL command");
      return;
    }

    const parsed = parseCurlCommand(trimmed);
    if (!parsed || !parsed.url) {
      toast.error("Could not parse cURL command. Ensure it starts with 'curl'");
      return;
    }

    if (onImportCurl) {
      onImportCurl(parsed);
      toast.success(`Imported ${parsed.method || "GET"} ${parsed.url}`);
      setImportCurlText("");
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] h-[560px] flex flex-col p-0 overflow-hidden bg-[hsl(240,6%,10%)] border-border/70 select-none">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border/40 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <Code2 size={18} />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground tracking-tight">
                  Code Snippet
                </DialogTitle>
                <p className="text-xs text-muted-foreground">
                  Generate client code or import an existing cURL command into your active tab.
                </p>
              </div>
            </div>

            {activeTab !== "import" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="h-8 gap-1.5 text-xs font-semibold border-border/60 hover:bg-secondary/40"
              >
                {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                <span>{copied ? "Copied" : "Copy Snippet"}</span>
              </Button>
            )}
          </div>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col min-h-0"
        >
          <div className="px-6 border-b border-border/40 bg-card/10 shrink-0">
            <TabsList className="bg-transparent h-10 p-0 gap-6">
              <TabsTrigger
                value="curl"
                className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 py-2 font-semibold text-muted-foreground data-[state=active]:text-foreground transition-all"
              >
                cURL
              </TabsTrigger>
              <TabsTrigger
                value="fetch"
                className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 py-2 font-semibold text-muted-foreground data-[state=active]:text-foreground transition-all"
              >
                Fetch (JS)
              </TabsTrigger>
              <TabsTrigger
                value="axios"
                className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 py-2 font-semibold text-muted-foreground data-[state=active]:text-foreground transition-all"
              >
                Axios
              </TabsTrigger>
              <TabsTrigger
                value="python"
                className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 py-2 font-semibold text-muted-foreground data-[state=active]:text-foreground transition-all"
              >
                Python
              </TabsTrigger>
              {onImportCurl && (
                <TabsTrigger
                  value="import"
                  className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 py-2 font-semibold text-muted-foreground data-[state=active]:text-foreground transition-all flex items-center gap-1.5 ml-auto"
                >
                  <Download size={12} />
                  Import cURL
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          {activeTab !== "import" ? (
            <div className="flex-1 overflow-hidden p-4">
              <div className="h-full border border-border/60 rounded-lg overflow-hidden bg-background/50">
                <CodeMirror
                  value={activeSnippet}
                  height="100%"
                  theme={postmanTheme}
                  extensions={[javascript()]}
                  readOnly={true}
                  editable={false}
                  className="text-xs font-mono h-full"
                />
              </div>
            </div>
          ) : (
            <TabsContent value="import" className="flex-1 flex flex-col min-h-0 p-4 gap-3 m-0">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Terminal size={14} className="text-primary" />
                <span>Paste a cURL command copied from browser DevTools, terminal, or documentation:</span>
              </div>
              <Textarea
                value={importCurlText}
                onChange={(e) => setImportCurlText(e.target.value)}
                placeholder={`curl --location 'https://api.example.com/users' \\\n  --header 'Authorization: Bearer mytoken' \\\n  --header 'Content-Type: application/json' \\\n  --data '{"name": "John"}'`}
                className="flex-1 font-mono text-xs bg-background/60 border-border/70 p-3 resize-none focus-visible:ring-primary/40 leading-relaxed"
              />
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
                  Cancel
                </Button>
                <Button size="sm" onClick={handleImport} className="text-xs gap-1.5">
                  <span>Import Request</span>
                  <ArrowRight size={13} />
                </Button>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
