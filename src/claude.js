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
      streamingIndicator: '[data-testid="stop-button"]'
    })
  }

  async isStillStreaming() {
    // Claude shows a stop button while streaming
    const stopButton = this.page.locator('[data-testid="stop-button"]')
    const count = await stopButton.count()
    return count > 0
  }

  async extractResponse() {
    // Claude's response structure
    const responses = this.page.locator('[data-testid="message-content"]')
    const count = await responses.count()
    if (count === 0) return ''

    // Get the last assistant message
    return await responses.nth(count - 1).innerText()
  }
}
