import fs from 'fs'

/**
 * Orchestrates a debate between two AI chat bridges
 */
export class Arena {
  constructor(bridgeA, bridgeB, options = {}) {
    this.bridgeA = bridgeA
    this.bridgeB = bridgeB
    this.maxRounds = options.maxRounds || 5
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
    console.log(`Rounds: ${this.maxRounds}`)
    console.log('Streaming: enabled (real-time sync)')
    console.log('='.repeat(60) + '\n')

    // Opening message
    const openingPrompt = topic

    for (let round = 1; round <= this.maxRounds; round++) {
      console.log(`\n${'─'.repeat(40)}`)
      console.log(`Round ${round}/${this.maxRounds}`)
      console.log('─'.repeat(40))

      // A speaks (streams to B's input)
      const responseA = await this.bridgeA.send(round === 1 ? openingPrompt : null)
      this.log(this.bridgeA.name, responseA)
      console.log(`\n[${this.bridgeA.name}]:\n${responseA.substring(0, 200)}...\n`)

      // B responds (streams to A's input)
      const responseB = await this.bridgeB.send(null)
      this.log(this.bridgeB.name, responseB)
      console.log(`\n[${this.bridgeB.name}]:\n${responseB.substring(0, 200)}...\n`)
    }

    console.log('\n' + '='.repeat(60))
    console.log('Debate concluded')
    console.log('='.repeat(60))

    if (this.logFile) {
      this.saveLog()
    }

    return this.history
  }

  log(speaker, content) {
    this.history.push({
      timestamp: new Date().toISOString(),
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
