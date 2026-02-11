import { ChatBridge } from './bridge.js'

/**
 * Bridge for claude.ai
 */
export class ClaudeBridge extends ChatBridge {
  constructor(page) {
    super(page, {
      name: 'Claude',
      inputSelector: 'div[contenteditable="true"].ProseMirror, div[contenteditable="true"]',
      submitSelector: 'button[aria-label="Send Message"], button[aria-label="Send message"], button[data-testid="send-button"], form button[type="submit"], button.send-button',
      responseSelector: '[data-testid="message-content"], .prose',
    })
  }

  async isStillStreaming() {
    // Claude shows a stop button while streaming
    const stopButton = await this.page.$('[data-testid="stop-button"], button[aria-label="Stop"]')
    return stopButton !== null
  }

  async extractResponse() {
    const selectors = ['[data-testid="message-content"]', '.prose', '.message-content']
    
    for (const selector of selectors) {
      const elements = await this.page.$$(selector)
      if (elements.length > 0) {
        const lastEl = elements[elements.length - 1]
        return await this.page.evaluate(el => el.innerText, lastEl)
      }
    }
    return ''
  }
}
