# Specification: Vertex AI Gemini Flex Mode Extension

- **Date:** 2026-10-18
- **Target App:** TauriTavern & SillyTavern
- **Extension Name:** `vertex-gemini-flex`
- **Output Artifacts:** `/root/fdgr/vertex-gemini-flex/` and `/root/fdgr/vertex-gemini-flex.zip`

---

## 1. Overview & Objectives

Google Cloud Vertex AI offers **Flex PayGo (Flex Inference)** for Gemini models, providing a **50% discount** on input and output token costs in exchange for best-effort latency and variable queuing.

Currently, TauriTavern and SillyTavern route Google Vertex AI requests through standard on-demand pricing. This extension provides seamless, non-destructive injection of Gemini Flex Mode into Vertex AI requests for both **Express Mode (API Key)** and **Full Mode (Service Account JSON)**, with live status monitoring in the API selection drawer.

### Key Objectives
1. **Cost Optimization:** Reduce Gemini inference costs on Vertex AI by 50% via automated HTTP header injection.
2. **Dual Auth Mode Support:** Function identically whether the user uses API Key (Express) or Service Account JSON (Full).
3. **Region Enforcement:** Automatically route requests to the required `locations/global` endpoint when Flex Mode is active.
4. **Model Safety:** Restrict Flex injection strictly to Gemini models, gracefully bypassing Claude-on-Vertex models.
5. **Contextual UI:** Display a live status card with quick-toggle directly in the Vertex AI API settings drawer (`#vertexai_form`) and in the extension settings tab.

---

## 2. Technical Specification

### 2.1 Google Vertex AI Flex Protocol Contract
- **Required Headers:**
  - `X-Vertex-AI-LLM-Request-Type`: `shared`
  - `X-Vertex-AI-LLM-Shared-Request-Type`: `flex` (or `priority` if priority tier is chosen)
- **Endpoint Constraint:**
  - Vertex AI Flex PayGo requires the `global` location endpoint (`https://aiplatform.googleapis.com/v1/projects/{project_id}/locations/global/...`).
  - Regional endpoints (e.g. `us-central1`, `europe-west4`) reject Flex headers.

### 2.2 TauriTavern Backend Forwarding Compatibility
In TauriTavern, the Rust backend handles `/api/backends/chat-completions/generate`:
- `dto.custom_include_headers` is parsed via `AdditionalParameters::from_status_headers`.
- Parsed headers are passed to `ChatCompletionApiConfig.additional_headers`.
- In `http_chat_completion_repository/vertexai.rs`, `apply_additional_headers` applies these headers to the outgoing `reqwest` HTTP request for both streaming (`send_gemini_stream_request`) and non-streaming calls.
- `dto.vertexai_region = "global"` directs the Rust backend to resolve the `aiplatform.googleapis.com/.../locations/global` endpoint.

---

## 3. Extension Architecture & File Layout

The extension is organized as a standalone third-party extension located at `/root/fdgr/vertex-gemini-flex`:

```
/root/fdgr/vertex-gemini-flex/
├── manifest.json        # Extension descriptor and metadata
├── index.js             # Core lifecycle, hooks, and UI controllers
├── settings.html        # Extension settings template
├── style.css            # Styles for status cards, badges, and toggle switches
└── README.md            # Installation and usage guide
```

### 3.1 `manifest.json`
```json
{
    "display_name": "Vertex AI Gemini Flex Mode",
    "loading_order": 50,
    "requires": [],
    "optional": [],
    "js": "index.js",
    "css": "style.css",
    "author": "TheUnawsomeGuy",
    "version": "1.0.0",
    "description": "Injects Gemini Flex Mode (Flex PayGo tier with 50% discount) into Google Vertex AI requests.",
    "homePage": "https://github.com/TheUnawsomeGuy/TauriTavern"
}
```

### 3.2 State Management & Settings Schema
Settings are namespaced under `extension_settings['vertex-gemini-flex']` and persisted using SillyTavern's `saveSettingsDebounced()`:

```typescript
interface VertexGeminiFlexSettings {
    enabled: boolean;              // Master toggle (default: true)
    tier: 'flex' | 'priority';     // Target service tier (default: 'flex')
    force_global_region: boolean;  // Automatically enforce 'global' region (default: true)
    show_api_selector_card: boolean; // Show card in API settings drawer (default: true)
}
```

---

## 4. Lifecycle & Request Injection Flow

```
[User Triggers Generation]
          │
          ▼
createGenerationParameters() (in openai.js)
          │
          ▼
emit(CHAT_COMPLETION_SETTINGS_READY, generate_data)
          │
          ▼
[vertex-gemini-flex Event Listener]
  ├─ Check 1: Is extension enabled?
  ├─ Check 2: Is chat_completion_source === 'vertexai'?
  ├─ Check 3: Is model a Gemini model (not Claude on Vertex)?
  │
  ├─ If YES:
  │   ├─ Set generate_data.vertexai_region = 'global' (if force_global_region)
  │   └─ Parse generate_data.custom_include_headers (JSON/YAML)
  │      Inject:
  │        "X-Vertex-AI-LLM-Request-Type": "shared"
  │        "X-Vertex-AI-LLM-Shared-Request-Type": settings.tier
  │      Serialize back to generate_data.custom_include_headers
  │
  └─ If NO: Pass through unmodified
          │
          ▼
fetch('/api/backends/chat-completions/generate', ...)
          │
          ▼
[TauriTavern Rust Backend]
  ├─ Applies custom_include_headers via apply_additional_headers()
  ├─ Routes to https://aiplatform.googleapis.com/.../locations/global
  └─ Dispatches to Vertex AI Gemini Flex Tier
```

### Secondary Guard (`window.fetch` Interceptor)
To ensure robustness against any direct generation invocation:
- Wraps `window.fetch` to check if request URL is `/api/backends/chat-completions/generate`.
- If request body contains `chat_completion_source === 'vertexai'` and a Gemini model, inspects and guarantees presence of Flex headers and `global` region if missing.

---

## 5. UI Integration

### 5.1 Contextual Card in API Selector Drawer
- **Insertion Point:** Injected into `#vertexai_form` directly beneath `#model_vertexai_select`.
- **Display States:**
  - 🟢 **Active:** Model is Gemini + Flex is enabled. Displays discount notification (`50% Token Discount Active`), tier indicator (`Flex PayGo`), and target location (`locations/global`).
  - ⚪ **Standby:** Model is Claude on Vertex (`claude-*`). Displays notice indicating Flex Mode is safely bypassed for Claude.
  - ⚪ **Disabled:** Extension is toggled off.
  - ⚠️ **Warning:** Active but `force_global_region` is off while manual region is not `global`.
- **Inline Controls:** Contains a quick-toggle switch directly in the card to enable/disable without switching tabs.

### 5.2 Extension Settings Panel
- Standard configuration view appended to `#extensions_settings` using `renderExtensionTemplateAsync('third-party/vertex-gemini-flex', 'settings')`.
- Full descriptions, links to Vertex AI Flex documentation, service tier selector, and region behavior toggles.

---

## 6. Verification Plan

1. **Static Validation:**
   - Verify `manifest.json` conforms to TauriTavern candidate preflight rules.
   - Verify zero unhandled exceptions on DOM insertion or event emission.
2. **Payload Injection Tests:**
   - Test `CHAT_COMPLETION_SETTINGS_READY` handler with `chat_completion_source: 'vertexai'` and `model: 'gemini-3.8-flash'`: verify headers and region.
   - Test with `model: 'claude-sonnet-4-5'`: verify no headers injected and region untouched.
   - Test with non-vertex source (e.g. `openai`): verify pass-through.
   - Test with existing custom headers: verify existing keys are preserved when merging.
   - Test `tier: 'priority'`: verify `X-Vertex-AI-LLM-Shared-Request-Type: priority`.
3. **Packaging:**
   - Package directory into `/root/fdgr/vertex-gemini-flex.zip`.
