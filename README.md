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

1. Opens two browser windows via Puppeteer (any two of Claude / Gemini / ChatGPT)
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

## Caveats

- **ToS**: This automates web interfaces, which may violate terms of service. Use for personal experiments only.
- **Rate limits**: Don't run too many rounds or too frequently.

## License

MIT
