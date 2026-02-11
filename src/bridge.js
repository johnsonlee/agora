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
    try {
      const inputSelectors = this.inputSelector.split(', ')
      let input = null
      for (const sel of inputSelectors) {
        input = await this.page.$(sel)
        if (input) break
      }
      if (!input) return

      // Use execCommand for instant content setting (no char-by-char typing)
      await this.page.evaluate((el, t) => {
        el.focus()
        document.execCommand('selectAll', false, null)
        document.execCommand('insertText', false, t)
      }, input, text)

    } catch (e) {
      // Silently fail - streaming sync is optional
    }
  }

  /**
   * Send a message and stream response to target
   */
  async send(message) {
    console.log(`[${this.name}] Sending message...`)

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

    if (message != null) {
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
    }

    // Record response count before submitting
    this._responseCountBeforeSend = await this.getResponseCount()

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
    const maxWait = 120000
    const pollInterval = 300
    let elapsed = 0
    const beforeCount = this._responseCountBeforeSend || 0

    // Phase 1: Wait for new response to appear or streaming to start
    console.log(`[${this.name}] Waiting for new response (current count: ${beforeCount})...`)
    while (elapsed < maxWait) {
      const currentCount = await this.getResponseCount()
      const isStreaming = await this.isStillStreaming()

      if (currentCount > beforeCount || isStreaming) {
        console.log(`[${this.name}] New response detected (count: ${currentCount}, streaming: ${isStreaming})`)
        break
      }

      await this.delay(pollInterval)
      elapsed += pollInterval
    }

    if (elapsed >= maxWait) {
      console.warn(`[${this.name}] Timeout waiting for response to appear`)
      return ''
    }

    // Phase 2: Poll until streaming finishes, syncing content along the way
    let lastContent = ''
    while (elapsed < maxWait) {
      const currentContent = await this.extractResponse()
      const isStreaming = await this.isStillStreaming()

      // Stream new content to target
      if (currentContent !== lastContent && this.targetBridge) {
        await this.targetBridge.updateInput(currentContent)
        lastContent = currentContent
      }

      if (!isStreaming && currentContent.length > 0) {
        // Double-check: wait a bit and verify streaming really stopped
        await this.delay(500)
        const stillStreaming = await this.isStillStreaming()
        if (!stillStreaming) {
          const finalContent = await this.extractResponse()
          if (this.targetBridge) {
            await this.targetBridge.updateInput(finalContent)
          }
          return finalContent
        }
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

  /**
   * Get the current number of response elements (override in subclass)
   */
  async getResponseCount() {
    const elements = await this.page.$$(this.responseSelector)
    return elements.length
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
