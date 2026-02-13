import { ChatBridge } from './bridge.js'

export class ChatGPTBridge extends ChatBridge {
  constructor(page) {
    super(page, {
      name: 'ChatGPT',
      url: 'https://chatgpt.com',
    })
    this.useEnterToSubmit = true
  }
}
