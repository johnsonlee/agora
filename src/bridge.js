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
  }

  /**
   * Send a message and wait for response
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
      // Select all and delete
      document.execCommand('selectAll', false, null)
      document.execCommand('delete', false, null)
    }, input)

    // Type text line by line, using Shift+Enter for newlines
    const lines = message.split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]) {
        // Human-like typing speed: 50-100ms per character
        await input.type(lines[i], { delay: 75 })
      }
      if (i < lines.length - 1) {
        await this.delay(200)
        await this.page.keyboard.down('Shift')
        await this.page.keyboard.press('Enter')
        await this.page.keyboard.up('Shift')
      }
    }

    // Pause before sending, like a human reviewing
    await this.delay(1000)

    // Submit - either click button or press Enter
    if (this.useEnterToSubmit) {
      console.log(`[${this.name}] Pressing Enter to submit`)
      await this.page.keyboard.press('Enter')
    } else {
      const submitSelectors = this.submitSelector.split(', ')
      let submitBtn = null
      for (const sel of submitSelectors) {
        submitBtn = await this.page.$(sel)
        if (submitBtn) {
          console.log(`[${this.name}] Found submit button: ${sel}`)
          break
        }
      }

      if (!submitBtn) {
        throw new Error(`No submit button found for selectors: ${this.submitSelector}`)
      }

      await submitBtn.click()
    }

    // Wait for streaming to complete
    await this.waitForResponse()

    // Extract response
    const response = await this.extractResponse()
    console.log(`[${this.name}] Response received (${response.length} chars)`)

    // Pause 3-5 seconds like a human reading the response
    const thinkingTime = 3000 + Math.random() * 2000
    console.log(`[${this.name}] Pausing ${Math.round(thinkingTime/1000)}s before next turn...`)
    await this.delay(thinkingTime)

    return response
  }

  /**
   * Wait for AI to finish generating response
   */
  async waitForResponse() {
    // Wait for response to start
    await this.delay(2000)

    // Wait for streaming to finish (poll-based)
    const maxWait = 120000 // 2 minutes max
    const pollInterval = 500
    let elapsed = 0

    while (elapsed < maxWait) {
      const isStreaming = await this.isStillStreaming()
      if (!isStreaming) {
        // Extra buffer to ensure completion
        await this.delay(500)
        return
      }
      await this.delay(pollInterval)
      elapsed += pollInterval
    }

    console.warn(`[${this.name}] Response timeout after ${maxWait}ms`)
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
