/**
 * Fetch exercise data from ExerciseDB API (RapidAPI) and map to our exercise library.
 * 
 * Usage: EXERCISEDB_API_KEY=xxx npx tsx scripts/fetch-exercisedb-data.ts
 * 
 * Outputs:
 *  - scripts/exercisedb-mapping.json  (raw mapping for review)
 *  - Updates src/lib/exerciseAnimations.ts with correct GIF URLs
 *  - Updates src/lib/exercises.ts with instructions
 */

import * as fs from 'fs';
import * as path from 'path';

const API_KEY = process.env.EXERCISEDB_API_KEY;
if (!API_KEY) {
  console.error('Missing EXERCISEDB_API_KEY env var');
  process.exit(1);
}

const API_HOST = 'exercisedb.p.rapidapi.com';
const BASE_URL = `https://${API_HOST}`;

interface ExerciseDBEntry {
  id: string;
  name: string;
  bodyPart: string;
  equipment: string;
  gifUrl: string;
  target: string;
  secondaryMuscles: string[];
  instructions: string[];
}

// Our exercise IDs extracted from exercises.ts
function getOurExerciseIds(): { id: string; name: string }[] {
  const exercisesPath = path.join(__dirname, '..', 'src', 'lib', 'exercises.ts');
  const content = fs.readFileSync(exercisesPath, 'utf-8');
  const entries: { id: string; name: string }[] = [];
  
  // Match each exercise object block: { id: '...', name: '...', ... }
  const objRegex = /\{\s*\n\s*id:\s*'([^']+)',\s*\n\s*name:\s*'([^']+)'/g;
  
  let match;
  while ((match = objRegex.exec(content)) !== null) {
    entries.push({ id: match[1], name: match[2] });
  }
  
  return entries;
}

async function fetchAllExercises(): Promise<ExerciseDBEntry[]> {
  const allExercises: ExerciseDBEntry[] = [];
  const limit = 100;
  let offset = 0;
  
  console.log('Fetching exercises from ExerciseDB...');
  
  while (true) {
    const url = `${BASE_URL}/exercises?limit=${limit}&offset=${offset}`;
    console.log(`  Fetching offset=${offset}...`);
    
    const res = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': API_KEY!,
        'X-RapidAPI-Host': API_HOST,
      },
    });
    
    if (!res.ok) {
      console.error(`API error ${res.status}: ${await res.text()}`);
      break;
    }
    
    const data: ExerciseDBEntry[] = await res.json();
    if (data.length === 0) break;
    
    allExercises.push(...data);
    offset += limit;
    
    // Rate limit safety
    await new Promise(r => setTimeout(r, 200));
  }
  
  console.log(`Fetched ${allExercises.length} exercises from ExerciseDB`);
  return allExercises;
}

function normalizeForMatch(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findBestMatch(ourName: string, dbExercises: ExerciseDBEntry[]): ExerciseDBEntry | null {
  const norm = normalizeForMatch(ourName);
  const words = norm.split(' ');
  
  // Try exact match first
  const exact = dbExercises.find(e => normalizeForMatch(e.name) === norm);
  if (exact) return exact;
  
  // Try contains
  const contains = dbExercises.find(e => normalizeForMatch(e.name).includes(norm));
  if (contains) return contains;
  
  // Try reverse contains
  const reverseContains = dbExercises.find(e => norm.includes(normalizeForMatch(e.name)));
  if (reverseContains) return reverseContains;
  
  // Score-based matching
  let bestScore = 0;
  let bestMatch: ExerciseDBEntry | null = null;
  
  for (const entry of dbExercises) {
    const entryNorm = normalizeForMatch(entry.name);
    const entryWords = entryNorm.split(' ');
    
    let matchedWords = 0;
    for (const w of words) {
      if (w.length >= 3 && entryWords.some(ew => ew.includes(w) || w.includes(ew))) {
        matchedWords++;
      }
    }
    
    const score = matchedWords / Math.max(words.length, entryWords.length);
    if (score > bestScore && score >= 0.4) {
      bestScore = score;
      bestMatch = entry;
    }
  }
  
  return bestMatch;
}

async function main() {
  const ourExercises = getOurExerciseIds();
  console.log(`Found ${ourExercises.length} exercises in our library`);
  
  const dbExercises = await fetchAllExercises();
  
  // Build mapping
  const mapping: Record<string, { gifUrl: string; instructions: string; dbName: string; dbId: string }> = {};
  let matched = 0;
  let unmatched = 0;
  
  for (const ex of ourExercises) {
    const match = findBestMatch(ex.name, dbExercises);
    if (match && match.gifUrl) {
      mapping[ex.id] = {
        gifUrl: match.gifUrl,
        instructions: match.instructions?.join(' ') || '',
        dbName: match.name,
        dbId: match.id,
      };
      matched++;
    } else {
      console.log(`  ❌ No match for: ${ex.name} (${ex.id})`);
      unmatched++;
    }
  }
  
  console.log(`\nMatched: ${matched}, Unmatched: ${unmatched}`);
  
  // Save raw mapping
  const mappingPath = path.join(__dirname, 'exercisedb-mapping.json');
  fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));
  console.log(`Saved mapping to ${mappingPath}`);
  
  // Generate updated exerciseAnimations.ts
  generateAnimationsFile(mapping);
  
  // Update exercises.ts with instructions
  updateExerciseInstructions(mapping);
}

function generateAnimationsFile(mapping: Record<string, { gifUrl: string; instructions: string; dbName: string; dbId: string }>) {
  const lines: string[] = [
    '/**',
    ' * Exercise Animation GIF URLs mapped from ExerciseDB API',
    ' * Source: https://exercisedb.p.rapidapi.com',
    ' * ',
    ' * Auto-generated by scripts/fetch-exercisedb-data.ts',
    ' * Maps our exercise IDs to animated GIF URLs showing proper form.',
    ' * Used in: exercise info dialogs, exercise picker, workout detail page.',
    ' */',
    '',
    'export const exerciseAnimationMap: Record<string, string> = {',
  ];
  
  // Group by category comment based on ID patterns
  const entries = Object.entries(mapping).sort(([a], [b]) => a.localeCompare(b));
  
  for (const [id, data] of entries) {
    lines.push(`  '${id}': '${data.gifUrl}',`);
  }
  
  lines.push('};');
  lines.push('');
  lines.push('/**');
  lines.push(' * Get the animation GIF URL for an exercise by ID.');
  lines.push(' * Returns undefined if no animation is available.');
  lines.push(' */');
  lines.push('export function getExerciseAnimationUrl(exerciseId: string): string | undefined {');
  lines.push('  return exerciseAnimationMap[exerciseId];');
  lines.push('}');
  lines.push('');
  
  const outPath = path.join(__dirname, '..', 'src', 'lib', 'exerciseAnimations.ts');
  fs.writeFileSync(outPath, lines.join('\n'));
  console.log(`Updated ${outPath} with ${entries.length} GIF URLs`);
}

function updateExerciseInstructions(mapping: Record<string, { gifUrl: string; instructions: string; dbName: string; dbId: string }>) {
  const exercisesPath = path.join(__dirname, '..', 'src', 'lib', 'exercises.ts');
  let content = fs.readFileSync(exercisesPath, 'utf-8');
  
  let added = 0;
  
  for (const [id, data] of Object.entries(mapping)) {
    if (!data.instructions || data.instructions.trim().length < 10) continue;
    
    // Check if this exercise already has instructions
    // Find the exercise block by its id
    const idPattern = `id: '${id}'`;
    const idIndex = content.indexOf(idPattern);
    if (idIndex === -1) continue;
    
    // Find the closing brace of this exercise object
    const closingBrace = content.indexOf('},', idIndex);
    if (closingBrace === -1) continue;
    
    // Check if instructions already exist in this block
    const block = content.substring(idIndex, closingBrace);
    if (block.includes('instructions:')) continue;
    
    // Escape single quotes in instructions
    const escaped = data.instructions.replace(/'/g, "\\'");
    
    // Insert instructions before the closing brace
    const insertPoint = closingBrace;
    const indent = '    ';
    const instructionLine = `\n${indent}instructions: '${escaped}',`;
    
    content = content.substring(0, insertPoint) + instructionLine + content.substring(insertPoint);
    added++;
  }
  
  fs.writeFileSync(exercisesPath, content);
  console.log(`Added instructions to ${added} exercises in exercises.ts`);
}

main().catch(console.error);
