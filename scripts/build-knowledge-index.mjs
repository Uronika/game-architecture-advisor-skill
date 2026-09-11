#!/usr/bin/env node

import { DatabaseSync } from 'node:sqlite'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, renameSync, rmSync } from 'node:fs'
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const knowledgeRoot = path.join(root, 'knowledge')
const output = path.join(knowledgeRoot, 'index.sqlite')
const temporaryOutput = path.join(knowledgeRoot, 'index.building.sqlite')
const maxBodyChars = 12_000
const cjkStopTerms = new Set(['系统', '如何', '怎么', '设计', '实现', '使用', '进行', '支持', '相关', '功能', '问题', '方案', '游戏', '更新'])

const sources = [
  {
    id: 'gpp', runtime: 'cross-engine', format: 'markdown',
    root: path.join(knowledgeRoot, 'game-programming-patterns', 'book'),
    include: (file) => file.endsWith('.markdown'),
  },
  {
    id: 'unity-2022.3', runtime: 'Unity 2022.3', format: 'html',
    root: path.join(knowledgeRoot, 'official', 'unity-2022.3'),
    include: (file) => file.endsWith('.html') && !/(^|\\)(StaticFiles|uploads|docdata)(\\|$)/i.test(file),
  },
  {
    id: 'tuanjie-1.10', runtime: 'Tuanjie 1.10', format: 'html',
    root: path.join(knowledgeRoot, 'official', 'tuanjie-1.10', 'Documentation', 'zh_CN'),
    include: (file) => file.endsWith('.html') && !/(^|\\)(StaticFiles|uploads|docdata)(\\|$)/i.test(file),
  },
]

function usage() {
  console.log('Usage: node scripts/build-knowledge-index.mjs [--source gpp|unity-2022.3|tuanjie-1.10]')
}

function decodeHtml(text) {
  return text
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&ndash;/gi, '–').replace(/&mdash;/gi, '—')
    .replace(/&#x([0-9a-f]+);/gi, (_all, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_all, code) => String.fromCodePoint(Number.parseInt(code, 10)))
}

function normalizeText(text) {
  return decodeHtml(text)
    .replace(/\r/g, '')
    .replace(/[\t ]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim()
}

function htmlToDocument(raw) {
  const title = normalizeText((raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? 'Untitled').replace(/<[^>]+>/g, ' '))
  const content = raw.match(/<div id="content-wrap"[\s\S]*?<\/body>/i)?.[0] ?? raw
  const heading = normalizeText((content.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? title).replace(/<[^>]+>/g, ' '))
  const body = normalizeText(content
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|svg|noscript)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
  return { title, heading, body }
}

function markdownToDocument(raw) {
  const title = normalizeText(raw.match(/^\^title\s+(.+)$/m)?.[1] ?? raw.match(/^#\s+(.+)$/m)?.[1] ?? 'Untitled')
  const heading = normalizeText(raw.match(/^##\s+(.+)$/m)?.[1] ?? title)
  const body = normalizeText(raw
    .replace(/^\^[a-z-]+.*$/gm, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1'))
  return { title, heading, body }
}

function searchTerms(text) {
  const terms = new Set()
  for (const word of text.toLowerCase().split(/[^a-z0-9_]+/)) {
    if (word.length >= 2) terms.add(word)
  }
  for (const run of text.match(/[\u4e00-\u9fff]+/g) ?? []) {
    for (let i = 0; i < run.length - 1; i++) {
      const term = run.slice(i, i + 2)
      if (!cjkStopTerms.has(term)) terms.add(term)
    }
    if (run.length <= 8) terms.add(run)
  }
  return [...terms].join(' ')
}

async function walk(directory) {
  const output = []
  const entries = await readdir(directory, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) output.push(...await walk(full))
    else if (entry.isFile()) output.push(full)
  }
  return output
}

function buildSourceFingerprint(activeSources) {
  const hash = createHash('sha256')
  for (const source of activeSources) {
    hash.update(`${source.id}:${source.root}\n`)
  }
  return hash.digest('hex')
}

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--help')) { usage(); return }
  const sourceArg = args.indexOf('--source')
  const requestedId = sourceArg === -1 ? null : args[sourceArg + 1]
  if (sourceArg !== -1 && !requestedId) throw new Error('--source needs a source id')
  const activeSources = requestedId ? sources.filter((source) => source.id === requestedId) : sources
  if (requestedId && activeSources.length === 0) throw new Error(`Unknown source: ${requestedId}`)

  for (const source of activeSources) {
    if (!existsSync(source.root)) throw new Error(`Missing local source ${source.id}: ${source.root}`)
  }

  await mkdir(knowledgeRoot, { recursive: true })
  rmSync(temporaryOutput, { force: true })
  const db = new DatabaseSync(temporaryOutput)
  try {
    db.exec(`
      PRAGMA journal_mode = OFF;
      PRAGMA synchronous = OFF;
      CREATE TABLE source_metadata (
        source TEXT PRIMARY KEY,
        runtime TEXT NOT NULL,
        root_path TEXT NOT NULL,
        document_count INTEGER NOT NULL,
        built_at TEXT NOT NULL
      );
      CREATE VIRTUAL TABLE knowledge USING fts5(
        title, heading, body, terms,
        source UNINDEXED, runtime UNINDEXED, relative_path UNINDEXED,
        tokenize = 'unicode61 remove_diacritics 2'
      );
    `)
    const insert = db.prepare('INSERT INTO knowledge (title, heading, body, terms, source, runtime, relative_path) VALUES (?, ?, ?, ?, ?, ?, ?)')
    const insertMetadata = db.prepare('INSERT INTO source_metadata VALUES (?, ?, ?, ?, ?)')
    let total = 0

    db.exec('BEGIN')
    for (const source of activeSources) {
      const files = (await walk(source.root)).filter(source.include).sort()
      let count = 0
      for (const file of files) {
        const raw = readFileSync(file, 'utf8')
        const parsed = source.format === 'html' ? htmlToDocument(raw) : markdownToDocument(raw)
        if (parsed.body.length < 80) continue
        const body = parsed.body.slice(0, maxBodyChars)
        const querySurface = `${parsed.title}\n${parsed.heading}\n${body.slice(0, 2600)}`
        insert.run(parsed.title, parsed.heading, body, searchTerms(querySurface), source.id, source.runtime, path.relative(knowledgeRoot, file).replace(/\\/g, '/'))
        count++
      }
      insertMetadata.run(source.id, source.runtime, path.relative(knowledgeRoot, source.root).replace(/\\/g, '/'), count, new Date().toISOString())
      total += count
      console.log(`[index] ${source.id}: ${count} documents`)
    }
    db.exec('COMMIT')
    db.exec("INSERT INTO knowledge(knowledge) VALUES('optimize')")
    db.exec('VACUUM')
    console.log(`[index] ${total} documents indexed`)
  } finally {
    db.close()
  }

  rmSync(output, { force: true })
  renameSync(temporaryOutput, output)
  const bytes = (await stat(output)).size
  const verificationDb = new DatabaseSync(output, { readOnly: true })
  const documents = verificationDb.prepare('SELECT source, runtime, document_count AS documentCount FROM source_metadata ORDER BY source').all()
  verificationDb.close()
  const manifest = {
    version: 1,
    builtAt: new Date().toISOString(),
    sourceFingerprint: buildSourceFingerprint(activeSources),
    index: 'index.sqlite',
    documents,
  }
  await writeFile(path.join(knowledgeRoot, 'index-manifest.json'), JSON.stringify(manifest, null, 2))
  console.log(`[index] wrote ${output} (${(bytes / 1024 / 1024).toFixed(1)} MB)`)
}

main().catch((error) => {
  console.error(`[index] failed: ${error.message}`)
  process.exit(1)
})
