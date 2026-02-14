# Agora 🏛️

AI vs AI debate arena. Watch Claude, Gemini, and ChatGPT debate each other in real-time.

## Why?

Sometimes two AIs debating can spark insights that neither would produce alone. Or at least it's entertaining to watch.

## Quick Start

```bash
# Install dependencies
npm install

# Run with default topic (Claude vs Gemini)
npm start

# Run with custom topic
npm start "静态类型 vs 动态类型哪个更适合大型项目"

# Choose any two services to debate
npm start "AI会取代程序员吗" claude chatgpt
npm start "AI会取代程序员吗" gemini chatgpt
```

Available services: `claude`, `gemini`, `chatgpt`

## How It Works

1. Spawns two Chrome windows (any two of Claude / Gemini / ChatGPT), connects via CDP after login
2. You log in manually (first time only - sessions are saved in `./profiles/`)
3. Press Enter to start
4. Both AIs receive the topic and state their opening positions (B's opening streams to A in real-time)
5. They debate back and forth with real-time streaming sync — each AI sees the other's response as it's being generated
6. Runs indefinitely (Ctrl+C to stop), transcript auto-saved to `./logs/` after each round

```
┌──────────────────┐      ┌──────────────────┐
│   Claude         │      │   Gemini         │
│   Browser        │      │   Browser        │
│                  │      │                  │
│   ┌──────────┐   │      │   ┌──────────┐   │
│   │          │   │ ───► │   │          │   │
│   │  Chat    │   │      │   │  Chat    │   │
│   │          │   │ ◄─── │   │          │   │
│   └──────────┘   │      │   └──────────┘   │
└──────────────────┘      └──────────────────┘
         │                         │
         └─────────┬───────────────┘
                   │
                   ▼
            ┌─────────────┐
            │   Agora     │
            │ Orchestrator│
            └─────────────┘
```

## Project Structure

```
agora/
├── src/
│   ├── index.js      # Entry point, Chrome launcher, service registry
│   ├── arena.js      # Debate orchestrator
│   ├── bridge.js     # Generic chat bridge (no service-specific selectors)
│   ├── claude.js     # Claude bridge
│   ├── gemini.js     # Gemini bridge
│   ├── chatgpt.js    # ChatGPT bridge
│   └── templates.js  # i18n moderator/turn prompt templates
├── profiles/         # Browser sessions (gitignored)
├── logs/             # Debate transcripts
└── package.json
```

## Adding More AI Services

The bridge uses generic DOM discovery — no service-specific CSS selectors needed. Just extend `ChatBridge`:

```javascript
import { ChatBridge } from './bridge.js'

export class NewServiceBridge extends ChatBridge {
  constructor(page) {
    super(page, {
      name: 'NewService',
      url: 'https://newservice.example.com',
    })
    this.useEnterToSubmit = true
  }
}
```

Then register it in `src/index.js`:

```javascript
const SERVICES = {
  // ...existing services
  newservice: { BridgeClass: NewServiceBridge, profileDir: './profiles/newservice', url: 'https://newservice.example.com' },
}
```

## Technical Journey

### Round 1: Playwright

The first attempt used Playwright to launch and control browsers. Problems:

- **Bot detection**. Playwright injects automation markers (`navigator.webdriver = true`, modified `Runtime.enable` domains, etc.) that Cloudflare and other bot-detection systems pick up immediately. Claude.ai and ChatGPT both blocked automated sessions on sight.
- **Session persistence**. Playwright's browser contexts don't map cleanly to real Chrome user-data directories. Cookies and login state were lost between runs, forcing re-login every time.

### Round 2: Puppeteer (launch mode)

Switched to `puppeteer.launch()` with `puppeteer-extra-plugin-stealth`. Better, but still not enough:

- **`puppeteer.launch()` still sets `--enable-automation`** and other flags that leak automation intent. Stealth plugin patches many signals but not all — Cloudflare's challenge page still detected it intermittently.
- **Service-specific CSS selectors**. Each AI service (Claude, Gemini, ChatGPT) has a different DOM structure for chat messages. Early versions hardcoded selectors like `.agent-turn .markdown` or `[data-message-author-role="assistant"]`. These broke every time a service updated their frontend.
- **Response detection by selector**. Used `isStillStreaming()` with service-specific selectors (e.g. `.result-streaming` for ChatGPT). Fragile — a single class name change breaks the entire flow.

### Round 3: spawn Chrome + `puppeteer.connect()` + generic DOM discovery (current)

The current architecture splits browser control into two phases:

**Phase 1 — Spawn a bare Chrome process** via `child_process.spawn()` with `--remote-debugging-port` and `--user-data-dir`. No Puppeteer, no automation flags. Chrome opens the AI service URL as a completely normal browser. The user logs in manually and passes any Cloudflare challenges.

**Phase 2 — Connect Puppeteer after login** via `puppeteer.connect({ browserURL })`. At this point the session is already authenticated. Puppeteer only provides the CDP bridge for DOM interaction — it never launched the browser, so no automation traces exist.

**Generic DOM discovery** replaces all service-specific selectors:

| Problem | Old approach | Current approach |
|---|---|---|
| Find chat input | Hardcoded `#prompt-textarea`, `div.ProseMirror` | Find the largest visible `[contenteditable="true"]` on page |
| Find response container | Hardcoded `.agent-turn`, `message-content` | Send a probe message, walk up from the deepest match to find the scrollable ancestor, then watch for new sibling nodes |
| Detect new responses | Service-specific `getResponseCount()` | Mark all existing children with `data-agora-seen`, any unmarked child is new |
| Detect streaming | Service-specific `isStillStreaming()` + polling selectors | Compare `extractResponse()` across two polls + detect visible stop/cancel buttons |
| Extract response text | Service-specific selectors | Multi-level extraction: Level 1 (container children), Level 2 (scroll container → wrapper → block), Level 3 (raw innerText fallback) |

Result: **zero service-specific CSS selectors**. Adding a new AI service is ~10 lines of code (see [Adding More AI Services](#adding-more-ai-services)).

### Pitfalls solved along the way

- **Gemini's Angular DOM replacement**. Gemini renders a `<pending-request>` placeholder that Angular replaces with the actual response node. A cached `ElementHandle` pointing to the placeholder becomes stale. Fixed by multi-level extraction that walks the live DOM tree instead of relying on a single cached node.
- **ElementHandle memory leak**. `page.evaluateHandle()` returns handles that must be `dispose()`d. The `findInput()` call runs every 300ms during `updateInput()` — without caching, handles accumulated until Node.js OOM-crashed at ~4GB after 15 minutes. Fixed by caching handles and disposing on replacement via `_setHandle()`.
- **Frame detachment**. Long-running debates (7+ rounds) occasionally trigger page re-renders that detach the main frame, crashing Puppeteer calls. Fixed with `resetDOM()` cleanup + `framenavigated` listener for proactive recovery.
- **macOS sleep**. Screen sleep suspends the Chrome process and breaks the CDP WebSocket connection. Fixed by spawning `caffeinate -dims` to prevent system sleep during debates.

## Caveats

- **ToS**: This automates web interfaces, which may violate terms of service. Use for personal experiments only.
- **Rate limits**: Don't run too many rounds or too frequently.

## License

MIT
