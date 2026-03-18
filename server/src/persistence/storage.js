import fs from 'node:fs/promises';
import path from 'node:path';

const storagePath = path.resolve(process.cwd(), 'server/src/persistence/storage.json');

const initialState = {
  wins: {},
  lastResults: []
};

async function ensureStorage() {
  try {
    await fs.access(storagePath);
  } catch {
    await fs.mkdir(path.dirname(storagePath), { recursive: true });
    await fs.writeFile(storagePath, JSON.stringify(initialState, null, 2), 'utf8');
  }
}

export async function readStorage() {
  await ensureStorage();
  const raw = await fs.readFile(storagePath, 'utf8');
  try {
    return { ...initialState, ...JSON.parse(raw) };
  } catch {
    return initialState;
  }
}

export async function writeStorage(data) {
  await ensureStorage();
  await fs.writeFile(storagePath, JSON.stringify(data, null, 2), 'utf8');
}

export async function recordGameResult(result) {
  const storage = await readStorage();
  const winner = result.ranking?.[0];
  if (winner) {
    storage.wins[winner.name] = {
      name: winner.name,
      characterId: winner.characterId,
      wins: (storage.wins[winner.name]?.wins || 0) + 1,
      updatedAt: new Date().toISOString()
    };
  }
  storage.lastResults = [result, ...storage.lastResults].slice(0, 20);
  await writeStorage(storage);
  return storage;
}

export async function getLeaderboard() {
  const storage = await readStorage();
  return Object.values(storage.wins).sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name));
}
