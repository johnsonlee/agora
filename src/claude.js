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
    if (streaming) {
      console.log('[Claude] Still streaming (data-is-streaming=true)')
      return true
    }
    
    // Check for stop button
    const stopButton = await this.page.$('button[aria-label="Stop generating"]')
    if (stopButton) {
      console.log('[Claude] Still streaming (stop button visible)')
      return true
    }

    return false
  }

  async extractResponse() {
    // Wait a bit for DOM to settle
    await this.delay(500)
    
    // Get all message groups - assistant messages have font-claude-response
    const elements = await this.page.$$('.font-claude-response')
    console.log(`[Claude] Found ${elements.length} assistant response containers`)
    
    if (elements.length === 0) {
      return ''
    }

    // Get the last assistant message
    const lastEl = elements[elements.length - 1]
    
    // Extract text from the markdown content inside
    const text = await this.page.evaluate(el => {
      const markdown = el.querySelector('.standard-markdown, .progressive-markdown')
      return markdown ? markdown.innerText : el.innerText
    }, lastEl)
    
    console.log(`[Claude] Extracted ${text.length} chars: "${text.substring(0, 50)}..."`)
    return text
  }
}
