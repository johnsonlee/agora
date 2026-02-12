import { ChatBridge } from './bridge.js'

/**
 * Bridge for claude.ai
 */
export class ClaudeBridge extends ChatBridge {
  constructor(page) {
    super(page, {
      name: 'Claude',
      inputSelector: '[data-testid="chat-input"], div[contenteditable="true"].ProseMirror',
      submitSelector: '',
      responseSelector: '.font-claude-response',
    })
    this.useEnterToSubmit = true
    this.lastResponseCount = 0
  }

  async isStillStreaming() {
    // Check for data-is-streaming attribute
    const streaming = await this.page.$('[data-is-streaming="true"]')
    if (streaming) {
      return true
    }
    
    // Check for stop button
    const stopButton = await this.page.$('button[aria-label="Stop generating"]')
    if (stopButton) {
      return true
    }

    return false
  }

  async waitForResponse() {
    // Record current count before waiting
    const beforeCount = (await this.page.$$('.font-claude-response')).length
    this.lastResponseCount = beforeCount
    
    // Wait for a new response to appear
    await this.delay(2000)
    
    const maxWait = 120000
    const pollInterval = 500
    let elapsed = 0

    while (elapsed < maxWait) {
      const currentCount = (await this.page.$$('.font-claude-response')).length
      const isStreaming = await this.isStillStreaming()
      
      // New response appeared and finished streaming
      if (currentCount > beforeCount && !isStreaming) {
        await this.delay(500)
        return
      }
      
      await this.delay(pollInterval)
      elapsed += pollInterval
    }

    console.warn(`[${this.name}] Response timeout`)
  }

  async getResponseCount() {
    return (await this.page.$$('.font-claude-response')).length
  }

  async extractResponse() {
    const elements = await this.page.$$('.font-claude-response')
    if (elements.length === 0) return ''

    const lastEl = elements[elements.length - 1]
    return await this.page.evaluate(el => {
      const markdown = el.querySelector('.standard-markdown, .progressive-markdown')
      return markdown ? markdown.innerText : el.innerText
    }, lastEl)
  }
}
