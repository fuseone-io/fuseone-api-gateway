"use client"

import { useEffect, useState, useMemo } from "react"
import { toast } from "sonner"
import { Puzzle, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api-client"

const PLUGIN_DESCRIPTIONS: Record<string, string> = {
  "limit-req": "Limit request rate using the leaky bucket algorithm",
  "limit-count": "Limit request count over a time window",
  "limit-conn": "Limit the number of concurrent connections",
  "key-auth": "Authenticate requests with API keys",
  "basic-auth": "HTTP Basic authentication",
  "jwt-auth": "JWT-based authentication",
  "hmac-auth": "HMAC-based authentication",
  "authz-keycloak": "Authorization with Keycloak",
  "authz-casbin": "Authorization with Casbin",
  "wolf-rbac": "Role-based access control with Wolf",
  "openid-connect": "OpenID Connect authentication",
  "cors": "Cross-origin resource sharing",
  "ip-restriction": "Restrict access by IP address",
  "ua-restriction": "Restrict access by User-Agent",
  "referer-restriction": "Restrict access by Referer header",
  "consumer-restriction": "Restrict access by consumer",
  "csrf": "Cross-site request forgery protection",
  "uri-blocker": "Block requests by URI pattern",
  "request-id": "Add unique ID to each request",
  "proxy-rewrite": "Rewrite upstream request",
  "grpc-transcode": "Transcode between HTTP and gRPC",
  "grpc-web": "Support gRPC-Web protocol",
  "fault-injection": "Inject faults for testing",
  "traffic-split": "Split traffic between upstreams",
  "redirect": "HTTP redirect",
  "echo": "Echo request back as response",
  "serverless-pre-function": "Run serverless functions before proxying",
  "serverless-post-function": "Run serverless functions after proxying",
  "batch-requests": "Batch multiple requests into one",
  "proxy-cache": "Cache proxy responses",
  "proxy-mirror": "Mirror traffic to another upstream",
  "response-rewrite": "Rewrite downstream response",
  "zipkin": "Distributed tracing with Zipkin",
  "skywalking": "Distributed tracing with SkyWalking",
  "opentelemetry": "Distributed tracing with OpenTelemetry",
  "prometheus": "Expose metrics for Prometheus",
  "datadog": "Send metrics to Datadog",
  "node-status": "Expose node status information",
  "http-logger": "Log requests to HTTP endpoint",
  "tcp-logger": "Log requests to TCP endpoint",
  "udp-logger": "Log requests to UDP endpoint",
  "kafka-logger": "Log requests to Apache Kafka",
  "rocketmq-logger": "Log requests to RocketMQ",
  "syslog": "Log requests to syslog",
  "file-logger": "Log requests to file",
  "sls-logger": "Log requests to Alibaba Cloud SLS",
  "google-cloud-logging": "Log requests to Google Cloud Logging",
  "loggly": "Log requests to Loggly",
  "splunk-hec-logging": "Log requests to Splunk HEC",
  "elasticsearch-logger": "Log requests to Elasticsearch",
  "clickhouse-logger": "Log requests to ClickHouse",
  "real-ip": "Dynamically determine client real IP",
  "ext-plugin-pre-req": "External plugin before request",
  "ext-plugin-post-req": "External plugin after request",
  "ext-plugin-post-resp": "External plugin after response",
  "gzip": "Compress responses with gzip",
  "api-breaker": "Circuit breaker for upstream protection",
  "mocking": "Mock API responses",
  "client-control": "Control client request behavior",
  "proxy-control": "Control proxy behavior",
  "workflow": "Complex condition-based workflow",
}

export default function PluginsPage() {
  const [plugins, setPlugins] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    api
      .listPlugins()
      .then((data) => {
        if (Array.isArray(data)) {
          setPlugins(data as string[])
        } else {
          setPlugins([])
        }
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (!search) return plugins
    const q = search.toLowerCase()
    return plugins.filter(
      (name) =>
        name.toLowerCase().includes(q) ||
        (PLUGIN_DESCRIPTIONS[name] || "").toLowerCase().includes(q)
    )
  }, [plugins, search])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Plugins</h1>
          <p className="text-muted-foreground">
            Browse available APISIX plugins
          </p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search plugins..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32 mb-2" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <Puzzle className="h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground">
            {search ? "No plugins match your search" : "No plugins available"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((name) => (
            <Card key={name} className="hover:border-primary/50 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Puzzle className="h-4 w-4" />
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-sm font-medium">
                      {name}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {PLUGIN_DESCRIPTIONS[name] || "APISIX plugin"}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
