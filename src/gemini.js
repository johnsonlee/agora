import { ChatBridge } from './bridge.js'

/**
 * Bridge for gemini.google.com
 */
export class GeminiBridge extends ChatBridge {
  constructor(page) {
    super(page, {
      name: 'Gemini',
      inputSelector: '.ql-editor[contenteditable="true"], rich-textarea .ql-editor',
      submitSelector: null,  // Use Enter key
      responseSelector: '.response-content, .model-response-text, message-content',
    })
    this.useEnterToSubmit = true
  }

  async isStillStreaming() {
    // Check if there's a loading indicator
    const loading = await this.page.$('.loading-indicator, .thinking-indicator, mat-progress-bar')
    if (loading) return true

    // Also check if content is still changing
    const response = await this.extractResponse()
    await this.delay(300)
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
      const elements = await this.page.$$(selector)
      if (elements.length > 0) {
        const lastEl = elements[elements.length - 1]
        let text = await this.page.evaluate(el => el.innerText, lastEl)
        
        // Remove "Gemini said" prefix if present
        text = text.replace(/^Gemini said\n*/i, '').trim()
        
        console.log(`[Gemini] Extracted: "${text.substring(0, 80)}..."`)
        return text
      }
    }

    return ''
  }
}
