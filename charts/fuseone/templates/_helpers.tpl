{{/*
Expand the name of the chart.
*/}}
{{- define "fuseone.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "fuseone.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "fuseone.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "fuseone.labels" -}}
helm.sh/chart: {{ include "fuseone.chart" . }}
{{ include "fuseone.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: fuseone
{{- end }}

{{/*
Selector labels
*/}}
{{- define "fuseone.selectorLabels" -}}
app.kubernetes.io/name: {{ include "fuseone.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Backend labels
*/}}
{{- define "fuseone.backend.labels" -}}
{{ include "fuseone.labels" . }}
app.kubernetes.io/component: backend
{{- end }}

{{- define "fuseone.backend.selectorLabels" -}}
{{ include "fuseone.selectorLabels" . }}
app.kubernetes.io/component: backend
{{- end }}

{{/*
Frontend labels
*/}}
{{- define "fuseone.frontend.labels" -}}
{{ include "fuseone.labels" . }}
app.kubernetes.io/component: frontend
{{- end }}

{{- define "fuseone.frontend.selectorLabels" -}}
{{ include "fuseone.selectorLabels" . }}
app.kubernetes.io/component: frontend
{{- end }}

{{/*
PostgreSQL labels
*/}}
{{- define "fuseone.postgresql.labels" -}}
{{ include "fuseone.labels" . }}
app.kubernetes.io/component: postgresql
{{- end }}

{{- define "fuseone.postgresql.selectorLabels" -}}
{{ include "fuseone.selectorLabels" . }}
app.kubernetes.io/component: postgresql
{{- end }}

{{/*
ClickHouse Keeper labels
*/}}
{{- define "fuseone.clickhouse.keeper.labels" -}}
{{ include "fuseone.labels" . }}
app.kubernetes.io/component: clickhouse-keeper
{{- end }}

{{- define "fuseone.clickhouse.keeper.selectorLabels" -}}
{{ include "fuseone.selectorLabels" . }}
app.kubernetes.io/component: clickhouse-keeper
{{- end }}

{{/*
PostgreSQL host - internal or external
*/}}
{{- define "fuseone.postgresql.host" -}}
{{- if .Values.postgresql.enabled }}
{{- printf "%s-postgresql" (include "fuseone.fullname" .) }}
{{- else }}
{{- .Values.postgresql.external.host }}
{{- end }}
{{- end }}

{{/*
PostgreSQL port
*/}}
{{- define "fuseone.postgresql.port" -}}
{{- if .Values.postgresql.enabled }}
{{- "5432" }}
{{- else }}
{{- .Values.postgresql.external.port | default "5432" }}
{{- end }}
{{- end }}

{{/*
APISIX Admin URL - auto-detect from sub-chart or use external
*/}}
{{- define "fuseone.apisix.adminURL" -}}
{{- if .Values.apisix.enabled }}
{{- printf "http://%s-apisix-admin:9180" .Release.Name }}
{{- else }}
{{- .Values.backend.config.apisixAdminURL }}
{{- end }}
{{- end }}

{{/*
APISIX Control URL
*/}}
{{- define "fuseone.apisix.controlURL" -}}
{{- if .Values.apisix.enabled }}
{{- printf "http://%s-apisix-control:9090" .Release.Name }}
{{- else }}
{{- .Values.backend.config.apisixControlURL }}
{{- end }}
{{- end }}

{{/*
Backend internal URL
*/}}
{{- define "fuseone.backend.url" -}}
{{- printf "http://%s-backend:%s" (include "fuseone.fullname" .) (.Values.backend.service.port | toString) }}
{{- end }}

{{/*
ClickHouse Keeper headless service name
*/}}
{{- define "fuseone.clickhouse.keeper.headless" -}}
{{- printf "%s-clickhouse-keeper-headless" (include "fuseone.fullname" .) }}
{{- end }}

{{/*
Generate a random JWT secret if not provided
*/}}
{{- define "fuseone.jwtSecret" -}}
{{- if .Values.backend.secrets.jwtSecret }}
{{- .Values.backend.secrets.jwtSecret }}
{{- else }}
{{- randAlphaNum 32 | b64enc }}
{{- end }}
{{- end }}
