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

## Model Eligibility: Google AI Studio vs Google Cloud Vertex AI

There is an important platform distinction between **Google AI Studio** (`ai.google.dev`) and **Google Cloud Vertex AI** (`cloud.google.com/vertex-ai`):

- **Google AI Studio (`ai.google.dev`):** Supports Flex inference for `gemini-4-argon` via the Gemini Developer API (`generativelanguage.googleapis.com`) using their Interactions API with `"service_tier": "flex"`.
- **Google Cloud Vertex AI (`cloud.google.com/vertex-ai`):** TauriTavern/SillyTavern's Vertex provider connects to Google Cloud's enterprise infrastructure (`aiplatform.googleapis.com`). Google Cloud's **Flex PayGo** service tier (`X-Vertex-AI-LLM-Shared-Request-Type: flex`) is currently only enabled on high-throughput Flash and standard 3.x/2.5 models (`gemini-3.8-flash`, `gemini-3.7-flash`, etc.). Vertex AI has not yet activated Flex PayGo for `gemini-4-argon` on their global endpoint, which is why Vertex AI rejects calls with `flex api is not supported for this model`.

### How the Extension Handles This

- **Automatic Bypass (Default):** The extension automatically detects when `gemini-4-argon` is selected on Vertex AI, shows `[Unsupported on Vertex]`, and safely bypasses Flex headers. This ensures chat completions with Argon continue seamlessly at standard rates rather than crashing.
- **Configurable Control:** In the extension settings, you can toggle **"Bypass Models Unsupported by Vertex Flex"**. If Google Cloud enables Vertex Flex PayGo for `gemini-4-argon` in the future, simply uncheck this option to route Argon through Flex immediately.

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
