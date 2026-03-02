{{/*
Generate the initial-cluster string: etcd-0=scheme://etcd-0.svc:2380,etcd-1=...
*/}}
{{- define "etcd.initialCluster" -}}
{{- $name := .Release.Name -}}
{{- $replicas := int .Values.replicaCount -}}
{{- $members := list -}}
{{- range $i := until $replicas -}}
{{- $members = append $members (printf "%s-%d=$(URI_SCHEME)://%s-%d.%s:2380" $name $i $name $i $name) -}}
{{- end -}}
{{- join "," $members -}}
{{- end -}}
