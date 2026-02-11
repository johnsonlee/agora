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
    await this.page.waitForSelector(this.inputSelector, { visible: true })
    await this.page.click(this.inputSelector)
    await this.page.evaluate((selector) => {
      const el = document.querySelector(selector)
      if (el) el.textContent = ''
    }, this.inputSelector)
    await this.page.type(this.inputSelector, message, { delay: 10 })

    // Small delay to seem human
    await this.delay(300)

    // Submit
    await this.page.waitForSelector(this.submitSelector, { visible: true })
    await this.page.click(this.submitSelector)

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
