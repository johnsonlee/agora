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
    console.log('='.repeat(60) + '\n')

    // Opening message
    const openingPrompt = `我们来进行一场辩论。话题是：「${topic}」

请先陈述你的核心观点，要求：
1. 立场鲜明
2. 给出 2-3 个关键论据
3. 控制在 300 字以内`

    let lastMessage = openingPrompt

    for (let round = 1; round <= this.maxRounds; round++) {
      console.log(`\n${'─'.repeat(40)}`)
      console.log(`Round ${round}/${this.maxRounds}`)
      console.log('─'.repeat(40))

      // A speaks
      const responseA = await this.bridgeA.send(lastMessage)
      this.log(this.bridgeA.name, responseA)
      console.log(`\n[${this.bridgeA.name}]:\n${responseA}\n`)

      // Prepare message for B
      const promptForB = `对方（${this.bridgeA.name}）说：

"${responseA}"

请回应，要求：
1. 指出对方论证的漏洞或不足
2. 给出你的反驳或补充观点
3. 控制在 300 字以内
4. 不要轻易同意对方`

      // B responds
      const responseB = await this.bridgeB.send(promptForB)
      this.log(this.bridgeB.name, responseB)
      console.log(`\n[${this.bridgeB.name}]:\n${responseB}\n`)

      // Prepare message for A (next round)
      lastMessage = `对方（${this.bridgeB.name}）说：

"${responseB}"

请回应，要求：
1. 指出对方论证的漏洞或不足
2. 给出你的反驳或补充观点
3. 控制在 300 字以内
4. 不要轻易同意对方`
    }

    console.log('\n' + '='.repeat(60))
    console.log('Debate concluded')
    console.log('='.repeat(60))

    // Save log
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
