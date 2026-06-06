import { useEffect, useMemo, useState } from "react";
import apiClient from "@/lib/apiClient";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Loader2, PlayCircle, Plus, Trash2, Sparkles } from "lucide-react";
import {
  ApiAuth,
  ApiBody,
  ApiHttpRequest,
  ApiHttpResponse,
  ApiKeyValueRow,
  ApiRoute,
  Method,
} from "../../../types";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type RequestPanelProps = {
  route: ApiRoute;
  baseUrl: string;
  draftKey: string;
  onRun: (response: ApiHttpResponse) => void;
};

const REQUEST_DRAFT_PREFIX = "devdash.apiExplorer.requestDraft.v1";

const newRow = (): ApiKeyValueRow => ({
  id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
  enabled: true,
  key: "",
  value: "",
});

const defaultAuth: ApiAuth = { type: "none" };

const safeParseJson = (
  text: string,
): { ok: true; value: any } | { ok: false } => {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
};

export function RequestPanel({
  route,
  baseUrl,
  draftKey,
  onRun,
}: RequestPanelProps) {
  const defaultMethod = (
    route.method === "ALL" ? "GET" : route.method
  ) as Method;

  const [method, setMethod] = useState<Method>(defaultMethod);
  const [url, setUrl] = useState(route.path);
  const [loading, setLoading] = useState(false);

  const [params, setParams] = useState<ApiKeyValueRow[]>([]);
  const [pathParams, setPathParams] = useState<Record<string, string>>({});
  const [headers, setHeaders] = useState<ApiKeyValueRow[]>([]);
  const [auth, setAuth] = useState<ApiAuth>(defaultAuth);
  const [bodyMode, setBodyMode] = useState<ApiBody["mode"]>("json");
  const [bodyText, setBodyText] = useState("{\n\n}");
  const [formFields, setFormFields] = useState<ApiKeyValueRow[]>([]);
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [tab, setTab] = useState("params");

  const draftStorageKey = useMemo(() => {
    return `${REQUEST_DRAFT_PREFIX}:${draftKey}`;
  }, [draftKey]);

  // Load draft or initialize defaults when route changes
  useEffect(() => {
    const base = String(baseUrl || "")
      .trim()
      .replace(/\/+$/, "");
    const defaultUrl = `${base}${route.path}`;

    setBodyError(null);

    // Extract path parameter list
    const extractedPathParams = Array.isArray(route.pathParams)
      ? route.pathParams
      : route.path
          .split("/")
          .filter((s) => s.startsWith(":"))
          .map((s) => s.slice(1).replace(/[\?\*\+]/g, ""));

    const initialPathParams: Record<string, string> = {};
    for (const key of extractedPathParams) {
      initialPathParams[key] = "";
    }

    try {
      if (typeof window === "undefined") throw new Error("no window");
      const raw = window.localStorage.getItem(draftStorageKey);
      if (!raw) throw new Error("no draft");
      const parsed = JSON.parse(raw);

      setMethod((parsed.method as Method) || defaultMethod);
      setUrl(String(parsed.url || defaultUrl));

      // Resolve query parameters (params) - override if empty and we have newly scanned fields
      let loadedParams = Array.isArray(parsed.params) ? parsed.params : [];
      const hasNoValidParams = loadedParams.length === 0 || loadedParams.every((p: any) => !p.key);
      if (hasNoValidParams && Array.isArray(route.inferredQueryFields) && route.inferredQueryFields.length > 0) {
        loadedParams = route.inferredQueryFields.map((field) => ({
          id: `${Date.now()}_query_${field}_${Math.random().toString(36).slice(2)}`,
          enabled: true,
          key: field,
          value: "",
        }));
      }
      setParams(loadedParams);

      setPathParams(
        parsed.pathParams && typeof parsed.pathParams === "object"
          ? { ...initialPathParams, ...parsed.pathParams }
          : initialPathParams
      );
      setHeaders(Array.isArray(parsed.headers) ? parsed.headers : []);
      setAuth(parsed.auth || defaultAuth);
      setBodyMode((parsed.bodyMode as ApiBody["mode"]) || "json");

      // Resolve bodyText - override if empty/default and we have newly scanned fields
      let loadedBodyText = String(parsed.bodyText ?? "{\n\n}");
      const isBodyEmpty = (() => {
        const trimmed = loadedBodyText.trim();
        if (!trimmed || trimmed === "{}" || trimmed === "{\n\n}" || trimmed === "{\n  \n}") {
          return true;
        }
        try {
          const parsedJson = JSON.parse(trimmed);
          return typeof parsedJson === "object" && parsedJson !== null && Object.keys(parsedJson).length === 0;
        } catch {
          return false;
        }
      })();

      if (isBodyEmpty && Array.isArray(route.inferredBodyFields) && route.inferredBodyFields.length > 0) {
        const template: Record<string, string> = {};
        for (const field of route.inferredBodyFields) {
          template[field] = "";
        }
        loadedBodyText = JSON.stringify(template, null, 2);
      }
      setBodyText(loadedBodyText);

      setFormFields(Array.isArray(parsed.formFields) ? parsed.formFields : []);
      return;
    } catch {
      // fall back to defaults
    }

    setMethod(defaultMethod);
    setUrl(defaultUrl);

    // Pre-fill inferred query fields
    const defaultQueryParams = Array.isArray(route.inferredQueryFields)
      ? route.inferredQueryFields.map((field) => ({
          id: `${Date.now()}_query_${field}_${Math.random().toString(36).slice(2)}`,
          enabled: true,
          key: field,
          value: "",
        }))
      : [];
    setParams(defaultQueryParams);

    setPathParams(initialPathParams);
    setHeaders([]);
    setAuth(defaultAuth);
    setBodyMode(defaultMethod === "GET" || defaultMethod === "HEAD" ? "none" : "json");

    // Pre-fill inferred body JSON fields
    if (Array.isArray(route.inferredBodyFields) && route.inferredBodyFields.length > 0) {
      const template: Record<string, string> = {};
      for (const field of route.inferredBodyFields) {
        template[field] = "";
      }
      setBodyText(JSON.stringify(template, null, 2));
    } else {
      setBodyText("{\n\n}");
    }

    setFormFields([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.path, route.method, route.pathParams, route.inferredQueryFields, route.inferredBodyFields, baseUrl, draftStorageKey]);

  // Persist draft so leaving the view keeps request setup
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const payload = JSON.stringify({
        method,
        url,
        params,
        pathParams,
        headers,
        auth,
        bodyMode,
        bodyText,
        formFields,
      });
      window.localStorage.setItem(draftStorageKey, payload);
    } catch {
      // ignore
    }
  }, [
    method,
    url,
    params,
    pathParams,
    headers,
    auth,
    bodyMode,
    bodyText,
    formFields,
    draftStorageKey,
  ]);

  const requestBody: ApiBody = useMemo(() => {
    if (method === "GET" || method === "HEAD") return { mode: "none" };
    if (bodyMode === "none") return { mode: "none" };
    if (bodyMode === "json") return { mode: "json", text: bodyText };
    if (bodyMode === "text") return { mode: "text", text: bodyText };
    if (bodyMode === "form") return { mode: "form", fields: formFields };
    return { mode: "none" };
  }, [bodyMode, bodyText, formFields, method]);

  const handleBeautifyJson = () => {
    if (bodyMode !== "json") return;
    const raw = String(bodyText ?? "");
    if (!raw.trim()) {
      setBodyError(null);
      return;
    }
    const parsed = safeParseJson(raw);
    if (!parsed.ok) {
      setBodyError("Invalid JSON");
      return;
    }
    setBodyError(null);
    setBodyText(JSON.stringify(parsed.value, null, 2));
  };

  const handleSend = async () => {
    setLoading(true);

    try {
      if (bodyMode === "json" && method !== "GET" && method !== "HEAD") {
        const raw = String(bodyText ?? "");
        if (raw.trim() && !safeParseJson(raw).ok) {
          setBodyError("Invalid JSON");
          setLoading(false);
          return;
        }
        setBodyError(null);
      }

      // Substitute path parameters into the URL string
      let finalUrl = url;
      for (const key of Object.keys(pathParams)) {
        finalUrl = finalUrl.replace(`:${key}`, encodeURIComponent(pathParams[key]));
      }

      const req: ApiHttpRequest = {
        method,
        url: finalUrl,
        query: params,
        headers,
        auth,
        body: requestBody,
        timeoutMs: 30_000,
      };

      const res = await apiClient.runApiRequest(req);
      onRun(res);
    } catch (err: any) {
      onRun({
        ok: false,
        status: 0,
        statusText: "Network Error",
        timeMs: 0,
        sizeBytes: 0,
        headers: {},
        bodyText: "",
        error: String(err?.message || err),
      });
    } finally {
      setLoading(false);
    }
  };

  const methodColors: Record<string, string> = {
    GET: "bg-blue-500/20 text-blue-400",
    POST: "bg-green-500/20 text-green-400",
    PUT: "bg-orange-500/20 text-orange-400",
    PATCH: "bg-purple-500/20 text-purple-400",
    DELETE: "bg-red-500/20 text-red-400",
  };

  const renderKeyValueRows = (
    rows: ApiKeyValueRow[],
    setRows: (next: ApiKeyValueRow[]) => void,
  ) => {
    return (
      <div className="space-y-2">
        {rows.length === 0 ? (
          <div className="text-xs text-gray-500">No items.</div>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="flex items-center gap-2">
              <Checkbox
                checked={row.enabled}
                onCheckedChange={(v) => {
                  setRows(
                    rows.map((r) =>
                      r.id === row.id ? { ...r, enabled: v === true } : r,
                    ),
                  );
                }}
              />
              <Input
                value={row.key}
                onChange={(e) =>
                  setRows(
                    rows.map((r) =>
                      r.id === row.id ? { ...r, key: e.target.value } : r,
                    ),
                  )
                }
                placeholder="Key"
                className="h-8 bg-black border-white/10 text-xs text-gray-300"
              />
              <Input
                value={row.value}
                onChange={(e) =>
                  setRows(
                    rows.map((r) =>
                      r.id === row.id ? { ...r, value: e.target.value } : r,
                    ),
                  )
                }
                placeholder="Value"
                className="h-8 bg-black border-white/10 text-xs text-gray-300"
              />
              <button
                className="text-gray-500 hover:text-white"
                title="Remove"
                onClick={() => setRows(rows.filter((r) => r.id !== row.id))}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}

        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="bg-white/10 hover:bg-white/20 text-white border-transparent"
          onClick={() => setRows([...rows, newRow()])}
        >
          <Plus size={14} className="mr-2" /> Add
        </Button>
      </div>
    );
  };

  return (
    <div className="bg-[#0f0f0f] rounded-xl border border-white/10 p-4 shrink-0 flex flex-col">
      {route.description && (
        <div className="mb-4 bg-black/40 border border-white/5 rounded-lg p-3 text-xs text-gray-300 whitespace-pre-wrap leading-relaxed font-sans max-h-40 overflow-y-auto">
          {route.description}
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <Select value={method} onValueChange={(v) => setMethod(v as Method)}>
          <SelectTrigger
            className={cn(
              "w-[90px] h-[34px] border-none font-bold text-xs rounded px-2",
              methodColors[method] || "bg-gray-500/20 text-gray-400",
            )}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#1A1A1A] border-white/10 text-white">
            <SelectItem value="GET" className="text-blue-400 font-medium">
              GET
            </SelectItem>
            <SelectItem value="POST" className="text-green-400 font-medium">
              POST
            </SelectItem>
            <SelectItem value="PUT" className="text-orange-400 font-medium">
              PUT
            </SelectItem>
            <SelectItem value="PATCH" className="text-purple-400 font-medium">
              PATCH
            </SelectItem>
            <SelectItem value="DELETE" className="text-red-400 font-medium">
              DELETE
            </SelectItem>
          </SelectContent>
        </Select>

        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1 bg-black rounded p-2 text-sm font-mono text-gray-300 border border-white/5 h-[34px]"
        />

        <button
          onClick={handleSend}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-500 text-white px-6 h-[34px] rounded font-semibold text-sm flex items-center justify-center gap-2 transition-colors min-w-[100px]"
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <PlayCircle size={16} />
          )}
          Send
        </button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-black/30 border border-white/10">
          <TabsTrigger value="params" className="text-xs">
            Params
          </TabsTrigger>
          <TabsTrigger value="headers" className="text-xs">
            Headers
          </TabsTrigger>
          <TabsTrigger value="auth" className="text-xs">
            Auth
          </TabsTrigger>
          <TabsTrigger value="body" className="text-xs">
            Body
          </TabsTrigger>
        </TabsList>

        <TabsContent value="params" className="space-y-4">
          {Object.keys(pathParams).length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-500 mb-2 tracking-wider">
                PATH PARAMETERS
              </div>
              <div className="space-y-2">
                {Object.keys(pathParams).map((key) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-xs font-mono text-blue-400 w-32 shrink-0">
                      :{key}
                    </span>
                    <Input
                      value={pathParams[key]}
                      onChange={(e) =>
                        setPathParams((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                      placeholder="Value"
                      className="h-8 bg-black border-white/10 text-xs text-gray-300 flex-1"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="text-xs font-semibold text-gray-500 mb-2 tracking-wider">
              QUERY PARAMETERS
            </div>
            {renderKeyValueRows(params, setParams)}
          </div>
        </TabsContent>

        <TabsContent value="headers">
          <div className="text-sm text-gray-400 mb-2 border-b border-white/5 pb-2">
            Headers
          </div>
          {renderKeyValueRows(headers, setHeaders)}
        </TabsContent>

        <TabsContent value="auth">
          <div className="text-sm text-gray-400 mb-2 border-b border-white/5 pb-2">
            Authorization
          </div>

          <div className="space-y-3">
            <Select
              value={auth.type}
              onValueChange={(v) => {
                if (v === "none") setAuth({ type: "none" });
                if (v === "bearer") setAuth({ type: "bearer", token: "" });
                if (v === "basic")
                  setAuth({ type: "basic", username: "", password: "" });
                if (v === "apiKey")
                  setAuth({ type: "apiKey", key: "", value: "", in: "header" });
              }}
            >
              <SelectTrigger className="h-8 bg-black border-white/10 text-xs text-gray-300 w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1A1A1A] border-white/10 text-white">
                <SelectItem value="none">No Auth</SelectItem>
                <SelectItem value="bearer">Bearer Token</SelectItem>
                <SelectItem value="basic">Basic Auth</SelectItem>
                <SelectItem value="apiKey">API Key</SelectItem>
              </SelectContent>
            </Select>

            {auth.type === "bearer" && (
              <Input
                value={auth.token}
                onChange={(e) => setAuth({ ...auth, token: e.target.value })}
                placeholder="Token"
                className="h-8 bg-black border-white/10 text-xs text-gray-300"
              />
            )}

            {auth.type === "basic" && (
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={auth.username}
                  onChange={(e) =>
                    setAuth({ ...auth, username: e.target.value })
                  }
                  placeholder="Username"
                  className="h-8 bg-black border-white/10 text-xs text-gray-300"
                />
                <Input
                  value={auth.password}
                  onChange={(e) =>
                    setAuth({ ...auth, password: e.target.value })
                  }
                  placeholder="Password"
                  type="password"
                  className="h-8 bg-black border-white/10 text-xs text-gray-300"
                />
              </div>
            )}

            {auth.type === "apiKey" && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={auth.key}
                    onChange={(e) => setAuth({ ...auth, key: e.target.value })}
                    placeholder="Key"
                    className="h-8 bg-black border-white/10 text-xs text-gray-300"
                  />
                  <Input
                    value={auth.value}
                    onChange={(e) =>
                      setAuth({ ...auth, value: e.target.value })
                    }
                    placeholder="Value"
                    className="h-8 bg-black border-white/10 text-xs text-gray-300"
                  />
                </div>
                <Select
                  value={auth.in}
                  onValueChange={(v) => setAuth({ ...auth, in: v as any })}
                >
                  <SelectTrigger className="h-8 bg-black border-white/10 text-xs text-gray-300 w-[220px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1A1A1A] border-white/10 text-white">
                    <SelectItem value="header">Add to Header</SelectItem>
                    <SelectItem value="query">Add to Query</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="body">
          <div className="flex items-center justify-between mb-2 border-b border-white/5 pb-2">
            <div className="text-sm text-gray-400">Body</div>
            <div className="flex items-center gap-2">
              <Select
                value={bodyMode}
                onValueChange={(v) => setBodyMode(v as any)}
              >
                <SelectTrigger className="h-8 bg-black border-white/10 text-xs text-gray-300 w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1A1A1A] border-white/10 text-white">
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="text">Raw Text</SelectItem>
                  <SelectItem value="form">x-www-form-urlencoded</SelectItem>
                </SelectContent>
              </Select>

              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="bg-white/10 hover:bg-white/20 text-white border-transparent"
                onClick={handleBeautifyJson}
                disabled={bodyMode !== "json"}
                title="Beautify JSON"
              >
                <Sparkles size={14} className="mr-2" /> Beautify
              </Button>
            </div>
          </div>

          {method === "GET" || method === "HEAD" ? (
            <div className="text-xs text-gray-500">
              GET/HEAD requests do not send a body.
            </div>
          ) : bodyMode === "form" ? (
            renderKeyValueRows(formFields, setFormFields)
          ) : bodyMode === "none" ? (
            <div className="text-xs text-gray-500">No request body.</div>
          ) : (
            <div className="space-y-2">
              <Textarea
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                spellCheck={false}
                className={cn(
                  "w-full h-40 bg-black p-3 rounded border border-white/5 font-mono text-xs text-green-300 resize-none",
                  bodyError ? "border-red-500/40" : "",
                )}
              />
              {bodyError && (
                <div className="text-xs text-red-400">{bodyError}</div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
