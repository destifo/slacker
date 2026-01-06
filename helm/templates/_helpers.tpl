{{/*
Expand the name of the chart.
*/}}
{{- define "slacker.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "slacker.fullname" -}}
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
{{- define "slacker.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "slacker.labels" -}}
helm.sh/chart: {{ include "slacker.chart" . }}
{{ include "slacker.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "slacker.selectorLabels" -}}
app.kubernetes.io/name: {{ include "slacker.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "slacker.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "slacker.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Database URL
*/}}
{{- define "slacker.databaseUrl" -}}
{{- if .Values.database.external }}
{{- .Values.database.url }}
{{- else }}
{{- printf "postgres://%s:%s@%s-postgresql:5432/%s" .Values.database.postgresql.auth.username .Values.database.postgresql.auth.password (include "slacker.fullname" .) .Values.database.postgresql.auth.database }}
{{- end }}
{{- end }}
