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
    this.streamingIndicator = config.streamingIndicator
  }

  /**
   * Send a message and wait for response
   */
  async send(message) {
    console.log(`[${this.name}] Sending message...`)

    // Clear and type message
    const input = this.page.locator(this.inputSelector)
    await input.click()
    await input.fill(message)

    // Small delay to seem human
    await this.page.waitForTimeout(300)

    // Submit
    await this.page.locator(this.submitSelector).click()

    // Wait for streaming to complete
    await this.waitForResponse()

    // Extract response
    const response = await this.extractResponse()
    console.log(`[${this.name}] Response received (${response.length} chars)`)

    return response
  }

  /**
   * Wait for AI to finish generating response
   */
  async waitForResponse() {
    // Wait for response to start
    await this.page.waitForTimeout(1000)

    // Wait for streaming to finish (poll-based)
    const maxWait = 120000 // 2 minutes max
    const pollInterval = 500
    let elapsed = 0

    while (elapsed < maxWait) {
      const isStreaming = await this.isStillStreaming()
      if (!isStreaming) {
        // Extra buffer to ensure completion
        await this.page.waitForTimeout(500)
        return
      }
      await this.page.waitForTimeout(pollInterval)
      elapsed += pollInterval
    }

    console.warn(`[${this.name}] Response timeout after ${maxWait}ms`)
  }

  /**
   * Check if AI is still generating (override in subclass)
   */
  async isStillStreaming() {
    if (this.streamingIndicator) {
      const indicator = this.page.locator(this.streamingIndicator)
      return (await indicator.count()) > 0
    }
    return false
  }

  /**
   * Extract the latest response text (override in subclass)
   */
  async extractResponse() {
    const responses = this.page.locator(this.responseSelector)
    const count = await responses.count()
    if (count === 0) return ''

    return await responses.nth(count - 1).innerText()
  }
}
