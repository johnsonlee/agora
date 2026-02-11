import { chromium } from 'playwright'
import { ClaudeBridge } from './claude.js'
import { GeminiBridge } from './gemini.js'
import { Arena } from './arena.js'

/**
 * Inject scripts to avoid bot detection
 */
async function injectAntiDetection(page) {
  await page.addInitScript(() => {
    // Remove webdriver property
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined
    })

    // Mock plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
        { name: 'Native Client', filename: 'internal-nacl-plugin' }
      ]
    })

    // Mock languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en', 'ko']
    })

    // Mock permissions
    const originalQuery = window.navigator.permissions.query
    window.navigator.permissions.query = (parameters) => (
      parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission })
        : originalQuery(parameters)
    )

    // Mock chrome runtime
    window.chrome = {
      runtime: {},
      loadTimes: function() {},
      csi: function() {},
      app: {}
    }

    // Remove automation-related properties
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol
  })
}

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
  channel: 'chrome',
  args: [
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-infobars',
    '--window-size=900,1000',
  ],
  ignoreDefaultArgs: [
    '--enable-automation',
    '--no-sandbox',
    '--disable-extensions',
  ],
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

  // Inject anti-detection scripts
  await injectAntiDetection(claudePage)
  await injectAntiDetection(geminiPage)

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
