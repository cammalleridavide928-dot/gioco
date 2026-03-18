import { randomUUID } from 'node:crypto';

export const MAX_PLAYERS = 14;
export const MIN_PLAYERS = 3;
export const DEFAULT_CLASSIC_ROUNDS = 8;
export const READING_SECONDS = 15;
export const VOTING_SECONDS = 30;
export const QUESTION_REVEAL_SECONDS = 1;
export const REVEAL_SECONDS = 5;
export const SCORING_SECONDS = 4;

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function createRoomCode(existingCodes) {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const code = Array.from({ length: 5 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
    if (!existingCodes.has(code)) {
      return code;
    }
  }
  return randomUUID().slice(0, 5).toUpperCase();
}

export function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function now() {
  return Date.now();
}

export function createId(prefix = 'id') {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

export function buildTimer(endAt) {
  if (!endAt) {
    return 0;
  }
  return Math.max(0, Math.ceil((endAt - now()) / 1000));
}

export function summarizeVotes(votes) {
  return Object.values(votes).reduce((acc, targetId) => {
    if (!targetId) {
      return acc;
    }
    acc[targetId] = (acc[targetId] || 0) + 1;
    return acc;
  }, {});
}

export function getTopTargets(voteTotals) {
  const entries = Object.entries(voteTotals);
  if (!entries.length) {
    return [];
  }
  const maxVotes = Math.max(...entries.map(([, count]) => count));
  return entries.filter(([, count]) => count === maxVotes).map(([playerId]) => playerId);
}

export function sortRanking(players) {
  return [...players].sort((a, b) => b.score - a.score || a.seat - b.seat);
}
