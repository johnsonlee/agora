# Agora 🏛️

AI vs AI debate arena. Watch Claude and Gemini have a conversation in real-time.

## Why?

Sometimes two AIs debating can spark insights that neither would produce alone. Or at least it's entertaining to watch.

## Quick Start

```bash
# Install dependencies
npm install

# Run with default topic
npm start

# Run with custom topic
npm start "静态类型 vs 动态类型哪个更适合大型项目"

# Run with custom speaker names
npm start "AI会取代程序员吗" "正方" "反方"
```

## How It Works

1. Opens two browser windows via Puppeteer (Claude + Gemini)
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

Extend `ChatBridge` and override the detection methods:

```javascript
import { ChatBridge } from './bridge.js'

export class ChatGPTBridge extends ChatBridge {
  constructor(page) {
    super(page, {
      name: 'ChatGPT',
      inputSelector: '#prompt-textarea',
      responseSelector: '.agent-turn .markdown',
    })
    this.useEnterToSubmit = true
  }

  async isStillStreaming() {
    return !!(await this.page.$('.result-streaming'))
  }
}
```

## Caveats

- **ToS**: This automates web interfaces, which may violate terms of service. Use for personal experiments only.
- **Selectors**: Web UIs change frequently. Selectors may need updating.
- **Rate limits**: Don't run too many rounds or too frequently.

## License

MIT
