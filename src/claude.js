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
      responseSelector: '.font-claude-response .standard-markdown',
    })
    this.useEnterToSubmit = true
  }

  async isStillStreaming() {
    // Check for data-is-streaming attribute
    const streaming = await this.page.$('[data-is-streaming="true"]')
    if (streaming) return true
    
    // Also check for stop button
    const stopButton = await this.page.$('[data-testid="stop-button"], button[aria-label="Stop"]')
    return stopButton !== null
  }

  async extractResponse() {
    const elements = await this.page.$$('.font-claude-response .standard-markdown')
    if (elements.length === 0) return ''

    const lastEl = elements[elements.length - 1]
    return await this.page.evaluate(el => el.innerText, lastEl)
  }
}
