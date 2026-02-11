/**
 * Abstract bridge for interacting with AI chat interfaces
 */
export class ChatBridge {
  constructor(page, config) {
    this.page = page
    this.name = config.name
    this.inputSelector = config.inputSelector
    this.submitSelector = config.submitSelector
    this.responseSelector = config.responseSelector
    this.targetBridge = null  // The other AI to sync to
  }

  /**
   * Set the target bridge to sync streaming content to
   */
  setTargetBridge(bridge) {
    this.targetBridge = bridge
  }

  /**
   * Update input box with text (for receiving streamed content)
   */
  async updateInput(text) {
    const inputSelectors = this.inputSelector.split(', ')
    let input = null
    for (const sel of inputSelectors) {
      input = await this.page.$(sel)
      if (input) break
    }
    if (!input) return

    await this.page.evaluate((el, content) => {
      el.focus()
      // Convert newlines to <br> for contenteditable
      el.innerHTML = content.replace(/\n/g, '<br>')
      el.dispatchEvent(new InputEvent('input', { bubbles: true }))
    }, input, text)
  }

  /**
   * Send a message and stream response to target
   */
  async send(message) {
    console.log(`[${this.name}] Sending message...`)

    // Clear and type message
    const inputSelectors = this.inputSelector.split(', ')
    let input = null
    for (const sel of inputSelectors) {
      input = await this.page.$(sel)
      if (input) break
    }
    
    if (!input) {
      throw new Error(`No input element found for selectors: ${this.inputSelector}`)
    }

    await input.click()
    
    // Clear existing content
    await this.page.evaluate(el => {
      el.focus()
      document.execCommand('selectAll', false, null)
      document.execCommand('delete', false, null)
    }, input)

    // Type text line by line, using Shift+Enter for newlines
    const lines = message.split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]) {
        await input.type(lines[i], { delay: 30 })
      }
      if (i < lines.length - 1) {
        await this.delay(100)
        await this.page.keyboard.down('Shift')
        await this.page.keyboard.press('Enter')
        await this.page.keyboard.up('Shift')
      }
    }

    await this.delay(500)

    // Submit
    if (this.useEnterToSubmit) {
      await this.page.keyboard.press('Enter')
    }

    // Stream response to target while waiting
    const response = await this.waitAndStreamResponse()
    
    console.log(`[${this.name}] Response complete (${response.length} chars)`)

    // Pause 3-5 seconds like a human reading the response
    const thinkingTime = 3000 + Math.random() * 2000
    console.log(`[${this.name}] Pausing ${Math.round(thinkingTime/1000)}s before next turn...`)
    await this.delay(thinkingTime)

    return response
  }

  /**
   * Wait for response while streaming content to target bridge
   */
  async waitAndStreamResponse() {
    await this.delay(1500)  // Wait for response to start
    
    const maxWait = 120000
    const pollInterval = 300
    let elapsed = 0
    let lastContent = ''

    while (elapsed < maxWait) {
      const currentContent = await this.extractResponse()
      const isStreaming = await this.isStillStreaming()
      
      // Stream new content to target
      if (currentContent !== lastContent && this.targetBridge) {
        const prefix = `对方（${this.name}）正在说：\n\n"`
        const suffix = `"\n\n（等待对方说完...）`
        await this.targetBridge.updateInput(prefix + currentContent + suffix)
        lastContent = currentContent
      }
      
      if (!isStreaming && currentContent.length > 0) {
        await this.delay(500)
        // Clear target input and prepare final message
        if (this.targetBridge) {
          const finalPrompt = `对方（${this.name}）说：\n\n"${currentContent}"\n\n请回应，要求：\n1. 指出对方论证的漏洞或不足\n2. 给出你的反驳或补充观点\n3. 控制在 300 字以内\n4. 不要轻易同意对方`
          await this.targetBridge.updateInput(finalPrompt)
        }
        return currentContent
      }
      
      await this.delay(pollInterval)
      elapsed += pollInterval
    }

    console.warn(`[${this.name}] Response timeout`)
    return lastContent
  }

  /**
   * Check if AI is still generating (override in subclass)
   */
  async isStillStreaming() {
    return false
  }

  /**
   * Extract the latest response text (override in subclass)
   */
  async extractResponse() {
    const elements = await this.page.$$(this.responseSelector)
    if (elements.length === 0) return ''

    const lastEl = elements[elements.length - 1]
    return await this.page.evaluate(el => el.innerText, lastEl)
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
