#!/usr/bin/env node

import { DatabaseSync } from 'node:sqlite'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const knowledgeRoot = path.join(root, 'knowledge')
const databasePath = path.join(knowledgeRoot, 'index.sqlite')
const ollamaUrl = process.env.GAME_ARCH_OLLAMA_URL ?? 'http://127.0.0.1:11434'
const embeddingModel = process.env.GAME_ARCH_EMBED_MODEL ?? 'bge-m3'
const cjkStopTerms = new Set(['系统', '如何', '怎么', '设计', '实现', '使用', '进行', '支持', '相关', '功能', '问题', '方案', '游戏', '更新'])
const semanticCandidateLimit = 24

const queryAliases = [
  {
    triggers: ['achievement', 'achievements', '成就', '徽章', '勋章'],
    additions: ['achievement', 'badge', 'unlock', 'observer', 'save', 'persistence'],
  },
  {
    triggers: ['对象池', '池化', 'projectile pool', 'object pool'],
    additions: ['object pool', 'pooling', 'allocation', 'gc', 'reuse'],
  },
  {
    triggers: ['状态机', '状态切换', 'state machine', 'fsm'],
    additions: ['state', 'transition', 'animation', 'state machine'],
  },
  {
    triggers: ['解耦', '通知', '订阅', '生命值', 'ui 更新'],
    additions: ['observer', 'event', 'notify', 'subscribe', 'decouple', 'ui'],
  },
]

function usage() {
  console.log('Usage: node scripts/search-knowledge.mjs "question" [--source gpp|unity-2022.3|tuanjie-1.10] [--top 5] [--no-semantic] [--json]')
}

function expandTerms(text) {
  const terms = new Set()
  for (const word of text.toLowerCase().split(/[^a-z0-9_]+/)) if (word.length >= 2) terms.add(word)
  for (const run of text.match(/[\u4e00-\u9fff]+/g) ?? []) {
    for (let i = 0; i < run.length - 1; i++) {
      const term = run.slice(i, i + 2)
      if (!cjkStopTerms.has(term)) terms.add(term)
    }
    if (run.length <= 8) terms.add(run)
  }
  const aliases = []
  const lower = text.toLowerCase()
  for (const rule of queryAliases) {
    if (rule.triggers.some((trigger) => lower.includes(trigger.toLowerCase()))) {
      aliases.push(...rule.additions)
      for (const addition of rule.additions) {
        for (const word of addition.toLowerCase().split(/[^a-z0-9_]+/)) if (word.length >= 2) terms.add(word)
      }
    }
  }
  return { terms: [...terms], aliases: [...new Set(aliases)] }
}

function ftsQuery(terms) {
  return terms.map((term) => `"${term.replaceAll('"', '')}"`).join(' OR ')
}

function excerpt(text, max = 420) {
  const compact = text.replace(/\s+/g, ' ').trim()
  return compact.length <= max ? compact : `${compact.slice(0, max)}…`
}

function cosine(a, b) {
  let dot = 0; let aNorm = 0; let bNorm = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    aNorm += a[i] * a[i]
    bNorm += b[i] * b[i]
  }
  return dot / (Math.sqrt(aNorm) * Math.sqrt(bNorm) + 1e-12)
}

async function embed(inputs) {
  const response = await fetch(`${ollamaUrl}/api/embed`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: embeddingModel, input: inputs }),
    signal: AbortSignal.timeout(12_000),
  })
  if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}`)
  const payload = await response.json()
  if (!Array.isArray(payload.embeddings) || payload.embeddings.length !== inputs.length) throw new Error('Ollama returned an unexpected embedding response')
  return payload.embeddings
}

function normalize(values) {
  const min = Math.min(...values); const max = Math.max(...values)
  return values.map((value) => max === min ? 1 : (value - min) / (max - min))
}

export async function searchKnowledge({ query, source = null, top = 5, noSemantic = false }) {
  if (!query) throw new Error('A question is required')
  top = Math.min(Math.max(Number(top), 1), 10)
  if (!existsSync(databasePath)) throw new Error(`No local index at ${databasePath}. Run build-knowledge-index.mjs first.`)

  const { terms, aliases } = expandTerms(query)
  if (!terms.length) throw new Error('The question did not contain searchable terms')
  const db = new DatabaseSync(databasePath, { readOnly: true })
  let candidates
  try {
    const statement = source
      ? db.prepare('SELECT rowid, title, heading, body, source, runtime, relative_path AS relativePath, bm25(knowledge, 3.0, 2.0, 1.0, 4.0) AS bm25 FROM knowledge WHERE knowledge MATCH ? AND source = ? ORDER BY bm25 LIMIT 80')
      : db.prepare('SELECT rowid, title, heading, body, source, runtime, relative_path AS relativePath, bm25(knowledge, 3.0, 2.0, 1.0, 4.0) AS bm25 FROM knowledge WHERE knowledge MATCH ? ORDER BY bm25 LIMIT 80')
    candidates = source ? statement.all(ftsQuery(terms), source) : statement.all(ftsQuery(terms))
  } finally {
    db.close()
  }

  let mode = 'lexical-fallback'
  let semanticError = null
  let ranked = candidates.map((candidate) => ({ ...candidate, lexical: -candidate.bm25, semantic: null }))
  if (candidates.length && !noSemantic) {
    try {
      const semanticCandidates = candidates.slice(0, semanticCandidateLimit)
      const inputs = [query, ...semanticCandidates.map((candidate) => `${candidate.title}\n${candidate.heading}\n${candidate.body.slice(0, 5000)}`)]
      const vectors = await embed(inputs)
      const lexical = normalize(semanticCandidates.map((candidate) => -candidate.bm25))
      ranked = semanticCandidates.map((candidate, index) => ({
        ...candidate,
        lexical: -candidate.bm25,
        semantic: cosine(vectors[0], vectors[index + 1]),
        score: 0.55 * lexical[index] + 0.45 * ((cosine(vectors[0], vectors[index + 1]) + 1) / 2),
      })).sort((a, b) => b.score - a.score)
      mode = 'hybrid-rerank'
    } catch (error) {
      semanticError = error.message
    }
  }
  if (mode === 'lexical-fallback') ranked.sort((a, b) => b.lexical - a.lexical)
  const hits = ranked.slice(0, top).map((candidate) => ({
    source: candidate.source, runtime: candidate.runtime, title: candidate.title, heading: candidate.heading,
    path: candidate.relativePath, lexicalScore: Number(candidate.lexical.toFixed(5)),
    semanticScore: candidate.semantic === null ? null : Number(candidate.semantic.toFixed(5)),
    excerpt: excerpt(candidate.body),
  }))
  const result = { query, aliases, mode, semanticError, candidates: candidates.length, semanticCandidates: mode === 'hybrid-rerank' ? Math.min(candidates.length, semanticCandidateLimit) : 0, hits }
  return result
}

async function main() {
  const args = process.argv.slice(2)
  if (!args.length || args.includes('--help')) { usage(); return }
  const positional = []
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--source' || args[index] === '--top') { index++; continue }
    if (!args[index].startsWith('--')) positional.push(args[index])
  }
  const query = positional.join(' ')
  const sourceIndex = args.indexOf('--source')
  const topIndex = args.indexOf('--top')
  const result = await searchKnowledge({
    query,
    source: sourceIndex === -1 ? null : args[sourceIndex + 1],
    top: topIndex === -1 ? 5 : args[topIndex + 1],
    noSemantic: args.includes('--no-semantic'),
  })
  const json = args.includes('--json')
  if (json) console.log(JSON.stringify(result, null, 2))
  else {
    console.log(`mode=${result.mode}; candidates=${result.candidates}${result.semanticError ? `; semantic=${result.semanticError}` : ''}`)
    if (result.aliases.length) console.log(`query-expansion=${result.aliases.join(', ')}`)
    for (const [index, hit] of result.hits.entries()) {
      console.log(`\n${index + 1}. [${hit.source} | ${hit.runtime}] ${hit.title} — ${hit.heading}`)
      console.log(`   path: knowledge/${hit.path}`)
      console.log(`   lexical=${hit.lexicalScore}${hit.semanticScore === null ? '' : ` semantic=${hit.semanticScore}`}`)
      console.log(`   ${hit.excerpt}`)
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`[search] failed: ${error.message}`)
    process.exit(1)
  })
}
