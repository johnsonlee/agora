import fs from 'fs'

/**
 * Orchestrates a debate between two AI chat bridges
 */
export class Arena {
  constructor(bridgeA, bridgeB, options = {}) {
    this.bridgeA = bridgeA
    this.bridgeB = bridgeB
    this.logFile = options.logFile || null
    this.history = []
    
    // Set up bidirectional streaming
    this.bridgeA.setTargetBridge(this.bridgeB)
    this.bridgeB.setTargetBridge(this.bridgeA)
  }

  /**
   * Run the debate
   */
  async run(topic) {
    console.log('\n' + '='.repeat(60))
    console.log('AGORA - AI Debate Arena')
    console.log('='.repeat(60))
    console.log(`Topic: ${topic}`)
    console.log(`Participants: ${this.bridgeA.name} vs ${this.bridgeB.name}`)
    console.log('Streaming: enabled (real-time sync)')
    console.log('='.repeat(60) + '\n')

    const moderatorMsg = `主持人:\n\n${topic}`

    console.log(`\n${'─'.repeat(40)}`)
    console.log('Opening statements')
    console.log('─'.repeat(40))

    // A opens first (no streaming - B hasn't responded yet)
    this.bridgeA.setTargetBridge(null)
    this.bridgeB.setTargetBridge(null)

    const openingA = await this.bridgeA.send(moderatorMsg)
    this.log(0, this.bridgeA.name, openingA)
    console.log(`\n[${this.bridgeA.name}]:\n${openingA.substring(0, 200)}...\n`)

    // B opens (stream B's response to A so A can see it in real-time)
    this.bridgeB.setTargetBridge(this.bridgeA)

    const openingB = await this.bridgeB.send(moderatorMsg)
    this.log(0, this.bridgeB.name, openingB)
    console.log(`\n[${this.bridgeB.name}]:\n${openingB.substring(0, 200)}...\n`)

    // Enable bidirectional streaming for debate
    this.bridgeA.setTargetBridge(this.bridgeB)

    let round = 0
    while (true) {
      round++

      console.log(`\n${'─'.repeat(40)}`)
      console.log(`Round ${round}`)
      console.log('─'.repeat(40))

      try {
        // A responds (already has B's opening/response from streaming sync)
        const responseA = await this.bridgeA.send(null)
        this.log(round, this.bridgeA.name, responseA)
        console.log(`\n[${this.bridgeA.name}]:\n${responseA.substring(0, 200)}...\n`)

        // B responds (already has A's response from streaming sync)
        const responseB = await this.bridgeB.send(null)
        this.log(round, this.bridgeB.name, responseB)
        console.log(`\n[${this.bridgeB.name}]:\n${responseB.substring(0, 200)}...\n`)
      } catch (e) {
        console.error(`\nRound ${round} error: ${e.message}`)
        console.log('Retrying...\n')
        round--
        continue
      }

      if (this.logFile) {
        this.saveLog()
      }
    }
  }

  log(round, speaker, content) {
    this.history.push({
      timestamp: new Date().toISOString(),
      round,
      speaker,
      content
    })
  }

  saveLog() {
    const output = {
      timestamp: new Date().toISOString(),
      participants: [this.bridgeA.name, this.bridgeB.name],
      history: this.history
    }
    fs.writeFileSync(this.logFile, JSON.stringify(output, null, 2))
    console.log(`\nLog saved to: ${this.logFile}`)
  }
}
