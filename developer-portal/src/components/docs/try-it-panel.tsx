"use client";

import { useState } from "react";
import { Play, Loader2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { ParsedEndpoint } from "@/lib/openapi-parser";
import { useAuthStore } from "@/stores/auth-store";

interface TryItResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  duration: number;
}

export function TryItPanel({
  endpoint,
  baseUrl,
}: {
  endpoint: ParsedEndpoint;
  baseUrl: string;
}) {
  const { token } = useAuthStore();

  const [params, setParams] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const p of endpoint.parameters) {
      initial[p.name] = (p.example as string) || "";
    }
    return initial;
  });
  const [body, setBody] = useState(() => {
    const example =
      endpoint.requestBody?.content?.["application/json"]?.example;
    return example ? JSON.stringify(example, null, 2) : "";
  });
  const [apiKey, setApiKey] = useState("");
  const [response, setResponse] = useState<TryItResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const buildUrl = () => {
    let url = baseUrl + endpoint.path;
    // Replace path params
    for (const p of endpoint.parameters.filter((p) => p.in === "path")) {
      url = url.replace(`{${p.name}}`, encodeURIComponent(params[p.name] || `{${p.name}}`));
    }
    // Add query params
    const query = endpoint.parameters
      .filter((p) => p.in === "query" && params[p.name])
      .map((p) => `${encodeURIComponent(p.name)}=${encodeURIComponent(params[p.name])}`)
      .join("&");
    if (query) url += `?${query}`;
    return url;
  };

  const handleSend = async () => {
    setLoading(true);
    setResponse(null);
    const start = performance.now();

    try {
      const url = buildUrl();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // Use provided API key or auth token
      if (apiKey) {
        headers["apikey"] = apiKey;
      } else if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      // Add header params
      for (const p of endpoint.parameters.filter((p) => p.in === "header")) {
        if (params[p.name]) headers[p.name] = params[p.name];
      }

      const res = await fetch(url, {
        method: endpoint.method,
        headers,
        body: ["POST", "PUT", "PATCH"].includes(endpoint.method) && body
          ? body
          : undefined,
      });

      const duration = Math.round(performance.now() - start);
      const text = await res.text();
      const respHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => { respHeaders[k] = v; });

      setResponse({
        status: res.status,
        statusText: res.statusText,
        headers: respHeaders,
        body: text,
        duration,
      });
    } catch (err) {
      const duration = Math.round(performance.now() - start);
      setResponse({
        status: 0,
        statusText: "Network Error",
        headers: {},
        body: String(err),
        duration,
      });
    } finally {
      setLoading(false);
    }
  };

  const copyResponse = () => {
    if (!response) return;
    navigator.clipboard.writeText(response.body);
    setCopied(true);
    toast.success("Response copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const formatBody = (text: string) => {
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  };

  return (
    <div className="space-y-4 rounded-xl border bg-card p-5">
      <h4 className="text-sm font-semibold text-foreground">Try It</h4>

      {/* API Key */}
      <div className="space-y-1.5">
        <Label className="text-xs">API Key (optional)</Label>
        <Input
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={token ? "Using your session token" : "Enter API key"}
          className="h-8 text-xs font-mono"
        />
      </div>

      {/* Parameters */}
      {endpoint.parameters.map((p) => (
        <div key={`${p.in}-${p.name}`} className="space-y-1.5">
          <Label className="text-xs">
            {p.name}{" "}
            <span className="text-muted-foreground">({p.in})</span>
            {p.required && <span className="text-red-500"> *</span>}
          </Label>
          <Input
            value={params[p.name] || ""}
            onChange={(e) =>
              setParams({ ...params, [p.name]: e.target.value })
            }
            placeholder={p.description || p.schema?.type || "value"}
            className="h-8 text-xs font-mono"
          />
        </div>
      ))}

      {/* Request body */}
      {["POST", "PUT", "PATCH"].includes(endpoint.method) && (
        <div className="space-y-1.5">
          <Label className="text-xs">Request Body</Label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            className="w-full rounded-md border bg-muted p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder='{"key": "value"}'
          />
        </div>
      )}

      {/* Send */}
      <Button
        onClick={handleSend}
        disabled={loading}
        className="w-full"
        size="sm"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Sending...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Play className="h-3.5 w-3.5" />
            Send Request
          </span>
        )}
      </Button>

      {/* Response */}
      {response && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={
                  response.status >= 200 && response.status < 300
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                    : response.status >= 400
                      ? "bg-red-500/10 text-red-600 border-red-500/30"
                      : "bg-amber-500/10 text-amber-600 border-amber-500/30"
                }
              >
                {response.status} {response.statusText}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {response.duration}ms
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={copyResponse}>
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
          <pre className="max-h-80 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs">
            {formatBody(response.body)}
          </pre>
        </div>
      )}
    </div>
  );
}
