import { chromium } from 'playwright'
import { ClaudeBridge } from './claude.js'
import { GeminiBridge } from './gemini.js'
import { Arena } from './arena.js'

// Configuration
const CONFIG = {
  topic: process.argv[2] || 'AI 会在未来 5 年内取代大部分软件工程师的工作',
  rounds: parseInt(process.argv[3]) || 5,
  slowMo: 50,  // ms between actions
}

// Realistic browser settings to avoid bot detection
const BROWSER_OPTIONS = {
  headless: false,
  viewport: { width: 900, height: 1000 },
  slowMo: CONFIG.slowMo,
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  locale: 'en-US',
  timezoneId: 'Asia/Seoul',
  args: [
    '--disable-blink-features=AutomationControlled',
    '--disable-features=IsolateOrigins,site-per-process',
    '--no-first-run',
    '--no-default-browser-check',
  ],
  ignoreDefaultArgs: ['--enable-automation'],
}

async function main() {
  console.log('Starting Agora...')
  console.log('Launching browsers...\n')

  // Launch two separate browser windows
  const claudeBrowser = await chromium.launchPersistentContext('./profiles/claude', {
    ...BROWSER_OPTIONS,
  })

  const geminiBrowser = await chromium.launchPersistentContext('./profiles/gemini', {
    ...BROWSER_OPTIONS,
  })

  // Get pages
  const claudePage = claudeBrowser.pages()[0] || await claudeBrowser.newPage()
  const geminiPage = geminiBrowser.pages()[0] || await geminiBrowser.newPage()

  // Navigate to chat interfaces
  console.log('Opening Claude...')
  await claudePage.goto('https://claude.ai/new')

  console.log('Opening Gemini...')
  await geminiPage.goto('https://gemini.google.com/app')

  // Check if login is needed
  console.log('\n' + '─'.repeat(50))
  console.log('Please log in to both services if needed.')
  console.log('Press Enter when ready to start the debate...')
  console.log('─'.repeat(50) + '\n')

  // Wait for user to press Enter
  await waitForEnter()

  // Create bridges
  const claude = new ClaudeBridge(claudePage)
  const gemini = new GeminiBridge(geminiPage)

  // Create arena
  const arena = new Arena(claude, gemini, {
    maxRounds: CONFIG.rounds,
    logFile: `./logs/debate-${Date.now()}.json`
  })

  // Run debate
  try {
    await arena.run(CONFIG.topic)
  } catch (err) {
    console.error('Error during debate:', err)
  }

  console.log('\nDebate finished. Browsers will remain open.')
  console.log('Press Ctrl+C to exit.')
}

function waitForEnter() {
  return new Promise(resolve => {
    process.stdin.once('data', () => resolve())
  })
}

// Ensure logs directory exists
import { mkdirSync } from 'fs'
try {
  mkdirSync('./logs', { recursive: true })
} catch {}

main().catch(console.error)
