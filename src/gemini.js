import { ChatBridge } from './bridge.js'

/**
 * Bridge for gemini.google.com
 */
export class GeminiBridge extends ChatBridge {
  constructor(page) {
    super(page, {
      name: 'Gemini',
      inputSelector: 'rich-textarea .ql-editor, div[contenteditable="true"]',
      submitSelector: 'button[aria-label="Send message"], button.send-button, button[data-test-id="send-button"]',
      responseSelector: '.response-content, .model-response-text, message-content',
      streamingIndicator: null
    })
  }

  async isStillStreaming() {
    // Gemini: check if there's a loading indicator or cursor
    const loading = this.page.locator('.loading-indicator, .thinking-indicator, mat-progress-bar')
    const count = await loading.count()
    if (count > 0) return true

    // Also check if content is still changing
    const response = await this.extractResponse()
    await this.page.waitForTimeout(300)
    const response2 = await this.extractResponse()

    return response !== response2
  }

  async extractResponse() {
    // Try multiple possible selectors for Gemini
    const selectors = [
      'message-content.model-response-text',
      '.response-content',
      '.model-response-text',
      '[data-message-author="model"]'
    ]

    for (const selector of selectors) {
      const responses = this.page.locator(selector)
      const count = await responses.count()
      if (count > 0) {
        return await responses.nth(count - 1).innerText()
      }
    }

    return ''
  }
}
