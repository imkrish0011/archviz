<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-6-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Zustand-5-FF6B35?style=for-the-badge" alt="Zustand" />
  <img src="https://img.shields.io/badge/Vitest-4-6E9F18?style=for-the-badge&logo=vitest&logoColor=white" alt="Vitest" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="MIT License" />
</p>

<h1 align="center">🧠 ArchViz — System Architecture Design Engine</h1>

<p align="center">
  <strong>Design. Simulate. Optimize. Export.</strong><br/>
  A visual system architecture simulator with real-time cost estimation, traffic simulation, bottleneck detection, security scanning, and Infrastructure-as-Code export — all running locally in your browser.
</p>

<p align="center">
  <a href="https://archviz-studio.vercel.app" target="_blank">
    <img src="https://img.shields.io/badge/Live%20Demo-archviz--studio.vercel.app-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Live Demo" />
  </a>
</p>

<p align="center">
  <a href="https://archviz-studio.vercel.app" target="_blank">
    <img src="./public/preview.png" alt="ArchViz Preview Workspace" width="100%" style="border-radius: 8px;" />
  </a>
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-simulation-engine">Simulation Engine</a> •
  <a href="#-component-library">Components</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-getting-started">Getting Started</a> •
  <a href="#-testing">Testing</a> •
  <a href="#-tech-stack">Tech Stack</a>
</p>

---

## ✨ Features

### 🎨 Visual Architecture Designer
- **Drag-and-drop** 40+ real AWS/cloud components onto an infinite canvas
- **Smart connections** with architectural anti-pattern detection (e.g., blocks frontend→database direct links)
- **Auto-layout** using Dagre graph algorithms
- **Group/Boundary nodes** for VPCs, subnets, and security zones
- **Minimap, zoom, pan** — full Figma-style workspace experience

### 📊 Real-Time Simulation Engine
- **Live cost estimation** using real AWS us-east-1 on-demand pricing
- **Traffic simulation** with configurable concurrent users and RPS multipliers
- **Bottleneck detection** — identifies overloaded nodes in real time
- **Latency modeling** — calculates end-to-end request latency across your architecture
- **Health scoring** — letter grades (A–F) based on performance, availability, and architecture quality
- **SLA calculator** — composite SLA with nines calculation and downtime estimation

### 🔒 Security Scanner
- Automated **compliance scanning** against SOC2, HIPAA, PCI-DSS, and GDPR standards
- Detects missing encryption, public exposure, single points of failure
- Severity-graded findings with actionable remediation steps

### 🛡️ Connection Validation
- **Anti-pattern rules** prevent bad architecture decisions at design time
- Blocks: Frontend → Database, Client → Queue, Cache → Client direct connections
- Warns: Lambda → RDS without VPC, direct compute-to-compute without load balancing
- Real-time toast notifications with suggestions

### 🏗️ Infrastructure-as-Code Export
- **Terraform (HCL)** — Full provider config, VPC scaffold, security groups, and resource blocks
- **CloudFormation (JSON)** — AWS-native template with parameters and resource definitions
- Proper resource naming, tagging, and networking setup
- Exports ready to `terraform plan` or deploy via CloudFormation

### 🎭 Simulation Events
Inject real-world chaos scenarios to stress-test your design:
| Event | Effect |
|---|---|
| 🔥 Server Crash | Randomly fails a compute node |
| 🗑️ Cache Removal | Disables Redis/cache layer |
| 📈 Traffic Spike | 10x concurrent users |
| 🌐 CDN Failure | Takes CDN offline |
| 💾 DB Failover | Triggers database instance failure |

### 📋 Built-in Templates
Start from proven architectures of real-world systems:
- **Netflix** — Microservices with event-driven streaming
- **Uber** — Real-time dispatch with geolocation
- **Slack** — WebSocket-based real-time messaging
- **Stripe** — Payment processing with PCI compliance
- **Twitter/X** — Fan-out timeline with celebrity problem handling
- **Airbnb** — Search-heavy booking platform
- And more starter templates for common patterns

### 🎯 Additional Features
- **Undo/Redo** — Full history stack with Ctrl+Z / Ctrl+Y
- **Version History** — Snapshot your architecture at any point
- **Dark Mode** — Midnight Obsidian design system throughout
- **Keyboard Shortcuts** — Professional hotkeys for every action
- **Context Menu** — Right-click actions on nodes and canvas
- **Global Search** — Cmd+K to find any component
- **PNG & JSON Export** — Share or archive your designs
- **Local-first** — All data stays in your browser (localStorage)
- **Form Validation** — Zod-powered input validation prevents invalid configurations
- **Error Boundaries** — Graceful crash recovery at app and canvas level
- **URL Routing** — React Router with deep-linking support

---

## 🔬 Simulation Engine

The simulation engine is composed of 13 specialized modules:

```
┌─────────────────────────────────────────────────────────┐
│                    Simulator (Orchestrator)              │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Traffic Model │  │ Cost Engine  │  │ Latency Model │  │
│  │ RPS / Users   │  │ AWS Pricing  │  │ E2E Latency   │  │
│  └──────────────┘  └──────────────┘  └───────────────┘  │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Bottleneck  │  │ Failure Model│  │   Scaling     │  │
│  │  Detector    │  │ Reliability  │  │   Model       │  │
│  └──────────────┘  └──────────────┘  └───────────────┘  │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │    SLA       │  │  Security    │  │ Recommendation│  │
│  │ Calculator   │  │  Scanner     │  │    Engine     │  │
│  └──────────────┘  └──────────────┘  └───────────────┘  │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Connection  │  │  Terraform   │  │  Auto Layout  │  │
│  │  Validator   │  │  Generator   │  │  (Dagre)      │  │
│  └──────────────┘  └──────────────┘  └───────────────┘  │
│                                                         │
│                  ┌──────────────┐                        │
│                  │ CloudFormation│                        │
│                  │  Generator   │                        │
│                  └──────────────┘                        │
└─────────────────────────────────────────────────────────┘
```

### Cost Engine
Calculates monthly cost per component factoring in:
- Instance tier (real AWS pricing: t3.micro → m5.4xlarge)
- Horizontal scaling (instance count)
- Volume type multipliers (gp3, io1, magnetic)
- Multi-AZ premium (1.5x)
- Pricing models: On-Demand, Savings Plan (-30%), Reserved (-50%), Spot (-70%)
- Read replica costs for databases (~70% per replica)

### SLA Calculator
- Computes **composite SLA** across critical path
- Calculates **nines** (e.g., 99.95% = 3.3 nines)
- Estimates **annual and monthly downtime**
- Identifies **weakest link** in your architecture

---

## 🧩 Component Library

**40+ components** across 7 categories with real AWS pricing:

| Category | Components |
|---|---|
| **Client** | Web Browser, Mobile App, External API, Auth0, Cognito, Vault, OpenAI API, Stripe |
| **Compute** | API Server, Web Server, Worker, Lambda, WebSocket, ECS Fargate, App Runner, K8s (EKS), Cloudflare Workers, GraphQL Server, Game Server, ML/GPU Worker, Batch Job |
| **Storage** | PostgreSQL, MySQL, MongoDB, Redis, S3, Cassandra, DynamoDB, Elasticsearch, Pinecone Vector DB, Snowflake, Bigtable/Spanner |
| **Network** | Load Balancer (ALB), CDN (CloudFront), API Gateway, NAT Gateway, Route 53, WAF/Firewall, Transit Gateway |
| **Messaging** | SQS, SNS, Kafka (MSK), RabbitMQ, EventBridge |
| **Observability** | CloudWatch, DataDog |
| **Boundary** | VPC, Public/Private Subnet, Security Group, Availability Zone |

Each component includes:
- Multiple **tier options** with real pricing (e.g., `db.t3.micro` at $15.33/mo → `db.r6g.4xlarge` at $700.80/mo)
- **Capacity** (requests/sec per instance)
- **Latency** characteristics
- **Reliability** rating (0–1)
- **Scaling type** (horizontal/vertical)

---

## 🏛️ Architecture

```
src/
├── components/          # React UI components
│   ├── nodes/           # Custom ReactFlow node renders
│   ├── ErrorBoundary.tsx  # App & Canvas crash recovery
│   ├── TopBar.tsx       # Toolbar with actions
│   ├── LeftSidebar.tsx  # Component palette (drag source)
│   ├── RightPanel.tsx   # Node configuration panel
│   ├── BottomInsightBar.tsx  # Live metrics display
│   ├── LandingPage.tsx  # Marketing landing page
│   ├── SecurityPanel.tsx  # Security scan results
│   └── ...              # Modals, overlays, toast system
│
├── engine/              # Pure-logic simulation modules
│   ├── simulator.ts     # Orchestrator — runs all engines
│   ├── costEngine.ts    # AWS pricing calculations
│   ├── trafficModel.ts  # RPS & user traffic modeling
│   ├── latencyModel.ts  # End-to-end latency calculation
│   ├── bottleneckDetector.ts  # Load % and health detection
│   ├── failureModel.ts  # Reliability & SPOF analysis
│   ├── scalingModel.ts  # Auto-scaling simulation
│   ├── slaCalculator.ts # SLA composite & nines
│   ├── securityScanner.ts  # Compliance scanning
│   ├── connectionValidator.ts  # Anti-pattern rules
│   ├── recommendationEngine.ts  # AI-like suggestions
│   ├── terraformGenerator.ts    # HCL & CFN export
│   └── autoLayout.ts    # Dagre-powered graph layout
│
├── store/
│   └── useArchStore.ts  # Zustand store (source of truth)
│
├── hooks/
│   ├── useSimulation.ts       # Memoized simulation hook
│   ├── useSimulationEvents.ts # Chaos event handlers
│   └── useValidation.ts       # Zod form validation hook
│
├── utils/
│   ├── validationSchemas.ts   # Zod schemas for all fields
│   └── templateLoader.ts      # Template → graph converter
│
├── data/
│   ├── componentLibrary.ts    # 40+ component definitions
│   └── templates/             # Pre-built architecture templates
│
├── types/
│   └── index.ts               # TypeScript type definitions
│
├── tests/                     # Vitest test suites
│   ├── costEngine.test.ts     # 16 tests
│   ├── connectionValidator.test.ts  # 8 tests
│   ├── terraformGenerator.test.ts   # 14 tests
│   └── validationSchemas.test.ts    # 31 tests
│
└── styles/
    ├── index.css              # Design system (Midnight Obsidian)
    ├── landing.css            # Landing page styles
    └── reactflow.css          # ReactFlow customizations
```

### State Management
All application state is managed through a single **Zustand store** (`useArchStore`):
- Graph state (nodes, edges)
- UI state (panel visibility, selection)
- Simulation config (users, RPS, cache hit rate)
- Undo/Redo stack
- LocalStorage persistence
- Version history snapshots

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** 18+ 
- **npm** 9+

### Installation

```bash
# Clone the repository
git clone https://github.com/imkrish0011/archviz.git
cd archviz

# Install dependencies
npm install

# Start dev server
npm run dev
```

The app will open at `http://localhost:5173`.

### Build for Production

```bash
npm run build
npm run preview
```

---

## 🧪 Testing

ArchViz has a comprehensive test suite powered by **Vitest**:

```bash
# Run all tests
npm test

# Run in watch mode
npm run test:watch
```

### Test Coverage

| Suite | Tests | Coverage |
|---|---|---|
| `costEngine.test.ts` | 16 | Pricing models, volume types, multi-AZ, replicas, scaling, formatting |
| `connectionValidator.test.ts` | 8 | Anti-pattern detection, allowed/blocked connections, warnings |
| `terraformGenerator.test.ts` | 14 | HCL generation, resource mapping, VPC scaffold, CloudFormation |
| `validationSchemas.test.ts` | 31 | All Zod schemas, boundary values, edge cases, error messages |
| **Total** | **69** | |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | React 19 + TypeScript 5 |
| **Build** | Vite 6 |
| **State** | Zustand 5 |
| **Canvas** | @xyflow/react (ReactFlow) |
| **Routing** | React Router DOM 7 |
| **Validation** | Zod 4 |
| **Graph Layout** | @dagrejs/dagre |
| **Icons** | Lucide React |
| **Image Export** | html-to-image |
| **Testing** | Vitest + React Testing Library |
| **Styling** | Vanilla CSS (Midnight Obsidian design system) |

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl + S` | Save to localStorage |
| `Ctrl + Z` | Undo |
| `Ctrl + Y` / `Ctrl + Shift + Z` | Redo |
| `Ctrl + E` | Export as PNG |
| `Ctrl + K` | Global search |
| `Delete` / `Backspace` | Remove selected node/edge |
| `Escape` | Deselect all |
| `F11` | Toggle fullscreen |
| `?` | Show shortcuts overlay |

---

## 📄 License

MIT — Use it, fork it, build on it. No restrictions.

---

<p align="center">
  <strong>Built for elite system designers.</strong><br/>
  <sub>Design your architecture before you write a single line of code.</sub>
</p>
