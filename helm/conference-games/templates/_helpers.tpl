{{/*
Expand the name of the chart.
*/}}
{{- define "conference-games.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "conference-games.fullname" -}}
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
{{- define "conference-games.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "conference-games.labels" -}}
helm.sh/chart: {{ include "conference-games.chart" . }}
{{ include "conference-games.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "conference-games.selectorLabels" -}}
app.kubernetes.io/name: {{ include "conference-games.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Frontend labels
*/}}
{{- define "conference-games.frontend.labels" -}}
{{ include "conference-games.labels" . }}
app.kubernetes.io/component: frontend
{{- end }}

{{/*
Frontend selector labels
*/}}
{{- define "conference-games.frontend.selectorLabels" -}}
{{ include "conference-games.selectorLabels" . }}
app.kubernetes.io/component: frontend
{{- end }}

{{/*
Backend labels
*/}}
{{- define "conference-games.backend.labels" -}}
{{ include "conference-games.labels" . }}
app.kubernetes.io/component: backend
{{- end }}

{{/*
Backend selector labels
*/}}
{{- define "conference-games.backend.selectorLabels" -}}
{{ include "conference-games.selectorLabels" . }}
app.kubernetes.io/component: backend
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "conference-games.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "conference-games.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Frontend image name
*/}}
{{- define "conference-games.frontend.image" -}}
{{- $registry := .Values.global.imageRegistry | default "" }}
{{- $repository := .Values.frontend.image.repository }}
{{- $tag := .Values.frontend.image.tag | default .Chart.AppVersion }}
{{- if $registry }}
{{- printf "%s/%s:%s" $registry $repository $tag }}
{{- else }}
{{- printf "%s:%s" $repository $tag }}
{{- end }}
{{- end }}

{{/*
Backend image name
*/}}
{{- define "conference-games.backend.image" -}}
{{- $registry := .Values.global.imageRegistry | default "" }}
{{- $repository := .Values.backend.image.repository }}
{{- $tag := .Values.backend.image.tag | default .Chart.AppVersion }}
{{- if $registry }}
{{- printf "%s/%s:%s" $registry $repository $tag }}
{{- else }}
{{- printf "%s:%s" $repository $tag }}
{{- end }}
{{- end }}

{{/*
Database connection string
*/}}
{{- define "conference-games.database.host" -}}
{{- if .Values.postgresql.enabled }}
{{- printf "%s-postgresql" (include "conference-games.fullname" .) }}
{{- else }}
{{- .Values.externalDatabase.host }}
{{- end }}
{{- end }}

{{/*
Database port
*/}}
{{- define "conference-games.database.port" -}}
{{- if .Values.postgresql.enabled }}
{{- 5432 }}
{{- else }}
{{- .Values.externalDatabase.port }}
{{- end }}
{{- end }}

{{/*
Database name
*/}}
{{- define "conference-games.database.name" -}}
{{- if .Values.postgresql.enabled }}
{{- .Values.postgresql.auth.database }}
{{- else }}
{{- .Values.externalDatabase.database }}
{{- end }}
{{- end }}

{{/*
Database username
*/}}
{{- define "conference-games.database.username" -}}
{{- if .Values.postgresql.enabled }}
{{- "postgres" }}
{{- else }}
{{- .Values.externalDatabase.username }}
{{- end }}
{{- end }}