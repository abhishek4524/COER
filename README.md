# Personify ⚡ AI UX Simulation & Fix Emulator Platform

> **Synthetic Persona Usability Testing, Real-Time Heatmaps & DOM Fix Emulation**  
> Run automated user tests with 50+ diverse AI personas, uncover UX friction points with live screencasts and heatmaps, and preview improved versions of your site with the built-in **Fix Emulator** — all without modifying production code.

---

## 📑 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
  - [1. Autonomous AI Persona Testing](#1-autonomous-ai-persona-testing)
  - [2. Live Simulation & CDP Screencast](#2-live-simulation--cdp-screencast)
  - [3. Deep Analytics & Heatmaps (2D & 3D)](#3-deep-analytics--heatmaps-2d--3d)
  - [4. Fix Emulator (Simulated Preview & Re-Test)](#4-fix-emulator-simulated-preview--re-test)
  - [5. Security & Verification Engine](#5-security--verification-engine)
- [Architecture & Tech Stack](#-architecture--tech-stack)
- [Project Directory Structure](#-project-directory-structure)
- [Prerequisites & Environment Setup](#-prerequisites--environment-setup)
  - [Backend Setup (`/server`)](#backend-setup-server)
  - [Frontend Setup (`/client`)](#frontend-setup-client)
  - [Demo Site Setup (`/demo-site`)](#demo-site-setup-demo-site)
- [Running the Platform](#-running-the-platform)
- [Fix Emulator: Deep Dive](#-fix-emulator-deep-dive)
  - [Whitelisted Patch Operations](#whitelisted-patch-operations)
  - [Deterministic & LLM Fix Generation](#deterministic--llm-fix-generation)
  - [Interactive Before/After Slider & Pins](#interactive-beforeafter-slider--pins)
  - [Simulated Re-Test Engine](#simulated-re-test-engine)
- [API Reference](#-api-reference)
- [Testing & Quality Assurance](#-testing--quality-assurance)
- [Deliberate UX Flaws Demo Site](#-deliberate-ux-flaws-demo-site)
- [Troubleshooting & FAQ](#-troubleshooting--faq)
- [License](#-license)

---

## 🌟 Overview

**Personify** bridges the gap between manual user research and automated synthetic testing. By dispatching autonomous LLM-driven browser agents equipped with distinct demographic backgrounds, patience thresholds, tech-savviness, and accessibility constraints, Personify discovers where real humans struggle, abandon flows, or rage-click.

Once usability hurdles are identified, the **Fix Emulator** generates realistic, non-destructive DOM patch operations, produces full-page Before vs. After previews with an interactive slider, and allows you to **re-test the exact same personas against the improved experience** to project conversion and friction deltas.

---

## 🚀 Key Features

### 1. Autonomous AI Persona Testing
- **50+ Calibrated Personas**: Covers Gen-Z digital natives, busy millennials, non-technical seniors, assistive technology users, and skeptical shoppers.
- **Cognitive & Emotional Modeling**: Each persona calculates continuous frustration scores ($0-10$), streams first-person thoughts, and exhibits realistic human behavioral cues (curved mouse movement, reading pauses, confusion loops, and give-up thresholds).
- **Element-Index Interaction Model**: Personas interact with numbered DOM bounding boxes rather than hallucinated CSS selectors, ensuring 100% deterministic interaction execution.

### 2. Live Simulation & CDP Screencast
- **Real-Time Screencast**: Streams browser sessions room-wide via Socket.io and Chrome DevTools Protocol (CDP) at adjustable frame rates and qualities.
- **Live Event Stream**: Emits `action:planned`, `step`, and `emotion` events showing real-time cursor paths, click coordinates, rage clicks, and dead clicks.

### 3. Deep Analytics & Heatmaps (2D & 3D)
- **Multi-Metric Evaluation**: Measures Task Success Rate, Average Frustration, CTA Miss Rate, Average Session Duration, and Drop-Off Funnels.
- **Interactive Heatmaps**: Filter clicks, dead clicks, rage clusters, and scroll depth across every visited screen.
- **Three.js 3D Surface Heatmaps**: Visualize friction intensity as 3D elevation topographies directly over captured webpage layouts.

### 4. Fix Emulator (Simulated Preview & Re-Test)
- **Non-Destructive Simulation**: All modifications are labeled as `"Simulated preview"` and applied strictly to temporary browser contexts — never touching the real website.
- **Draggable Before/After Slider**: Side-by-side or split slider view displaying original vs. patched DOM full-page screenshots.
- **Numbered Pins & Element Spotlighting**: Changed elements are pinned on the canvas; clicking a pin highlights its corresponding fix card and vice versa.
- **Selective Patching**: Toggle individual fixes on/off; screenshots update dynamically with loading shimmers.
- **Simulated Re-Testing**: Spawns a child run (`mode: "patched"`, `simulated: true`) that reinjects active fixes on every page navigation via `context.addInitScript()`.
- **Projected Impact Deltas**: Live comparison cards show projected metric shifts (e.g., Conversion $0\% \to 67\%$, Frustration $82 \to 31$) alongside persona emotion transitions (frustrated $\to$ happy).
- **Export & Code Generation**: One-click copy for CSS patches and downloadable markdown fix checklists with code snippets.

### 5. Security & Verification Engine
- **Strict Patch Whitelist**: Strict rejection of arbitrary JS execution, inline event handlers (`onclick`), external URLs, `<script>`, and `<iframe>` injections.
- **SSRF Defense**: Target URL validation blocking AWS/GCP/Azure IMDS metadata IPs (`169.254.169.254`) and unauthorized internal network ranges.
- **Ownership Verification**: Enforces domain ownership checks via `<meta name="personify-verify">` or `/personify-verify.txt` (with dev bypass for `localhost`).
- **Data Isolation**: Simulated runs are marked `simulated: true` and segregated from production usage totals and billing.

---

## 🛠 Architecture & Tech Stack

```
                          ┌────────────────────────┐
                          │   React 19 + Vite 8    │
                          │ TailwindCSS + Three.js │
                          └───────────┬────────────┘
                                      │ REST + WebSockets
                                      ▼
                          ┌────────────────────────┐
                          │   Node.js + Express 5  │
                          │   Socket.io + BullMQ   │
                          └─────┬────────────┬─────┘
                                │            │
                 ┌──────────────┴──────┐     └──────────────┐
                 ▼                     ▼                    ▼
     ┌──────────────────────┐ ┌─────────────────┐ ┌─────────────────┐
     │ Playwright + Chromium│ │ MongoDB Atlas   │ │ Redis (BullMQ)  │
     │ CDP Screencast & DOM │ │ Mongoose Models │ │ Async Simulation│
     └──────────┬───────────┘ └─────────────────┘ └─────────────────┘
                │
                ▼
     ┌──────────────────────┐
     │ OpenRouter / Gemini  │
     │ LLM Persona Brains   │
     └──────────────────────┘
```

| Domain | Technology |
|---|---|
| **Frontend UI** | React 19, Vite 8, Tailwind CSS, Framer Motion, Lucide Icons |
| **Data Visualization** | Recharts, Three.js (3D Heatmaps), Canvas 2D |
| **Backend API** | Node.js (ES Modules), Express 5, Socket.io |
| **Database & Cache** | MongoDB (Mongoose), Redis (ioredis / BullMQ) |
| **Browser Automation**| Playwright (Chromium), Chrome DevTools Protocol (CDP) |
| **Accessibility Engine** | axe-core + Custom Heuristic DOM Audit |
| **AI / LLM Providers** | OpenRouter (LLaMA 3.1 8B Instruct) / Google Gemini 1.5 Flash |

---

## 📂 Project Directory Structure

```
COER/
├── client/                      # React Frontend Application
│   ├── src/
│   │   ├── components/
│   │   │   ├── fix/             # Fix Emulator UI Components
│   │   │   │   ├── BeforeAfterSlider.jsx   # Draggable slider & numbered pins
│   │   │   │   ├── FixCard.jsx             # Fix card with code copy & avatars
│   │   │   │   ├── FixList.jsx             # Grouped severity checklist
│   │   │   │   └── RetestPanel.jsx         # Live re-test progress & deltas
│   │   │   ├── dashboard/       # Heatmaps, funnels & metric sparklines
│   │   │   ├── shell/           # Sidebar, topbar, app shell
│   │   │   └── ui/              # Buttons, cards, badges, modal dialogs
│   │   ├── pages/               # Top-level route pages (CompareRuns, Dashboard, etc.)
│   │   ├── services/            # API client layer (api.js) & Socket.io listeners
│   │   └── styles/              # Design system tokens (tokens.css) & Tailwind
│   ├── vite.config.js           # Reverse proxy configuration
│   └── package.json
│
├── server/                      # Express Backend Server
│   ├── src/
│   │   ├── config/              # MongoDB & Redis connections, subscription plans
│   │   ├── middleware/          # JWT auth, verifyOwnership, quota limits, error handler
│   │   ├── models/              # Mongoose schemas (Run, FixCache, Session, Step, User)
│   │   ├── routes/              # Express routers (runs.js, fixes.js, auth.js, personas.js)
│   │   ├── services/
│   │   │   ├── fixPatcher.js    # Strict patch whitelist validator & DOM builder
│   │   │   ├── fixGenerator.js  # Deterministic + LLM-assisted fix generator
│   │   │   ├── fixEmulator.js   # Playwright before/after screenshots & DOM injection
│   │   │   ├── pageAudit.js     # axe-core WCAG & DOM heuristic scanner
│   │   │   ├── aggregator.js    # Friction metrics, heatmaps, & funnel aggregators
│   │   │   └── llm.js           # OpenRouter & Gemini provider abstraction
│   │   ├── utils/               # SSRF security validators
│   │   └── workers/             # Agent execution engine & persona seeding
│   ├── scripts/                 # Test suites (testFixEmulator.js, testLiveFixEmulator.js)
│   └── package.json
│
├── demo-site/                   # Flawed E-Commerce Demo Application
│   ├── server.js                # Intentionally flawed test app on port 3456
│   └── package.json
│
└── README.md                    # Platform Documentation
```

---

## ⚙️ Prerequisites & Environment Setup

Ensure you have the following installed:
- **Node.js** v18.0.0 or higher
- **npm** v9.0.0 or higher
- **MongoDB** (Local instance or MongoDB Atlas URI)
- **Redis** *(Optional)* on `localhost:6379` (BullMQ operates in seamless inline fallback mode if offline)

---

### Backend Setup (`/server`)

1. Navigate to the server folder and install dependencies:
   ```bash
   cd server
   npm install
   ```

2. Initialize environment configuration:
   ```bash
   cp .env.example .env
   ```

3. Configure your `.env` variables:
   ```env
   # Server Configuration
   PORT=5000
   NODE_ENV=development
   CLIENT_ORIGIN=http://127.0.0.1:5173
   JWT_SECRET=your_jwt_secret_key_here
   ALLOW_UNVERIFIED_DEV=true

   # Databases
   MONGODB_URI=mongodb://127.0.0.1:27017/personify
   REDIS_URL=redis://127.0.0.1:6379

   # AI / LLM Configuration
   LLM_PROVIDER=openrouter
   OPENROUTER_API_KEY=your_openrouter_api_key
   OPENROUTER_MODEL=meta-llama/llama-3.1-8b-instruct

   # Simulation Concurrency
   AGENT_CONCURRENCY=3
   DEMO_URL=http://localhost:3456
   ```

4. Install Playwright browser binaries:
   ```bash
   npx playwright install chromium
   ```

5. Seed initial persona catalog:
   ```bash
   npm run seed
   ```

---

### Frontend Setup (`/client`)

1. Navigate to the client folder and install dependencies:
   ```bash
   cd ../client
   npm install
   ```

2. Ensure proxy configuration in `client/vite.config.js` routes to `http://127.0.0.1:5000`:
   ```javascript
   server: {
     port: 5173,
     proxy: {
       '/api': { target: 'http://127.0.0.1:5000', changeOrigin: true },
       '/screenshots': { target: 'http://127.0.0.1:5000', changeOrigin: true },
       '/socket.io': { target: 'http://127.0.0.1:5000', ws: true }
     }
   }
   ```

---

### Demo Site Setup (`/demo-site`)

The repository includes a deliberately flawed e-commerce store designed to exercise the platform's detection and fix capabilities:

```bash
cd ../demo-site
npm install
```

---

## 🚦 Running the Platform

For the full end-to-end experience, start all three services in separate terminal windows:

### Terminal 1: Backend Server
```bash
cd server
npm run dev
# Starts on http://localhost:5000
```

### Terminal 2: Frontend Client
```bash
cd client
npm run dev
# Starts on http://localhost:5173
```

### Terminal 3: Flawed Target Demo Site
```bash
cd demo-site
node server.js
# Starts on http://localhost:3456
```

Visit **`http://localhost:5173`** in your browser to log in, launch a test run on `http://localhost:3456`, and explore the **Fix Emulator** under the **Compare** tab.

---

## 🔍 Fix Emulator: Deep Dive

The **Fix Emulator** simulates website improvements directly within a sandboxed browser DOM and generates actionable suggestions.

```
                      Audit Violations & Friction Insights
                                       │
                                       ▼
                      ┌─────────────────────────────────┐
                      │        Fix Generator            │
                      │  Deterministic + LLM Copy Fixes │
                      └────────────────┬────────────────┘
                                       │
                                       ▼
                      ┌─────────────────────────────────┐
                      │    Strict Whitelist Validator   │
                      │   (Sanitizes Selectors/CSS/HTML)│
                      └────────────────┬────────────────┘
                                       │
                  ┌────────────────────┴────────────────────┐
                  ▼                                         ▼
     ┌────────────────────────┐                ┌────────────────────────┐
     │  Playwright Simulator  │                │   Patched Child Run    │
     │  Before / After Capture│                │  (mode: "patched")     │
     │  Pin Bounding Box Calc │                │  addInitScript Injection│
     └────────────┬───────────┘                └────────────┬───────────┘
                  │                                         │
                  ▼                                         ▼
     ┌────────────────────────┐                ┌────────────────────────┐
     │  Before/After Slider   │                │ Projected Improvement  │
     │  Numbered Pins Canvas  │                │ Metric & Emotion Delta │
     └────────────────────────┘                └────────────────────────┘
```

### Whitelisted Patch Operations
Only 8 strictly validated operations are permitted:

| Operation | Parameters | Description |
|---|---|---|
| `setStyle` | `selector`, `cssProps` | Injects valid CSS properties (color, fontSize, padding, background, etc.). Blocks `expression()` and `javascript:`. |
| `setText` | `selector`, `text` | Replaces confusing text or technical jargon with clear copy. |
| `setAttribute` | `selector`, `name`, `value` | Injects accessibility attributes (`aria-label`, `for`, `alt`, `role`, etc.). Restricts to safe attribute names. |
| `addLabel` | `selector`, `text` | Prepends an accessible, styled `<label>` element before unlabeled inputs. |
| `insertBefore` | `selector`, `html` | Injects sanitized HTML before an element. Rejects `<script>`, `<iframe>`, and external resources. |
| `insertAfter` | `selector`, `html` | Injects sanitized HTML after an element (e.g., inline error notices). |
| `reorderButton` | `selector` | Moves primary action buttons to standard dominant visual hierarchy. |
| `scrollIntoView`| `selector` | Ensures focal elements are brought into viewport view. |

### Deterministic & LLM Fix Generation
- **Font Size Fix**: Automatically bumps text under `12px` to `16px` with optimal line-height.
- **Contrast Correction**: Calculates text-to-background luminance and replaces low-contrast styling with high-contrast `#1C1C1E`.
- **Form Label Injection**: Identifies form fields with missing visible labels and generates explicit `<label>` bindings.
- **Touch Target Expansion**: Enforces WCAG 2.5.5 minimum sizing ($44 \times 44\text{px}$) on buttons and links.
- **Primary CTA Elevation**: Upgrades faint buttons into distinct `#6C63FF` primary actions.
- **Disabled State Remedy**: Reworks greyed-out submit buttons that cause abandonment.
- **Inline Error Regions**: Adds clear validation summaries to forms that fail silently.
- **LLM Content De-jargoning**: Analyzes live DOM text and translates technical jargon into clear consumer language.

### Interactive Before/After Slider & Pins
- **Split Slider**: Draggable handle comparing original against patched full-page screenshots.
- **Side-by-Side Mode**: Toggle between slider comparison and dual side-by-side viewport inspection.
- **Changes Only Filter**: Dims unmodified sections to spotlight patched areas.
- **Numbered Pins**: Element coordinates are plotted directly on the screenshot canvas with two-way highlight syncing with fix cards.

### Simulated Re-Test Engine
- **Child Run Creation**: Spawns an isolated test run linked to `parentRunId` with `mode: "patched"`.
- **Runtime Injection**: Compiles active patches into an init script injected on every document load (`page.addInitScript`).
- **Projected Impact Cards**: Displays before vs. after metrics:
  - Task Success Rate ($\Delta\%$)
  - Friction Index ($\Delta$)
  - CTA Miss Rate ($\Delta\%$)
  - Average Session Duration ($\Delta\text{s}$)
- **Persona Emotion Transition**: Shows affected personas shifting from frustrated frowns to satisfied smiles.

---

## 📡 API Reference

### Runs
- `POST /api/runs`: Create and launch a simulation run.
- `GET /api/runs`: List runs filtered by status or page.
- `GET /api/runs/:id`: Retrieve run metadata.
- `GET /api/runs/:id/report`: Get consolidated run analytics, sessions, steps, and heatmaps.
- `POST /api/runs/:id/verify-ownership`: Check domain verification token.

### Fix Emulator
- `GET /api/runs/:id/fixes`: Fetch or generate structured fix objects.
- `POST /api/runs/:id/fixes/preview`: Request before/after screenshots for enabled fixes.
- `POST /api/runs/:id/fixes/retest`: Launch simulated patched child run.
- `GET /api/runs/:id/fixes/export`: Download markdown fix checklist and unified CSS patch.

### Personas & Sessions
- `GET /api/personas`: List available AI personas.
- `GET /api/runs/:id/sessions`: Retrieve session recordings for a run.
- `GET /api/sessions/:id/steps`: Retrieve step-by-step action history.

---

## 🧪 Testing & Quality Assurance

Personify includes targeted unit, security, and live integration test suites:

### 1. Whitelist & Security Tests
Verifies that malicious injection vectors (script tags, external URLs, `javascript:` URLs, inline handlers) are rejected:
```bash
node server/scripts/testFixEmulator.js
```

### 2. Live Playwright DOM Integration Test
Launches Playwright against the local flawed demo site (`http://localhost:3456`), captures before/after screenshots, applies DOM patches, and validates computed styles:
```bash
node server/scripts/testLiveFixEmulator.js
```

### 3. Route & Health Tests
Validates all backend API endpoints against a running server:
```bash
npm --prefix server run test:routes
```

### 4. Client Production Build
Ensures zero build errors and verifies bundle optimization:
```bash
npm --prefix client run build
```

---

## 🛒 Deliberate UX Flaws Demo Site

The bundled demo store (`demo-site/server.js`) runs on port `3456` and simulates seven classic usability anti-patterns:

1. **Tiny CTA**: 9px font size with cream-on-white low-contrast text.
2. **Technical Jargon**: *"Initiate SKU Acquirement Workflow"* instead of *"Buy Now"*.
3. **Unlabeled Form Field**: Email field relying solely on vague placeholder text.
4. **Obscured Password Toggle**: Icon button with missing `aria-label`.
5. **Silent Form Validation**: Form resets on error with hidden error containers.
6. **Disabled-Looking Button**: Grey *"Proceed to Fulfilment Matrix"* checkout action.
7. **Aggressive Redirect**: Order confirmation page auto-redirects after 3 seconds without warning.

Use this demo site to test the entire audit, simulation, and Fix Emulator workflow.

---

## ❓ Troubleshooting & FAQ

#### `[vite] http proxy error: AggregateError [ECONNREFUSED]`
- **Cause**: The Vite frontend dev server is running, but the Express server on port 5000 is not yet started.
- **Fix**: Start the backend server (`cd server && npm run dev`). Ensure `client/vite.config.js` proxies to `http://127.0.0.1:5000`.

#### `Error: listen EADDRINUSE: address already in use :::5000`
- **Cause**: A previous Node process is already using port 5000.
- **Fix**: Identify and terminate the process holding port 5000:
  ```powershell
  # Windows PowerShell
  Stop-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess -Force
  ```

#### "Site ownership not verified" when previewing or re-testing
- **Cause**: The target website is not verified.
- **Fix**: For local development, set `ALLOW_UNVERIFIED_DEV=true` in `server/.env` or test against `localhost` / `127.0.0.1`. For external domains, add `<meta name="personify-verify" content="[token]">` to the target website.

#### "Preview not available for this page"
- **Cause**: The page relies on heavy WebGL/2D Canvas, multi-level cross-origin iframes, or closed Shadow DOMs.
- **Fix**: Full-page visual preview is disabled for untargetable canvas areas, but the structured code recommendations and CSS exports remain fully functional.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
