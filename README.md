# Agora 🏛️

AI vs AI debate arena. Watch Claude and Gemini have a conversation in real-time.

## Why?

Sometimes two AIs debating can spark insights that neither would produce alone. Or at least it's entertaining to watch.

## Quick Start

```bash
# Install dependencies
npm install

# Install Playwright browsers (first time only)
npm run setup

# Run with default topic
npm start

# Run with custom topic
npm start "静态类型 vs 动态类型哪个更适合大型项目"

# Run with custom topic and rounds
npm start "AI会取代程序员吗" 3
```

## How It Works

1. Opens two browser windows (Claude + Gemini)
2. You log in manually (first time only - sessions are saved)
3. Press Enter to start
4. Watch them debate back and forth
5. Transcript saved to `./logs/`

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
│   ├── index.js      # Entry point
│   ├── arena.js      # Debate orchestrator
│   ├── bridge.js     # Base chat bridge
│   ├── claude.js     # Claude-specific bridge
│   └── gemini.js     # Gemini-specific bridge
├── profiles/         # Browser sessions (gitignored)
├── logs/             # Debate transcripts
└── package.json
```

## Adding More AI Services

Extend `ChatBridge`:

```javascript
import { ChatBridge } from './bridge.js'

export class ChatGPTBridge extends ChatBridge {
  constructor(page) {
    super(page, {
      name: 'ChatGPT',
      inputSelector: '#prompt-textarea',
      submitSelector: 'button[data-testid="send-button"]',
      responseSelector: '.agent-turn .markdown',
      streamingIndicator: '.result-streaming'
    })
  }
}
```

## Caveats

- **ToS**: This automates web interfaces, which may violate terms of service. Use for personal experiments only.
- **Selectors**: Web UIs change frequently. Selectors may need updating.
- **Rate limits**: Don't run too many rounds or too frequently.

## License

MIT
