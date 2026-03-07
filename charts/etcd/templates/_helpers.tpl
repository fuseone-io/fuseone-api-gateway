{{/*
Expand the name of the chart.
*/}}
{{- define "etcd.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
Standalone install:  helm install etcd ./charts/etcd  → service "etcd"
Sub-chart install:   helm install fuseone ./charts/fuseone → service "fuseone-etcd"
*/}}
{{- define "etcd.fullname" -}}
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
Generate the initial-cluster string for etcd peers.
  etcd-0=scheme://etcd-0.SERVICE:2380,etcd-1=...
*/}}
{{- define "etcd.initialCluster" -}}
{{- $name := include "etcd.fullname" . -}}
{{- $replicas := int .Values.replicaCount -}}
{{- $members := list -}}
{{- range $i := until $replicas -}}
{{- $members = append $members (printf "%s-%d=$(URI_SCHEME)://%s-%d.%s:2380" $name $i $name $i $name) -}}
{{- end -}}
{{- join "," $members -}}
{{- end -}}
