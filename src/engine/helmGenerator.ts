import type { ArchNode, ArchEdge } from '../types';
import { sanitizeName } from './iacUtils';

// ─── Type helpers ────────────────────────────────────────────

interface K8sContainer {
  name: string;
  image: string;
  ports?: { containerPort: number; name?: string }[];
  env?: { name: string; value: string }[];
  resources?: {
    requests: { cpu: string; memory: string };
    limits: { cpu: string; memory: string };
  };
  livenessProbe?: object;
  readinessProbe?: object;
}

interface K8sWorkload {
  componentType: string;
  name: string;
  replicas: number;
  containers: K8sContainer[];
  serviceType: 'ClusterIP' | 'LoadBalancer' | 'NodePort';
  port: number;
  targetPort: number;
  isStateful: boolean;
  storageSize?: string;
  storageImage?: string;
}

// ─── Port / Image mappings ───────────────────────────────────

const IMAGE_MAP: Record<string, string> = {
  'api-server': 'nginx:1.25-alpine',
  'web-server': 'nginx:1.25-alpine',
  'worker': 'busybox:latest',
  'websocket-server': 'node:20-alpine',
  'graphql-server': 'node:20-alpine',
  'game-server': 'node:20-alpine',
  'ml-worker': 'python:3.11-slim',
  'ecs-fargate': 'nginx:1.25-alpine',
  'app-runner': 'nginx:1.25-alpine',
  'lambda': 'public.ecr.aws/lambda/nodejs:20',
  postgresql: 'postgres:15-alpine',
  mysql: 'mysql:8.0',
  mongodb: 'mongo:7.0',
  redis: 'redis:7-alpine',
  elasticsearch: 'docker.elastic.co/elasticsearch/elasticsearch:8.11.0',
  kafka: 'confluentinc/cp-kafka:7.5.0',
  rabbitmq: 'rabbitmq:3.12-management-alpine',
  'message-queue': 'rabbitmq:3.12-management-alpine',
  cassandra: 'cassandra:4.1',
  nextjs: 'node:20-alpine',
  react: 'node:20-alpine',
  vue: 'node:20-alpine',
};

const PORT_MAP: Record<string, number> = {
  'api-server': 8080,
  'web-server': 80,
  'worker': 8080,
  'websocket-server': 8080,
  'graphql-server': 4000,
  'game-server': 7777,
  'ml-worker': 8000,
  'ecs-fargate': 8080,
  'app-runner': 8080,
  'lambda': 8080,
  postgresql: 5432,
  mysql: 3306,
  mongodb: 27017,
  redis: 6379,
  elasticsearch: 9200,
  kafka: 9092,
  rabbitmq: 5672,
  'message-queue': 5672,
  cassandra: 9042,
  nextjs: 3000,
  react: 3000,
  vue: 3000,
};

const STATEFUL_TYPES = new Set([
  'postgresql', 'mysql', 'mongodb', 'redis', 'cassandra',
  'elasticsearch', 'kafka', 'rabbitmq', 'message-queue',
]);

const STORAGE_MAP: Record<string, string> = {
  postgresql: '10Gi',
  mysql: '10Gi',
  mongodb: '10Gi',
  redis: '1Gi',
  cassandra: '20Gi',
  elasticsearch: '10Gi',
  kafka: '20Gi',
  rabbitmq: '5Gi',
  'message-queue': '5Gi',
};

// ─── Main helpers ────────────────────────────────────────────

function buildWorkloads(nodes: ArchNode[], edges: ArchEdge[]): K8sWorkload[] {
  const RENDERABLE = new Set([
    'api-server', 'web-server', 'worker', 'websocket-server', 'graphql-server',
    'game-server', 'ml-worker', 'ecs-fargate', 'app-runner', 'lambda',
    'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch',
    'kafka', 'rabbitmq', 'message-queue', 'cassandra',
    'nextjs', 'react', 'vue',
  ]);

  return nodes
    .filter(n => !n.data.isDisabled && RENDERABLE.has(n.data.componentType))
    .map(node => {
      const name = sanitizeName(node.data.label).replace(/_/g, '-');
      const type = node.data.componentType;
      const port = PORT_MAP[type] ?? 8080;
      const replicas = node.data.scalingType === 'horizontal' ? node.data.instances : 1;
      const isStateful = STATEFUL_TYPES.has(type);

      // Determine service type
      const incomingEdges = edges.filter(e => e.target === node.id);
      const hasFrontendSource = incomingEdges.some(e => {
        const src = nodes.find(n => n.id === e.source);
        return src && ['client-browser', 'mobile-app', 'load-balancer', 'api-gateway', 'cdn'].includes(src.data.componentType);
      });

      const isComputeFacing = ['api-server', 'web-server', 'websocket-server', 'graphql-server', 'app-runner', 'nextjs', 'react', 'vue'].includes(type);
      const serviceType = (isComputeFacing && hasFrontendSource) ? 'LoadBalancer' : 'ClusterIP';

      const cpuRequest = ['ml-worker', 'game-server', 'graphql-server'].includes(type) ? '500m' : '100m';
      const memRequest = ['ml-worker'].includes(type) ? '1Gi' : '128Mi';
      const cpuLimit = ['ml-worker', 'game-server'].includes(type) ? '2000m' : '500m';
      const memLimit = ['ml-worker'].includes(type) ? '4Gi' : '512Mi';

      const container: K8sContainer = {
        name,
        image: IMAGE_MAP[type] ?? `${name}:latest`,
        ports: [{ containerPort: port, name: 'http' }],
        resources: {
          requests: { cpu: cpuRequest, memory: memRequest },
          limits: { cpu: cpuLimit, memory: memLimit },
        },
        livenessProbe: isStateful ? undefined : {
          httpGet: { path: '/health', port },
          initialDelaySeconds: 10,
          periodSeconds: 30,
        },
        readinessProbe: isStateful ? undefined : {
          httpGet: { path: '/health', port },
          initialDelaySeconds: 5,
          periodSeconds: 10,
        },
      };

      // Add well-known env vars for DB types
      if (type === 'postgresql') {
        container.env = [
          { name: 'POSTGRES_USER', value: '{{ .Values.postgresql.user }}' },
          { name: 'POSTGRES_PASSWORD', value: '{{ .Values.postgresql.password }}' },
          { name: 'POSTGRES_DB', value: '{{ .Values.postgresql.db }}' },
        ];
      } else if (type === 'mysql') {
        container.env = [
          { name: 'MYSQL_ROOT_PASSWORD', value: '{{ .Values.mysql.rootPassword }}' },
          { name: 'MYSQL_DATABASE', value: '{{ .Values.mysql.db }}' },
        ];
      } else if (type === 'redis') {
        container.ports = [{ containerPort: 6379, name: 'redis' }];
      }

      return {
        componentType: type,
        name,
        replicas,
        containers: [container],
        serviceType,
        port: 80,
        targetPort: port,
        isStateful,
        storageSize: STORAGE_MAP[type],
        storageImage: IMAGE_MAP[type],
      };
    });
}

// ─── YAML renderers ──────────────────────────────────────────

function indent(text: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return text.split('\n').map(l => (l.trim() ? pad + l : l)).join('\n');
}

function renderDeployment(w: K8sWorkload, projectName: string): string {
  const c = w.containers[0];
  const probeLines = c.livenessProbe
    ? `        livenessProbe:
          httpGet:
            path: /health
            port: ${w.targetPort}
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: ${w.targetPort}
          initialDelaySeconds: 5
          periodSeconds: 10`
    : '';

  const envLines = c.env && c.env.length > 0
    ? `        env:\n` + c.env.map(e => `          - name: ${e.name}\n            value: "${e.value}"`).join('\n')
    : '';

  return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .Release.Name }}-${w.name}
  namespace: {{ .Release.Namespace | default "default" }}
  labels:
    app: ${w.name}
    project: ${projectName}
    chart: {{ .Chart.Name }}-{{ .Chart.Version }}
    release: {{ .Release.Name }}
    managed-by: archviz
spec:
  replicas: {{ .Values.${w.name}.replicas | default ${w.replicas} }}
  selector:
    matchLabels:
      app: ${w.name}
      release: {{ .Release.Name }}
  template:
    metadata:
      labels:
        app: ${w.name}
        release: {{ .Release.Name }}
    spec:
      containers:
        - name: ${c.name}
          image: "{{ .Values.${w.name}.image.repository }}:{{ .Values.${w.name}.image.tag }}"
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: ${w.targetPort}
              name: http
              protocol: TCP
${envLines ? indent(envLines, 10) : ''}
${probeLines ? indent(probeLines, 0) : ''}
          resources:
            requests:
              cpu: "{{ .Values.${w.name}.resources.requests.cpu }}"
              memory: "{{ .Values.${w.name}.resources.requests.memory }}"
            limits:
              cpu: "{{ .Values.${w.name}.resources.limits.cpu }}"
              memory: "{{ .Values.${w.name}.resources.limits.memory }}"
`;
}

function renderStatefulSet(w: K8sWorkload, projectName: string): string {
  const c = w.containers[0];
  const envLines = c.env && c.env.length > 0
    ? `        env:\n` + c.env.map(e => `          - name: ${e.name}\n            value: "${e.value}"`).join('\n')
    : '';

  return `apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: {{ .Release.Name }}-${w.name}
  namespace: {{ .Release.Namespace | default "default" }}
  labels:
    app: ${w.name}
    project: ${projectName}
    chart: {{ .Chart.Name }}-{{ .Chart.Version }}
    release: {{ .Release.Name }}
    managed-by: archviz
spec:
  serviceName: {{ .Release.Name }}-${w.name}
  replicas: {{ .Values.${w.name}.replicas | default ${w.replicas} }}
  selector:
    matchLabels:
      app: ${w.name}
      release: {{ .Release.Name }}
  template:
    metadata:
      labels:
        app: ${w.name}
        release: {{ .Release.Name }}
    spec:
      containers:
        - name: ${c.name}
          image: "{{ .Values.${w.name}.image.repository }}:{{ .Values.${w.name}.image.tag }}"
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: ${w.targetPort}
              name: db
              protocol: TCP
${envLines ? indent(envLines, 10) : ''}
          resources:
            requests:
              cpu: "{{ .Values.${w.name}.resources.requests.cpu }}"
              memory: "{{ .Values.${w.name}.resources.requests.memory }}"
            limits:
              cpu: "{{ .Values.${w.name}.resources.limits.cpu }}"
              memory: "{{ .Values.${w.name}.resources.limits.memory }}"
          volumeMounts:
            - name: data
              mountPath: /data
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: {{ .Values.${w.name}.persistence.size | default "${w.storageSize ?? '5Gi'}" }}
`;
}

function renderService(w: K8sWorkload, projectName: string): string {
  return `apiVersion: v1
kind: Service
metadata:
  name: {{ .Release.Name }}-${w.name}
  namespace: {{ .Release.Namespace | default "default" }}
  labels:
    app: ${w.name}
    project: ${projectName}
    release: {{ .Release.Name }}
    managed-by: archviz
spec:
  type: {{ .Values.${w.name}.service.type | default "${w.serviceType}" }}
  selector:
    app: ${w.name}
    release: {{ .Release.Name }}
  ports:
    - name: http
      protocol: TCP
      port: {{ .Values.${w.name}.service.port | default ${w.port} }}
      targetPort: ${w.targetPort}
`;
}

function renderIngress(projectName: string, webWorkloads: K8sWorkload[]): string {
  if (webWorkloads.length === 0) return '';
  const firstWeb = webWorkloads[0];
  return `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{ .Release.Name }}-ingress
  namespace: {{ .Release.Namespace | default "default" }}
  labels:
    project: ${projectName}
    release: {{ .Release.Name }}
    managed-by: archviz
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx
  rules:
    - host: {{ .Values.ingress.host | default "${projectName}.example.com" }}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: {{ .Release.Name }}-${firstWeb.name}
                port:
                  number: ${firstWeb.port}
`;
}

function renderHpa(w: K8sWorkload): string {
  if (w.isStateful || w.replicas <= 1) return '';
  return `apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: {{ .Release.Name }}-${w.name}-hpa
  namespace: {{ .Release.Namespace | default "default" }}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: {{ .Release.Name }}-${w.name}
  minReplicas: {{ .Values.${w.name}.autoscaling.minReplicas | default 1 }}
  maxReplicas: {{ .Values.${w.name}.autoscaling.maxReplicas | default ${Math.max(w.replicas * 2, 4)} }}
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
`;
}

// ─── Chart.yaml ──────────────────────────────────────────────

export function generateChartYaml(projectName: string): string {
  const cleanName = sanitizeName(projectName).replace(/_/g, '-') || 'archviz-app';
  return `apiVersion: v2
name: ${cleanName}
description: "Helm chart generated by ArchViz — ${projectName}"
type: application
version: 0.1.0
appVersion: "1.0.0"
keywords:
  - archviz
  - generated
maintainers:
  - name: ArchViz
    url: https://archviz-studio.vercel.app
`;
}

// ─── values.yaml ─────────────────────────────────────────────

export function generateValuesYaml(nodes: ArchNode[], edges: ArchEdge[], projectName: string): string {
  const workloads = buildWorkloads(nodes, edges);
  const webWorkloads = workloads.filter(w => !w.isStateful);

  let yaml = `# Default values for ${projectName} — generated by ArchViz
# Override these in a values.override.yaml or via --set flags.

ingress:
  enabled: ${webWorkloads.length > 0}
  host: "${sanitizeName(projectName).replace(/_/g, '-') || 'myapp'}.example.com"

`;

  for (const w of workloads) {
    const c = w.containers[0];
    const imgParts = (c.image ?? 'nginx:latest').split(':');
    const repo = imgParts[0];
    const tag = imgParts[1] ?? 'latest';

    yaml += `${w.name}:
  replicas: ${w.replicas}
  image:
    repository: ${repo}
    tag: "${tag}"
  service:
    type: ${w.serviceType}
    port: ${w.port}
  resources:
    requests:
      cpu: "${c.resources?.requests.cpu ?? '100m'}"
      memory: "${c.resources?.requests.memory ?? '128Mi'}"
    limits:
      cpu: "${c.resources?.limits.cpu ?? '500m'}"
      memory: "${c.resources?.limits.memory ?? '512Mi'}"
`;
    if (!w.isStateful) {
      yaml += `  autoscaling:
    minReplicas: 1
    maxReplicas: ${Math.max(w.replicas * 2, 4)}
`;
    } else {
      yaml += `  persistence:
    size: "${w.storageSize ?? '5Gi'}"
    storageClass: ""
`;
    }
    yaml += `  # Environment-specific: set sensitive values via --set or sealed-secrets
  # ${w.name}.env:
  #   MY_SECRET_ENV: ""
\n`;
  }

  // Add DB defaults
  if (workloads.some(w => w.componentType === 'postgresql')) {
    yaml += `postgresql:
  user: postgres
  password: "changeme"  # CHANGE IN PRODUCTION
  db: appdb\n\n`;
  }
  if (workloads.some(w => w.componentType === 'mysql')) {
    yaml += `mysql:
  rootPassword: "changeme"  # CHANGE IN PRODUCTION
  db: appdb\n\n`;
  }

  return yaml;
}

// ─── templates/*.yaml ────────────────────────────────────────

export function generateHelmTemplates(nodes: ArchNode[], edges: ArchEdge[], projectName: string): Record<string, string> {
  const workloads = buildWorkloads(nodes, edges);
  const webWorkloads = workloads.filter(w => !w.isStateful);
  const templates: Record<string, string> = {};

  const SEPARATOR = '---\n';
  let allWorkloadManifests = '';

  for (const w of workloads) {
    const workload = w.isStateful ? renderStatefulSet(w, projectName) : renderDeployment(w, projectName);
    const service = renderService(w, projectName);
    const hpa = renderHpa(w);

    allWorkloadManifests += SEPARATOR + workload + SEPARATOR + service;
    if (hpa) allWorkloadManifests += SEPARATOR + hpa;
  }

  templates['workloads.yaml'] = allWorkloadManifests || '# No workloads defined.';

  const ingressYaml = renderIngress(projectName, webWorkloads);
  if (ingressYaml) {
    templates['ingress.yaml'] = `{{- if .Values.ingress.enabled }}\n${SEPARATOR}${ingressYaml}{{- end }}\n`;
  }

  // _helpers.tpl
  const cleanName = sanitizeName(projectName).replace(/_/g, '-') || 'archviz-app';
  templates['_helpers.tpl'] = `{{/*
ArchViz-generated Helm helpers for ${projectName}
*/}}

{{- define "${cleanName}.labels" -}}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
`;

  return templates;
}

// ─── Full Helm Chart ZIP ──────────────────────────────────────

export interface HelmChartFile {
  path: string;  // relative path inside zip, e.g. "mychart/Chart.yaml"
  content: string;
}

export function generateHelmChartFiles(nodes: ArchNode[], edges: ArchEdge[], projectName: string): HelmChartFile[] {
  const chartName = sanitizeName(projectName).replace(/_/g, '-') || 'archviz-app';
  const prefix = `${chartName}/`;

  const files: HelmChartFile[] = [
    { path: `${prefix}Chart.yaml`, content: generateChartYaml(projectName) },
    { path: `${prefix}values.yaml`, content: generateValuesYaml(nodes, edges, projectName) },
  ];

  const templates = generateHelmTemplates(nodes, edges, projectName);
  for (const [filename, content] of Object.entries(templates)) {
    files.push({ path: `${prefix}templates/${filename}`, content });
  }

  // Add a NOTES.txt for post-install instructions
  files.push({
    path: `${prefix}templates/NOTES.txt`,
    content: `Chart deployed successfully!

Project: ${projectName}
Release: {{ .Release.Name }}
Namespace: {{ .Release.Namespace | default "default" }}

Generated by ArchViz — https://archviz-studio.vercel.app

To check your release:
  kubectl get all -n {{ .Release.Namespace | default "default" }} -l release={{ .Release.Name }}
`,
  });

  return files;
}

// ─── Enhanced K8s manifest generator (no Helm) ──────────────

export function generateKubernetesManifestsFull(nodes: ArchNode[], edges: ArchEdge[], projectName: string): string {
  const workloads = buildWorkloads(nodes, edges);
  const webWorkloads = workloads.filter(w => !w.isStateful);

  if (workloads.length === 0) {
    return '# No applicable workloads found for Kubernetes manifest generation.\n# Add compute or database components to the canvas first.';
  }

  const SEPARATOR = '---\n';
  const parts: string[] = [
    `# Kubernetes manifests generated by ArchViz`,
    `# Project: ${projectName}`,
    `# Generated: ${new Date().toISOString()}`,
    `# ${workloads.length} workload(s) detected\n`,
    `apiVersion: v1`,
    `kind: Namespace`,
    `metadata:`,
    `  name: ${sanitizeName(projectName).replace(/_/g, '-') || 'archviz'}`,
    `  labels:`,
    `    managed-by: archviz`,
  ];

  for (const w of workloads) {
    // Resolve image from values
    const c = w.containers[0];

    const workloadYaml = w.isStateful
      ? renderStatefulSetRaw(w, projectName)
      : renderDeploymentRaw(w, c, projectName);

    const serviceYaml = renderServiceRaw(w, projectName);
    const hpaYaml = renderHpaRaw(w);

    parts.push(SEPARATOR + workloadYaml, SEPARATOR + serviceYaml);
    if (hpaYaml) parts.push(SEPARATOR + hpaYaml);
  }

  const ingressYaml = renderIngressRaw(projectName, webWorkloads);
  if (ingressYaml) parts.push(SEPARATOR + ingressYaml);

  return parts.join('\n');
}

// ─── Raw (non-templated) YAML renderers ─────────────────────

function renderDeploymentRaw(w: K8sWorkload, c: K8sContainer, projectName: string): string {
  const envLines = c.env && c.env.length > 0
    ? `        env:\n` + c.env.map(e => `          - name: ${e.name}\n            value: "${e.value.replace(/\{\{.*?\}\}/g, 'REPLACE_ME')}"`).join('\n') + '\n'
    : '';

  const probeLines = c.livenessProbe
    ? `        livenessProbe:
          httpGet:
            path: /health
            port: ${w.targetPort}
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: ${w.targetPort}
          initialDelaySeconds: 5
          periodSeconds: 10
`
    : '';

  return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${w.name}
  namespace: ${sanitizeName(projectName).replace(/_/g, '-') || 'archviz'}
  labels:
    app: ${w.name}
    project: ${projectName}
    managed-by: archviz
spec:
  replicas: ${w.replicas}
  selector:
    matchLabels:
      app: ${w.name}
  template:
    metadata:
      labels:
        app: ${w.name}
    spec:
      containers:
        - name: ${c.name}
          image: ${c.image}
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: ${w.targetPort}
              name: http
${envLines}${probeLines}          resources:
            requests:
              cpu: "${c.resources?.requests.cpu ?? '100m'}"
              memory: "${c.resources?.requests.memory ?? '128Mi'}"
            limits:
              cpu: "${c.resources?.limits.cpu ?? '500m'}"
              memory: "${c.resources?.limits.memory ?? '512Mi'}"
`;
}

function renderStatefulSetRaw(w: K8sWorkload, projectName: string): string {
  const c = w.containers[0];
  const ns = sanitizeName(projectName).replace(/_/g, '-') || 'archviz';
  const envLines = c.env && c.env.length > 0
    ? `        env:\n` + c.env.map(e => `          - name: ${e.name}\n            value: "${e.value.replace(/\{\{.*?\}\}/g, 'REPLACE_ME')}"`).join('\n') + '\n'
    : '';

  return `apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: ${w.name}
  namespace: ${ns}
  labels:
    app: ${w.name}
    project: ${projectName}
    managed-by: archviz
spec:
  serviceName: ${w.name}
  replicas: ${w.replicas}
  selector:
    matchLabels:
      app: ${w.name}
  template:
    metadata:
      labels:
        app: ${w.name}
    spec:
      containers:
        - name: ${c.name}
          image: ${c.image}
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: ${w.targetPort}
              name: db
${envLines}          resources:
            requests:
              cpu: "${c.resources?.requests.cpu ?? '100m'}"
              memory: "${c.resources?.requests.memory ?? '128Mi'}"
            limits:
              cpu: "${c.resources?.limits.cpu ?? '500m'}"
              memory: "${c.resources?.limits.memory ?? '512Mi'}"
          volumeMounts:
            - name: data
              mountPath: /data
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: ${w.storageSize ?? '5Gi'}
`;
}

function renderServiceRaw(w: K8sWorkload, projectName: string): string {
  const ns = sanitizeName(projectName).replace(/_/g, '-') || 'archviz';
  return `apiVersion: v1
kind: Service
metadata:
  name: ${w.name}-svc
  namespace: ${ns}
  labels:
    app: ${w.name}
    project: ${projectName}
    managed-by: archviz
spec:
  type: ${w.serviceType}
  selector:
    app: ${w.name}
  ports:
    - name: http
      protocol: TCP
      port: ${w.port}
      targetPort: ${w.targetPort}
`;
}

function renderHpaRaw(w: K8sWorkload): string {
  if (w.isStateful || w.replicas <= 1) return '';
  return `apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ${w.name}-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ${w.name}
  minReplicas: 1
  maxReplicas: ${Math.max(w.replicas * 2, 4)}
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
`;
}

function renderIngressRaw(projectName: string, webWorkloads: K8sWorkload[]): string {
  if (webWorkloads.length === 0) return '';
  const ns = sanitizeName(projectName).replace(/_/g, '-') || 'archviz';
  const firstWeb = webWorkloads[0];
  return `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ${ns}-ingress
  namespace: ${ns}
  labels:
    project: ${projectName}
    managed-by: archviz
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx
  rules:
    - host: ${ns}.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: ${firstWeb.name}-svc
                port:
                  number: ${firstWeb.port}
`;
}
