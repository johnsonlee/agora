import { createRequire } from 'module'
import { buildTurnPrompt } from './templates.js'
const require = createRequire(import.meta.url)
const { name: APP_NAME } = require('../package.json')

/**
 * Abstract bridge for interacting with AI chat interfaces.
 *
 * Uses the first sent message (moderator prompt) to discover the chat
 * container in the DOM, then monitors responses generically — no
 * service-specific CSS selectors needed.
 */
export class ChatBridge {
  constructor(page, config) {
    this.page = page
    this.name = config.name
    this.url = config.url
    this.targetBridge = null
    this._container = null         // per-round extraction container (LCA)
    this._scrollContainer = null   // cached scrollable ancestor (persists across rounds)
    this._input = null             // cached input element
    this._branchIdx = -1           // first-round only: index of user message child

    // Forward only our own browser-side logs (prefixed with [APP_NAME])
    const prefix = `[${APP_NAME}] `
    this.page.on('console', msg => {
      const text = msg.text()
      if (msg.type() === 'log' && text.startsWith(prefix)) {
        console.log(`[${this.name}:browser] ${text.substring(prefix.length)}`)
      }
    })

    // Auto-reset DOM state on page navigation
    this.page.on('framenavigated', frame => {
      if (frame === this.page.mainFrame()) {
        console.log(`[${this.name}] Page navigated, resetting DOM state`)
        this.resetDOM()
      }
    })
  }

  /**
   * Find the main input element: the largest visible contenteditable.
   * Result is cached; cache is invalidated on page navigation (resetDOM).
   */
  async findInput() {
    if (this._input) {
      const valid = await this.page.evaluate(el => el && document.contains(el), this._input).catch(() => false)
      if (valid) return this._input
      this._input.dispose().catch(() => {})
      this._input = null
    }
    this._input = await this.page.evaluateHandle(() => {
      const candidates = document.querySelectorAll('[contenteditable="true"]')
      let best = null
      let bestArea = 0
      for (const el of candidates) {
        const rect = el.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) continue
        const area = rect.width * rect.height
        if (area > bestArea) {
          bestArea = area
          best = el
        }
      }
      return best
    })
    return this._input
  }

  // ── Container discovery ──

  /**
   * First-round discovery: use probe text to find the LCA container.
   * Caches _scrollContainer for subsequent rounds.
   */
  async _discoverContainerByProbe(sentText) {
    this._container = null
    this._branchIdx = -1

    const lines = sentText.split('\n').filter(l => l.trim())
    const probe = lines.reduce((a, b) => a.trim().length >= b.trim().length ? a : b).trim().substring(0, 60)
    console.log(`[${this.name}] First-round discovery with probe: "${probe}"`)

    for (let attempt = 0; attempt < 30; attempt++) {
      const handle = await this.page.evaluateHandle(async (probeText, appName) => {
        function findDeepest(el) {
          for (let i = el.children.length - 1; i >= 0; i--) {
            const child = el.children[i]
            if (child.hasAttribute('contenteditable')) continue
            if (child.innerText && child.innerText.includes(probeText)) {
              return findDeepest(child) || child
            }
          }
          return null
        }

        const messageEl = findDeepest(document.body)
        if (!messageEl) return null

        const levels = []
        let branch = messageEl
        while (branch.parentElement) {
          const parent = branch.parentElement
          if (parent === document.body || parent === document.documentElement) break
          const r = parent.getBoundingClientRect()
          if (r.width > 0 && r.height > 0) {
            levels.push({ parent, branch })
            const style = getComputedStyle(parent)
            if (style.overflowY === 'auto' || style.overflowY === 'scroll') break
          }
          branch = parent
        }

        if (levels.length === 0) return null
        console.log('[' + appName + '] Monitoring ' + levels.length + ' levels')

        const baseline = levels.map(({ parent, branch }) => {
          const siblings = Array.from(parent.children).filter(c => c !== branch)
          return { count: siblings.length, lens: siblings.map(s => (s.innerText || '').length) }
        })

        for (let round = 0; round < 30; round++) {
          await new Promise(r => setTimeout(r, 300))
          for (let i = 0; i < levels.length; i++) {
            const { parent, branch } = levels[i]
            const siblings = Array.from(parent.children).filter(c => c !== branch)
            const base = baseline[i]

            if (siblings.length > base.count) {
              const newSib = siblings[siblings.length - 1]
              if (!(newSib.innerText || '').includes(probeText)) {
                const branchIdx = Array.from(parent.children).indexOf(branch)
                parent.setAttribute('data-agora-branch', String(branchIdx))
                console.log('[' + appName + '] Container [' + i + ']: new child appeared')
                return parent
              }
            }

            for (let j = 0; j < base.lens.length && j < siblings.length; j++) {
              const growth = (siblings[j].innerText || '').length - base.lens[j]
              if (growth > 5 && !(siblings[j].innerText || '').includes(probeText)) {
                const branchIdx = Array.from(parent.children).indexOf(branch)
                parent.setAttribute('data-agora-branch', String(branchIdx))
                console.log('[' + appName + '] Container [' + i + ']: sibling grew by ' + growth)
                return parent
              }
            }
          }
        }
        return null
      }, probe, APP_NAME)

      if (handle.asElement()) {
        this._setHandle('_container', handle)
        this._branchIdx = await this.page.evaluate(el => {
          const idx = parseInt(el.getAttribute('data-agora-branch') || '-1')
          el.removeAttribute('data-agora-branch')
          return idx
        }, this._container)

        // Cache the scrollable ancestor
        const scrollHandle = await this.page.evaluateHandle(el => {
          let node = el.parentElement
          while (node && node !== document.body) {
            const style = getComputedStyle(node)
            if (style.overflowY === 'auto' || style.overflowY === 'scroll') return node
            node = node.parentElement
          }
          return null
        }, this._container)
        if (scrollHandle.asElement()) {
          this._setHandle('_scrollContainer', scrollHandle)
        } else {
          scrollHandle.dispose().catch(() => {})
        }

        const info = await this.page.evaluate(el => {
          const tag = el.outerHTML.substring(0, el.outerHTML.indexOf('>') + 1)
          return `${tag} children=${el.children.length}`
        }, this._container)
        console.log(`[${this.name}] Container discovered: ${info}`)
        return this._container
      }

      handle.dispose().catch(() => {})

      if (attempt % 5 === 0) {
        const found = await this.page.evaluate(p => document.body.innerText.includes(p), probe)
        console.log(`[${this.name}] Probe search attempt ${attempt + 1}/30, in page: ${found}`)
      }
      await this.delay(500)
    }

    console.warn(`[${this.name}] Could not discover container`)
    return null
  }

  /**
   * Subsequent-round discovery: find new (unmarked) content.
   *
   * Check 1: existing _container has new unmarked children → reuse (Claude-style flat list)
   * Check 2: _scrollContainer has new unmarked child → new per-round wrapper (Gemini-style)
   */
  async _discoverByMarks() {
    console.log(`[${this.name}] Discovering container by marks...`)

    for (let attempt = 0; attempt < 60; attempt++) {
      // Check 1: new per-round wrapper in scroll container (Gemini-style)
      // Prioritized — avoids false positives from lazy-loaded UI in old container
      if (this._scrollContainer) {
        const handle = await this.page.evaluateHandle(scrollEl => {
          for (let i = scrollEl.children.length - 1; i >= 0; i--) {
            const child = scrollEl.children[i]
            if (child.hasAttribute('data-agora-seen')) continue
            const r = child.getBoundingClientRect()
            if (r.width > 0 && r.height > 0 && child.children.length > 0) return child
          }
          return null
        }, this._scrollContainer)

        if (handle.asElement()) {
          this._setHandle('_container', handle)
          this._branchIdx = -1
          const info = await this.page.evaluate(el => {
            const tag = el.outerHTML.substring(0, el.outerHTML.indexOf('>') + 1)
            return `${tag} children=${el.children.length}`
          }, this._container)
          console.log(`[${this.name}] New container by marks: ${info}`)
          return this._container
        }
        handle.dispose().catch(() => {})
      }

      // Check 2: reuse existing container (flat structure like Claude)
      if (this._container) {
        const hasNew = await this.page.evaluate(el => {
          for (let i = el.children.length - 1; i >= 0; i--) {
            const child = el.children[i]
            if (child.hasAttribute('data-agora-seen')) continue
            const r = child.getBoundingClientRect()
            if (r.width > 0 && r.height > 0) return true
          }
          return false
        }, this._container)

        if (hasNew) {
          this._branchIdx = -1
          console.log(`[${this.name}] Container reused (new unmarked children)`)
          return this._container
        }
      }

      await this.delay(300)
    }

    console.warn(`[${this.name}] Could not discover container by marks`)
    return null
  }

  // ── Response monitoring ──

  /**
   * Extract the latest AI response by checking multiple levels:
   *   Level 1: _container's children (Claude-style flat message list)
   *   Level 2: _scrollContainer's children → their children (Gemini-style per-round wrappers)
   *
   * This avoids depending on a single cached node — if Gemini replaces
   * <pending-request> with a new node, Level 2 dynamically finds it.
   */
  async extractResponse() {
    const container = this._container || null
    const scroll = this._scrollContainer || null
    if (!container && !scroll) return ''

    const skip = this._branchIdx ?? -1
    return await this.page.evaluate((containerEl, scrollEl, skipIdx) => {

      function getVisibleText(node) {
        const hidden = new Set()
        node.querySelectorAll('*').forEach(el => {
          const r = el.getBoundingClientRect()
          if (r.width <= 1 && r.height <= 1 && r.width + r.height > 0) hidden.add(el)
        })
        if (hidden.size === 0) return (node.innerText || '').trim()

        const tainted = new Set()
        for (const h of hidden) {
          let p = h.parentElement
          while (p && p !== node) { tainted.add(p); p = p.parentElement }
        }
        tainted.add(node)

        function extract(el) {
          if (hidden.has(el)) return ''
          if (!tainted.has(el)) return el.innerText || ''
          let text = ''
          for (const child of el.childNodes) {
            if (child.nodeType === 3) text += child.textContent
            else if (child.nodeType === 1) text += extract(child)
          }
          return text
        }
        return extract(node).trim()
      }

      function isVisible(el) {
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) return false
        const s = getComputedStyle(el)
        return s.display !== 'none' && s.visibility !== 'hidden'
      }

      // Level 1: container's direct children (Claude-style)
      if (containerEl && document.contains(containerEl) && containerEl.children.length > 0) {
        for (let i = containerEl.children.length - 1; i >= 0; i--) {
          if (i === skipIdx) continue
          const child = containerEl.children[i]
          if (child.hasAttribute('data-agora-seen')) continue
          if (!isVisible(child)) continue
          const text = getVisibleText(child)
          if (text) return text
        }
      }

      // Level 2: scroll container → wrapper → block children (Gemini-style)
      // Walks ALL non-marked children, even if Level 1 already checked containerEl
      // (Angular may replace/re-render children between checks)
      if (scrollEl) {
        for (let i = scrollEl.children.length - 1; i >= 0; i--) {
          const wrapper = scrollEl.children[i]
          if (wrapper.hasAttribute('data-agora-seen')) continue
          if (!isVisible(wrapper)) continue

          for (let j = wrapper.children.length - 1; j >= 0; j--) {
            const block = wrapper.children[j]
            if (!isVisible(block)) continue
            const text = getVisibleText(block)
            if (text) return text
          }
        }
      }

      // Level 3: raw innerText of non-marked scroll children (last resort,
      // skips all visibility/hidden-text filtering)
      if (scrollEl) {
        for (let i = scrollEl.children.length - 1; i >= 0; i--) {
          const wrapper = scrollEl.children[i]
          if (wrapper.hasAttribute('data-agora-seen')) continue
          const text = (wrapper.innerText || '').trim()
          if (text) return text
        }
      }

      return ''
    }, container, scroll, skip)
  }

  async isStillStreaming() {
    const text1 = await this.extractResponse()
    await this.delay(400)
    const text2 = await this.extractResponse()
    return text1 !== text2
  }

  /**
   * Check if the AI is still processing (including thinking).
   * Detects visible stop/cancel buttons that AI chat UIs show during generation.
   */
  async _isAIProcessing() {
    return await this.page.evaluate(() => {
      const btns = document.querySelectorAll('button, [role="button"]')
      for (const btn of btns) {
        const rect = btn.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) continue
        const style = getComputedStyle(btn)
        if (style.display === 'none' || style.visibility === 'hidden') continue
        const label = (btn.getAttribute('aria-label') || '').toLowerCase()
        const text = (btn.textContent || '').toLowerCase().trim()
        if (label.includes('stop') || text === 'stop' || text === '停止') {
          return true
        }
      }
      return false
    })
  }

  // ── Input / submit ──

  setTargetBridge(bridge) {
    this.targetBridge = bridge
  }

  async updateInput(text) {
    if (this._updating) return
    this._updating = true
    try {
      const input = await this.findInput()
      if (!input) return

      await this.page.evaluate((el, newText) => {
        el.focus()
        document.execCommand('selectAll', false, null)
        document.execCommand('insertText', false, newText)
      }, input, text)
      this._lastSyncedText = text
    } catch (e) {
      console.log(`[${this.name}] updateInput failed: ${e.message}`)
    } finally {
      this._updating = false
    }
  }

  async send(message) {
    console.log(`[${this.name}] Sending message...`)

    const input = await this.findInput()
    if (!input) {
      throw new Error('No contenteditable input found on page')
    }

    await input.click()

    const text = message != null ? message : this._lastSyncedText
    if (!text || !text.trim()) {
      throw new Error('No content to send')
    }

    // Clear existing content
    await this.page.evaluate(el => {
      el.focus()
      document.execCommand('selectAll', false, null)
      document.execCommand('delete', false, null)
    }, input)

    // Type text line by line
    const lines = text.split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]) {
        await input.type(lines[i], { delay: 0 })
      }
      if (i < lines.length - 1) {
        await this.page.keyboard.down('Shift')
        await this.page.keyboard.press('Enter')
        await this.page.keyboard.up('Shift')
      }
    }

    await this.delay(500)

    // Mark all existing content BEFORE submitting — only new content will be unmarked
    await this._markSeen()

    // Submit
    if (this.useEnterToSubmit) {
      await this.page.keyboard.press('Enter')
    }

    // Discover the container for this round
    await this.delay(1000)
    if (this._scrollContainer) {
      await this._discoverByMarks()
    } else {
      await this._discoverContainerByProbe(text)
    }

    // Snapshot baseline right after container discovery
    const baseline = await this.extractResponse()

    const response = await this.waitAndStreamResponse(baseline)

    // Mark seen for next round
    await this._markSeen()

    console.log(`[${this.name}] Response complete (${response.length} chars)`)
    await this.delay(1500)

    return response
  }

  async waitAndStreamResponse(baseline = '') {
    const maxWait = 120000
    const pollInterval = 300
    let elapsed = 0

    // Phase 1: wait for any signal that the AI has started responding
    console.log(`[${this.name}] Waiting for response (baseline: ${baseline ? baseline.length + ' chars' : 'empty'})...`)
    while (elapsed < maxWait) {
      const content = await this.extractResponse()

      // Content exists and differs from baseline (user message) → AI response detected
      if (content && content !== baseline) {
        console.log(`[${this.name}] Response detected (${content.length} chars)`)
        break
      }

      const aiProcessing = await this._isAIProcessing()

      // Stop button visible → AI is actively working, move to Phase 2
      // (wait at least 2s to avoid catching the previous round's stop button)
      if (aiProcessing && elapsed > 2000) {
        console.log(`[${this.name}] AI processing detected, entering Phase 2`)
        break
      }

      // Periodic diagnostic logging
      if (elapsed > 0 && elapsed % 5000 < pollInterval) {
        console.log(`[${this.name}] Phase 1: content=${content ? content.length + ' chars' : 'empty'}, aiProcessing=${aiProcessing}, elapsed=${Math.round(elapsed / 1000)}s`)
      }

      // Content exists but same as baseline, AI not processing → might be done already
      if (content && !aiProcessing && elapsed > 5000) {
        console.log(`[${this.name}] Response unchanged, AI not processing — accepting`)
        break
      }

      // General Phase 1 timeout — fall through to Phase 2
      if (elapsed > 20000) {
        console.log(`[${this.name}] Phase 1 timeout, entering Phase 2`)
        break
      }

      await this.delay(pollInterval)
      elapsed += pollInterval
    }

    if (elapsed >= maxWait) {
      console.warn(`[${this.name}] Timeout waiting for response`)
      return ''
    }

    // Phase 2: poll until content stops changing, syncing to target
    let lastContent = ''
    while (elapsed < maxWait) {
      await this._scrollToBottom()

      const currentContent = await this.extractResponse()
      const streaming = await this.isStillStreaming()

      if (currentContent !== lastContent && this.targetBridge) {
        await this.targetBridge.updateInput(`${this.name}:\n\n${currentContent}`)
        lastContent = currentContent
      }

      if (!streaming && currentContent.length > 0) {
        // AI still processing (e.g. thinking) — keep waiting
        if (await this._isAIProcessing()) {
          await this.delay(pollInterval)
          elapsed += pollInterval
          continue
        }

        // Confirm response is truly done
        let settled = true
        for (let c = 0; c < 3; c++) {
          await this.delay(1500)
          if (await this.isStillStreaming() || await this._isAIProcessing()) {
            settled = false
            break
          }
        }
        if (settled) {
          const finalContent = await this.extractResponse()
          if (this.targetBridge) {
            const turnPrompt = buildTurnPrompt(this.targetBridge.name)
            await this.targetBridge.updateInput(`${this.name}:\n\n${finalContent}${turnPrompt}`)
          }
          return finalContent
        }
      }

      await this.delay(pollInterval)
      elapsed += pollInterval
    }

    console.warn(`[${this.name}] Response timeout`)
    if (lastContent && this.targetBridge) {
      const turnPrompt = buildTurnPrompt(this.targetBridge.name)
      await this.targetBridge.updateInput(`${this.name}:\n\n${lastContent}${turnPrompt}`)
    }
    return lastContent
  }

  resetDOM() {
    this._container?.dispose().catch(() => {})
    this._scrollContainer?.dispose().catch(() => {})
    this._input?.dispose().catch(() => {})
    this._container = null
    this._scrollContainer = null
    this._input = null
    this._branchIdx = -1
  }

  _setHandle(field, handle) {
    if (this[field] && this[field] !== handle) {
      this[field].dispose().catch(() => {})
    }
    this[field] = handle
  }

  async _markSeen() {
    if (this._container) {
      await this.page.evaluate(el => {
        if (!el) return
        for (const child of el.children) {
          child.setAttribute('data-agora-seen', '1')
        }
      }, this._container)
    }
    if (this._scrollContainer) {
      await this.page.evaluate(el => {
        if (!el) return
        for (const child of el.children) {
          child.setAttribute('data-agora-seen', '1')
        }
      }, this._scrollContainer)
    }
  }

  async _scrollToBottom() {
    const el = this._scrollContainer || this._container
    if (!el) return
    await this.page.evaluate(el => {
      if (!el) return
      el.scrollTop = el.scrollHeight
    }, el)
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
