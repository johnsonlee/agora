import { ChatBridge } from './bridge.js'

export class GeminiBridge extends ChatBridge {
  constructor(page) {
    super(page, {
      name: 'Gemini',
      url: 'https://gemini.google.com/app',
    })
    this.useEnterToSubmit = true
  }
}
