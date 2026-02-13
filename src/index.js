import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { spawn } from 'child_process'
import { mkdirSync, existsSync } from 'fs'
import { resolve } from 'path'
import { ClaudeBridge } from './claude.js'
import { GeminiBridge } from './gemini.js'
import { ChatGPTBridge } from './chatgpt.js'
import { Arena } from './arena.js'

puppeteer.use(StealthPlugin())

// Service registry
const SERVICES = {
  claude:  { BridgeClass: ClaudeBridge,  profileDir: './profiles/claude',  url: 'https://claude.ai/new' },
  gemini:  { BridgeClass: GeminiBridge,  profileDir: './profiles/gemini',  url: 'https://gemini.google.com/app' },
  chatgpt: { BridgeClass: ChatGPTBridge, profileDir: './profiles/chatgpt', url: 'https://chatgpt.com' },
}

// Configuration
const topic = process.argv[2] || 'AI 会在未来 5 年内取代大部分软件工程师的工作'
const leftKey = (process.argv[3] || 'claude').toLowerCase()
const rightKey = (process.argv[4] || 'gemini').toLowerCase()

if (!SERVICES[leftKey]) {
  console.error(`Unknown service: ${leftKey}. Available: ${Object.keys(SERVICES).join(', ')}`)
  process.exit(1)
}
if (!SERVICES[rightKey]) {
  console.error(`Unknown service: ${rightKey}. Available: ${Object.keys(SERVICES).join(', ')}`)
  process.exit(1)
}
if (leftKey === rightKey) {
  console.error(`Cannot debate with itself. Choose two different services.`)
  process.exit(1)
}

function findChrome() {
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return null
}

let nextDebugPort = 9222

/**
 * Phase 1: Spawn a bare Chrome process with no CDP connection.
 * Chrome opens the service URL as a completely normal browser.
 */
function spawnChrome(serviceKey, windowPosition) {
  const service = SERVICES[serviceKey]
  const profileDir = resolve(service.profileDir)
  mkdirSync(profileDir, { recursive: true })

  const chromePath = findChrome()
  if (!chromePath) {
    throw new Error('Chrome not found. Install Google Chrome.')
  }

  const debugPort = nextDebugPort++

  const chromeProcess = spawn(chromePath, [
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profileDir}`,
    '--window-size=900,1000',
    `--window-position=${windowPosition}`,
    '--no-first-run',
    '--no-default-browser-check',
    service.url,
  ], {
    stdio: 'ignore',
    detached: false,
  })

  console.log(`Launched ${serviceKey} (port ${debugPort})`)
  return { serviceKey, debugPort, chromeProcess }
}

/**
 * Phase 2: Connect Puppeteer to an already-running Chrome.
 * Called AFTER the user has passed Cloudflare / logged in.
 */
async function connectAndSetup(serviceKey, debugPort) {
  const service = SERVICES[serviceKey]
  const browserURL = `http://127.0.0.1:${debugPort}`

  await waitForCDP(browserURL)

  const browser = await puppeteer.connect({ browserURL, defaultViewport: null })
  const pages = await browser.pages()
  const page = pages[0] || await browser.newPage()

  const bridge = new service.BridgeClass(page)
  return { browser, page, bridge }
}

async function waitForCDP(browserURL, timeoutMs = 10000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${browserURL}/json/version`)
      if (res.ok) return
    } catch {
      // not ready yet
    }
    await new Promise(r => setTimeout(r, 200))
  }
  throw new Error(`Chrome CDP not ready after ${timeoutMs}ms`)
}

async function main() {
  // Prevent macOS from sleeping during the debate
  const caffeinate = spawn('caffeinate', ['-dims'], { stdio: 'ignore', detached: true })
  caffeinate.unref()
  process.on('exit', () => caffeinate.kill())

  console.log('Starting Agora...')
  console.log(`Services: ${leftKey} vs ${rightKey}`)
  console.log('Launching browsers...\n')

  // Phase 1: Spawn Chrome processes — no CDP, no automation traces
  const leftChrome = spawnChrome(leftKey, '0,0')
  const rightChrome = spawnChrome(rightKey, '920,0')

  console.log('\n' + '─'.repeat(50))
  console.log('Please log in to both services if needed.')
  console.log('Pass any Cloudflare challenges, then press Enter...')
  console.log('─'.repeat(50) + '\n')

  await waitForEnter()

  // Phase 2: Now connect Puppeteer and inject interceptors
  console.log('Connecting to browsers...')
  const [left, right] = await Promise.all([
    connectAndSetup(leftKey, leftChrome.debugPort),
    connectAndSetup(rightKey, rightChrome.debugPort),
  ])

  mkdirSync('./logs', { recursive: true })
  const arena = new Arena(left.bridge, right.bridge, {
    logFile: `./logs/debate-${Date.now()}.json`
  })

  try {
    await arena.run(topic)
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

main().catch(console.error)
