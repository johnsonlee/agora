import { ChatBridge } from './bridge.js'

/**
 * Bridge for claude.ai
 */
export class ClaudeBridge extends ChatBridge {
  constructor(page) {
    super(page, {
      name: 'Claude',
      inputSelector: 'div[contenteditable="true"].ProseMirror',
      submitSelector: 'button[aria-label="Send message"]',
      responseSelector: '[data-testid="message-content"]',
    })
  }

  async isStillStreaming() {
    // Claude shows a stop button while streaming
    const stopButton = await this.page.$('[data-testid="stop-button"]')
    return stopButton !== null
  }

  async extractResponse() {
    const elements = await this.page.$$('[data-testid="message-content"]')
    if (elements.length === 0) return ''

    const lastEl = elements[elements.length - 1]
    return await this.page.evaluate(el => el.innerText, lastEl)
  }
}
