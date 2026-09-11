#!/usr/bin/env node

import { searchKnowledge } from './search-knowledge.mjs'

const cases = [
  {
    name: 'achievement design reaches the GPP observer evidence',
    args: ['成就系统如何设计', '--top', '3'],
    expect: (result) => result.hits[0]?.source === 'gpp' && result.hits[0]?.title === 'Observer',
  },
  {
    name: 'UI update decoupling reaches the GPP observer evidence',
    args: ['生命值变化时 UI 要更新，怎么解耦', '--source', 'gpp', '--top', '3'],
    expect: (result) => result.hits[0]?.title === 'Observer',
  },
  {
    name: 'Unity event lookup reaches the Unity API source',
    args: ['UnityEvent ScriptableObject event', '--source', 'unity-2022.3', '--top', '3'],
    expect: (result) => result.hits.some((hit) => hit.source === 'unity-2022.3' && hit.title.includes('UnityEvent')),
  },
]

let failures = 0
for (const test of cases) {
  const [query, ...flags] = test.args
  const sourceIndex = flags.indexOf('--source')
  const topIndex = flags.indexOf('--top')
  const result = await searchKnowledge({
    query,
    source: sourceIndex === -1 ? null : flags[sourceIndex + 1],
    top: topIndex === -1 ? 5 : flags[topIndex + 1],
    noSemantic: true,
  })
  const passed = test.expect(result)
  console.log(`${passed ? 'PASS' : 'FAIL'} ${test.name} (${result.mode})`)
  if (!passed) failures++
}

if (failures) process.exit(1)
