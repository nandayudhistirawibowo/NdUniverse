import { createHash } from 'node:crypto';
import { readdir, readFile, mkdir, rename, stat, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contentDirectory = path.join(root, 'src', 'content', 'materi');
const pronunciationPath = path.join(root, 'src', 'pages', 'pengucapan.astro');
const grammarPath = path.join(root, 'src', 'pages', 'grammar.astro');
const outputDirectory = path.join(root, 'public', 'audio', 'tts');
const manifestPath = path.join(outputDirectory, 'manifest.json');
const voice = process.env.EDGE_TTS_VOICE ?? 'de-DE-ConradNeural';
const dryRun = process.argv.includes('--dry-run');
const texts = new Set();

function addText(value) {
  if (typeof value === 'string' && value.trim()) texts.add(value);
}

function parseYamlString(value, filePath, lineNumber) {
  if (value.startsWith('"') && value.endsWith('"')) {
    return JSON.parse(value);
  }

  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replaceAll("''", "'");
  }

  throw new Error(`Expected a quoted German string at ${filePath}:${lineNumber}.`);
}

function parseJavaScriptString(literal) {
  if (literal.startsWith('"')) return JSON.parse(literal);

  const content = literal.slice(1, -1).replaceAll("'", "\\'");
  return JSON.parse(`"${content.replaceAll('"', '\\"').replaceAll("\\\\'", "'")}"`);
}

function getFrontmatter(source, filePath) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new Error(`Could not find Astro frontmatter in ${filePath}.`);
  return match[1];
}

async function collectMarkdownTexts() {
  const files = (await readdir(contentDirectory)).filter((file) => file.endsWith('.md'));

  for (const file of files) {
    const filePath = path.join(contentDirectory, file);
    const source = await readFile(filePath, 'utf8');
    const frontmatterMatch = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    if (!frontmatterMatch) throw new Error(`Could not find YAML frontmatter in ${filePath}.`);

    for (const [index, line] of frontmatterMatch[1].split(/\r?\n/).entries()) {
      const field = line.match(/^\s*(german|context):\s*(.*?)\s*$/);
      if (field) addText(parseYamlString(field[2], filePath, index + 2));
    }
  }
}

async function collectAstroTexts(filePath, properties) {
  const source = await readFile(filePath, 'utf8');
  const frontmatter = getFrontmatter(source, filePath);
  const fieldPattern = new RegExp(
    `\\b(?:${properties.join('|')})\\s*:\\s*("(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*')`,
    'g',
  );

  for (const match of frontmatter.matchAll(fieldPattern)) {
    addText(parseJavaScriptString(match[1]));
  }

  for (const match of source.matchAll(/\btext="((?:\\.|[^"\\])*)"/g)) {
    addText(parseJavaScriptString(`"${match[1]}"`));
  }
}

async function collectTexts() {
  await collectMarkdownTexts();
  await collectAstroTexts(pronunciationPath, ['example']);
  await collectAstroTexts(grammarPath, ['example', 'sentence', 'sein', 'haben', 'word', 'singular']);
}

function hashText(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

async function isGenerated(filePath) {
  try {
    return (await stat(filePath)).size > 0;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function generateAudio(text, outputPath) {
  const result = spawnSync(
    process.env.PYTHON ?? 'python',
    ['-m', 'edge_tts', '--text', text, '--voice', voice, '--write-media', outputPath],
    { cwd: root, stdio: 'inherit', windowsHide: true },
  );

  if (result.error) {
    throw new Error(
      `Could not start Python: ${result.error.message}. Install requirements-tts.txt and ensure Python is on PATH.`,
    );
  }
  if (result.status !== 0) {
    throw new Error(`edge-tts failed for ${JSON.stringify(text)} (exit code ${result.status}).`);
  }
  if (!(await isGenerated(outputPath))) {
    throw new Error(`edge-tts returned success but did not create ${outputPath}.`);
  }
}

await collectTexts();
const sortedTexts = [...texts].sort((a, b) => a.localeCompare(b));
console.log(`Collected ${sortedTexts.length} unique German text(s).`);

if (dryRun) {
  console.log('Dry run: no audio was generated.');
  process.exit(0);
}

await mkdir(outputDirectory, { recursive: true });
const manifest = {};
let generated = 0;
let skipped = 0;

for (const [index, text] of sortedTexts.entries()) {
  const fileName = `${hashText(text)}.mp3`;
  const outputPath = path.join(outputDirectory, fileName);
  if (await isGenerated(outputPath)) {
    skipped += 1;
  } else {
    await generateAudio(text, outputPath);
    generated += 1;
  }

  manifest[text] = `/audio/tts/${fileName}`;
  if ((index + 1) % 100 === 0 || index === sortedTexts.length - 1) {
    console.log(`Processed ${index + 1}/${sortedTexts.length} texts.`);
  }
}

const temporaryManifest = `${manifestPath}.${process.pid}.tmp`;
await writeFile(temporaryManifest, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
await rename(temporaryManifest, manifestPath);
console.log(`TTS generation complete: ${generated} generated, ${skipped} reused.`);
