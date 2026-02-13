const TEMPLATES = {
  en: [
    '{{pro}} will argue for, {{con}} will argue against. Let\'s explore {{topic}} together.',
    '',
    'Do not give conclusions yet. List all potentially relevant variables — exhaustive, unranked, uncategorized.',
    'Each variable must include a source and date. Omit any without a source.',
    '',
    'Beyond the direct variables of the topic itself, you must also cover:',
    '- What is changing in the external environment surrounding this topic?',
    '- What forces from adjacent domains could cross over and impact this topic?',
    '',
    'After the exhaustive list, each side adds 5 variables the other side likely missed. Merge and deduplicate into the final variable set.'
  ].join('\n'),

  zh: [
    '{{pro}}作为正方，{{con}}作为反方，我们一起探讨{{topic}}。',
    '',
    '先不要给结论。列出所有可能相关的变量，穷举，不排序，不归类。',
    '每个变量标注来源和日期，没有来源的不要写。',
    '',
    '穷举时，除了主题本身的直接变量，还必须覆盖：',
    '- 主题所处的外部环境中，正在发生什么变化？',
    '- 有哪些相邻领域的力量可能跨界影响这个主题？',
    '',
    '穷举完成后，双方各自补充"对方遗漏的 5 个变量"，合并去重后作为最终变量集。'
  ].join('\n'),
}

const TURN_PROMPTS = {
  en: '\n\n--------\nYour turn, {{name}}. Stay on topic.',
  zh: '\n\n--------\n请{{name}}发言，注意不要跑题',
}

function getLocale() {
  const lang = process.env.LANG || process.env.LC_ALL || process.env.LC_MESSAGES || ''
  return lang.split('.')[0].replace('_', '-').toLowerCase()
}

function localeKey() {
  return getLocale().startsWith('zh') ? 'zh' : 'en'
}

export function buildModeratorMessage(pro, con, topic) {
  return TEMPLATES[localeKey()]
    .replace(/\{\{pro\}\}/g, pro)
    .replace(/\{\{con\}\}/g, con)
    .replace(/\{\{topic\}\}/g, topic)
}

export function buildTurnPrompt(name) {
  return TURN_PROMPTS[localeKey()]
    .replace(/\{\{name\}\}/g, name)
}
