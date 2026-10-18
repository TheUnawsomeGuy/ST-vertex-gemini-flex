# Vertex AI Gemini Flex Mode Extension

A lightweight, non-destructive extension for **TauriTavern** and **SillyTavern** that automatically injects Google Cloud Vertex AI's **Flex PayGo (Flex Inference)** service tier into Gemini generation requests, giving you a **50% discount on input and output token costs**.

---

## Features

- 💸 **50% Token Cost Discount:** Uses Google Vertex AI's Flex PayGo service tier for all Gemini models.
- ⚡ **Dual Auth Mode Support:**
  - **Express Mode:** Fully compatible with API Key + Project ID authentication.
  - **Full Mode:** Fully compatible with Service Account JSON OAuth2 authentication.
- 🌍 **Automatic Global Routing:** Automatically enforces the required `locations/global` endpoint for Flex PayGo without breaking regional settings.
- 🛡️ **Model Safety & Compatibility Guard:** Strictly targets Gemini models supporting Flex PayGo (such as `gemini-3.8-flash`, `gemini-3.7-flash`, `gemini-2.5-pro`, `gemini-1.5-flash`). Automatically bypasses Claude models and reasoning models (such as `gemini-4-argon`) where Google Vertex does not support Flex PayGo, ensuring calls continue cleanly without API errors.
- 🎛️ **API Selector Status Card:** Displays a live indicator badge and quick-toggle directly inside the **Vertex AI API settings form** beneath the Model dropdown.
- 🔀 **Tier Selection:** Easily switch between `Flex PayGo (flex)` (50% cheaper, best-effort latency) and `Priority Tier (priority)` (dedicated capacity).
- 🧩 **Preserves Custom Headers:** Non-destructively parses existing custom JSON/YAML headers before appending the Flex headers.

---

## Model Eligibility

Google Cloud Vertex AI only supports Flex PayGo (`X-Vertex-AI-LLM-Shared-Request-Type: flex`) on high-throughput standard and Flash models:
- **Supported:** `gemini-3.8-flash`, `gemini-3.7-flash`, `gemini-3.5-flash`, `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-1.5-flash`, `gemini-1.5-pro`.
- **Unsupported (Auto-Bypassed):** `gemini-4-argon` and frontier reasoning preview models.

When an unsupported model like `gemini-4-argon` is selected, the extension displays `[Unsupported]` in the status badge and gracefully passes requests through without injecting Flex headers, so your chat completion succeeds normally at standard rates instead of failing with `flex api is not supported for this model`.

---

## Installation

### Method 1: TauriTavern / SillyTavern Extensions UI (Zip)
1. In TauriTavern or SillyTavern, open **Extensions** (`Extensions` panel in top bar).
2. Install from file or extract `vertex-gemini-flex.zip` into your third-party extensions directory:
   - **TauriTavern / SillyTavern Third-Party Directory:** `data/default-user/extensions/vertex-gemini-flex/` or `data/extensions/third-party/vertex-gemini-flex/`
3. Reload or restart TauriTavern/SillyTavern.

### Method 2: Manual Directory Copy
```bash
cp -r /root/fdgr/vertex-gemini-flex /path/to/SillyTavern/data/default-user/extensions/
```

---

## How It Works

Google Vertex AI accepts standard HTTP headers to select the dynamic inference service tier:
```http
X-Vertex-AI-LLM-Request-Type: shared
X-Vertex-AI-LLM-Shared-Request-Type: flex
```
Flex PayGo requests require targeting `locations/global` (`https://aiplatform.googleapis.com/v1/projects/{project_id}/locations/global/...`).

This extension hooks into `CHAT_COMPLETION_SETTINGS_READY` and injects these headers into `custom_include_headers`, while adjusting `vertexai_region` to `global` when active.
