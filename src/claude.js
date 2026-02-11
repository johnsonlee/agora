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
      responseSelector: '[data-testid="message-content"], .prose',
    })
    this.useEnterToSubmit = true
  }

  async isStillStreaming() {
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
