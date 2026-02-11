import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { ClaudeBridge } from './claude.js'
import { GeminiBridge } from './gemini.js'
import { Arena } from './arena.js'
import { mkdirSync } from 'fs'

// Enable stealth plugin
puppeteer.use(StealthPlugin())

// Configuration
const CONFIG = {
  topic: process.argv[2] || 'AI 会在未来 5 年内取代大部分软件工程师的工作',
  rounds: parseInt(process.argv[3]) || 5,
}

async function main() {
  console.log('Starting Agora...')
  console.log('Launching browsers...\n')

  // Ensure profile directories exist
  mkdirSync('./profiles/claude', { recursive: true })
  mkdirSync('./profiles/gemini', { recursive: true })

  // Launch two separate browser windows with stealth
  const claudeBrowser = await puppeteer.launch({
    headless: false,
    userDataDir: './profiles/claude',
    args: [
      '--window-size=900,1000',
      '--window-position=0,0',
    ],
  })

  const geminiBrowser = await puppeteer.launch({
    headless: false,
    userDataDir: './profiles/gemini',
    args: [
      '--window-size=900,1000',
      '--window-position=920,0',
    ],
  })

  // Get pages
  const claudePage = (await claudeBrowser.pages())[0]
  const geminiPage = (await geminiBrowser.pages())[0]

  // Navigate to chat interfaces
  console.log('Opening Claude...')
  await claudePage.goto('https://claude.ai/new', { waitUntil: 'networkidle2' })

  console.log('Opening Gemini...')
  await geminiPage.goto('https://gemini.google.com/app', { waitUntil: 'networkidle2' })

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
  mkdirSync('./logs', { recursive: true })
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

main().catch(console.error)
