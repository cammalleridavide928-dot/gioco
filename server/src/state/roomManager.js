import characters from '../data/characters.json' with { type: 'json' };
import prompts from '../data/prompts.json' with { type: 'json' };
import { getLeaderboard, recordGameResult } from '../persistence/storage.js';
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  DEFAULT_CLASSIC_ROUNDS,
  TURN_SECONDS,
  REVEAL_SECONDS,
  DICTATOR_CHOICE_SECONDS,
  clamp,
  createId,
  createRoomCode,
  shuffle,
  now,
  buildTimer,
  summarizeVotes,
  getTopTargets,
  sortRanking
} from '../lib/utils.js';

const characterMap = new Map(characters.map((character) => [character.id, character]));

export class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();
  }

  getRoom(roomCode) {
    return this.rooms.get(roomCode);
  }

  async getBootstrap() {
    return {
      gameTitle: 'Spotlight Suspects',
      maxPlayers: MAX_PLAYERS,
      defaultClassicRounds: DEFAULT_CLASSIC_ROUNDS,
      turnSeconds: TURN_SECONDS,
      characters,
      leaderboard: await getLeaderboard()
    };
  }

  async createRoom(socket, payload) {
    const roomCode = createRoomCode(new Set(this.rooms.keys()));
    const room = {
      code: roomCode,
      hostId: null,
      createdAt: now(),
      players: [],
      settings: {
        mode: 'classic',
        classicRounds: DEFAULT_CLASSIC_ROUNDS,
        turnSeconds: TURN_SECONDS
      },
      game: null,
      timers: {
        tick: null,
        timeout: null
      }
    };
    this.rooms.set(roomCode, room);
    const player = this.addOrReconnectPlayer(room, socket, payload, true);
    socket.join(roomCode);
    this.broadcastRoom(room);
    return { roomCode, playerId: player.id, sessionId: player.sessionId };
  }

  joinRoom(socket, payload) {
    const roomCode = (payload.roomCode || '').toUpperCase().trim();
    const room = this.rooms.get(roomCode);
    if (!room) {
      throw new Error('Room not found.');
    }
    const player = this.addOrReconnectPlayer(room, socket, payload, false);
    socket.join(roomCode);
    this.broadcastRoom(room);
    return { roomCode, playerId: player.id, sessionId: player.sessionId };
  }

  addOrReconnectPlayer(room, socket, payload, forceHost) {
    const displayName = String(payload.displayName || '').trim().slice(0, 20);
    const characterId = String(payload.characterId || '');
    const requestedSessionId = String(payload.sessionId || '').trim();
    const existing = room.players.find((player) => requestedSessionId && player.sessionId === requestedSessionId);
    if (existing) {
      existing.socketId = socket.id;
      existing.connected = true;
      existing.displayName = displayName || existing.displayName;
      existing.characterId = characterMap.has(characterId) ? characterId : existing.characterId;
      socket.data = { roomCode: room.code, playerId: existing.id, sessionId: existing.sessionId };
      return existing;
    }

    if (!displayName) {
      throw new Error('Display name is required.');
    }
    if (!characterMap.has(characterId)) {
      throw new Error('Please choose a character card.');
    }
    if (!room.players.find((player) => player.id === room.hostId) && room.players.length) {
      room.hostId = room.players[0].id;
      room.players[0].isHost = true;
    }
    if (room.players.length >= MAX_PLAYERS) {
      throw new Error('This room is full.');
    }
    if (room.game && room.game.status !== 'game_over') {
      const duplicateName = room.players.find((player) => player.displayName.toLowerCase() === displayName.toLowerCase());
      if (duplicateName) {
        throw new Error('That display name is already in use in this active game.');
      }
    }

    const player = {
      id: createId('player'),
      sessionId: requestedSessionId || createId('session'),
      socketId: socket.id,
      displayName,
      characterId,
      connected: true,
      isHost: forceHost || room.players.length === 0,
      score: 0,
      seat: room.players.length + 1,
      joinedAt: now()
    };
    room.players.push(player);
    if (player.isHost) {
      room.hostId = player.id;
    }
    socket.data = { roomCode: room.code, playerId: player.id, sessionId: player.sessionId };
    return player;
  }

  updateSettings(socket, payload) {
    const room = this.requireRoomForSocket(socket);
    this.requireHost(room, socket.data.playerId);
    if (room.game) {
      throw new Error('Settings can only be changed in the lobby.');
    }
    room.settings.mode = payload.mode === 'dictator' ? 'dictator' : 'classic';
    room.settings.classicRounds = clamp(Number(payload.classicRounds) || DEFAULT_CLASSIC_ROUNDS, 3, 20);
    this.broadcastRoom(room);
  }

  kickPlayer(socket, targetId) {
    const room = this.requireRoomForSocket(socket);
    this.requireHost(room, socket.data.playerId);
    if (room.game) {
      throw new Error('Players can only be kicked before the game starts.');
    }
    room.players = room.players.filter((player) => player.id !== targetId);
    this.reassignSeats(room);
    this.ensureHost(room);
    this.broadcastRoom(room);
  }

  startGame(socket) {
    const room = this.requireRoomForSocket(socket);
    this.requireHost(room, socket.data.playerId);
    const connectedPlayers = room.players.filter((player) => player.connected);
    if (connectedPlayers.length < MIN_PLAYERS) {
      throw new Error(`At least ${MIN_PLAYERS} connected players are required.`);
    }
    room.players.forEach((player) => {
      player.score = 0;
    });
    room.game = {
      status: 'in_progress',
      phase: 'voting',
      mode: room.settings.mode,
      currentRound: 0,
      totalRounds: room.settings.mode === 'classic' ? room.settings.classicRounds : connectedPlayers.length,
      prompt: null,
      promptHistory: [],
      drawPile: shuffle([...prompts]),
      discardPile: [],
      votes: {},
      voteTotals: {},
      topTargets: [],
      dictatorPlayerId: null,
      dictatorOrder: connectedPlayers.map((player) => player.id),
      dictatorCursor: 0,
      dictatorChoice: null,
      reveal: null
    };
    this.startNextRound(room);
  }

  submitVote(socket, targetId) {
    const room = this.requireRoomForSocket(socket);
    const playerId = socket.data.playerId;
    const game = room.game;
    if (!game || game.status !== 'in_progress' || game.phase !== 'voting') {
      throw new Error('Voting is not open right now.');
    }
    const voter = room.players.find((player) => player.id === playerId);
    if (!voter?.connected) {
      throw new Error('Disconnected players cannot vote.');
    }
    if (!this.getEligibleVoters(room).includes(playerId)) {
      throw new Error('You are not eligible to vote this round.');
    }
    if (playerId === targetId) {
      throw new Error('You cannot vote for yourself.');
    }
    const validTargets = this.getEligibleTargets(room, playerId);
    if (!validTargets.includes(targetId)) {
      throw new Error('That vote target is not available.');
    }
    game.votes[playerId] = targetId;
    this.broadcastRoom(room);
    if (this.haveAllVotes(room)) {
      this.resolveVoting(room);
    }
  }

  submitDictatorChoice(socket, targetId) {
    const room = this.requireRoomForSocket(socket);
    const game = room.game;
    if (!game || game.phase !== 'dictator_choice') {
      throw new Error('The dictator is not choosing right now.');
    }
    if (socket.data.playerId !== game.dictatorPlayerId) {
      throw new Error('Only the dictator can make this choice.');
    }
    const validTargets = this.getEligibleTargets(room, game.dictatorPlayerId);
    if (!validTargets.includes(targetId)) {
      throw new Error('That choice is not available.');
    }
    game.dictatorChoice = targetId;
    const target = room.players.find((player) => player.id === targetId);
    if (target) {
      target.score += 1;
    }
    if (game.topTargets.includes(targetId)) {
      const dictator = room.players.find((player) => player.id === game.dictatorPlayerId);
      if (dictator) {
        dictator.score += 1;
      }
    }
    const dictator = room.players.find((player) => player.id === game.dictatorPlayerId);
    game.reveal = {
      votes: this.expandVoteDetails(room),
      voteTotals: game.voteTotals,
      topTargets: game.topTargets,
      dictatorChoice: targetId,
      scoreboard: this.buildRanking(room)
    };
    this.enterReveal(room, {
      headline: `${target?.displayName || 'No one'} is in the spotlight.`,
      subline: game.topTargets.includes(targetId)
        ? `${dictator?.displayName || 'The dictator'} matched the crowd and earns a bonus point.`
        : `${dictator?.displayName || 'The dictator'} missed the crowd bonus.`
    });
  }

  restartGame(socket) {
    const room = this.requireRoomForSocket(socket);
    this.requireHost(room, socket.data.playerId);
    room.players.forEach((player) => {
      player.score = 0;
      player.connected = player.socketId ? player.connected : false;
    });
    room.game = null;
    this.clearTimers(room);
    this.broadcastRoom(room);
  }

  handleDisconnect(socket) {
    const { roomCode, playerId } = socket.data || {};
    if (!roomCode || !playerId) {
      return;
    }
    const room = this.rooms.get(roomCode);
    if (!room) {
      return;
    }
    const player = room.players.find((entry) => entry.id === playerId);
    if (!player) {
      return;
    }
    player.connected = false;
    player.socketId = null;
    if (!room.game) {
      room.players = room.players.filter((entry) => entry.id !== playerId);
      this.reassignSeats(room);
      this.ensureHost(room);
      if (!room.players.length) {
        this.destroyRoom(room.code);
        return;
      }
    } else {
      if (room.hostId === playerId) {
        this.ensureHost(room);
      }
      if (room.game.phase === 'voting' && this.haveAllVotes(room)) {
        this.resolveVoting(room);
        return;
      }
      if (room.game.phase === 'dictator_choice' && room.game.dictatorPlayerId === playerId) {
        this.finishDictatorChoiceAutomatically(room);
        return;
      }
    }
    this.broadcastRoom(room);
  }

  destroyRoom(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room) {
      return;
    }
    this.clearTimers(room);
    this.rooms.delete(roomCode);
  }

  requireRoomForSocket(socket) {
    const roomCode = socket.data?.roomCode;
    const room = roomCode ? this.rooms.get(roomCode) : null;
    if (!room) {
      throw new Error('Room not found.');
    }
    return room;
  }

  requireHost(room, playerId) {
    if (room.hostId !== playerId) {
      throw new Error('Only the host can do that.');
    }
  }

  reassignSeats(room) {
    room.players.forEach((player, index) => {
      player.seat = index + 1;
    });
  }

  ensureHost(room) {
    const currentHost = room.players.find((player) => player.id === room.hostId && player.connected);
    room.players.forEach((player) => {
      player.isHost = false;
    });
    const nextHost = currentHost || room.players.find((player) => player.connected) || room.players[0];
    if (nextHost) {
      nextHost.isHost = true;
      room.hostId = nextHost.id;
    }
  }

  getConnectedPlayers(room) {
    return room.players.filter((player) => player.connected);
  }

  getEligibleVoters(room) {
    if (!room.game) {
      return [];
    }
    const connected = this.getConnectedPlayers(room).map((player) => player.id);
    if (room.game.mode === 'dictator') {
      return connected.filter((playerId) => playerId !== room.game.dictatorPlayerId);
    }
    return connected;
  }

  getEligibleTargets(room, voterId) {
    return this.getConnectedPlayers(room)
      .map((player) => player.id)
      .filter((playerId) => playerId !== voterId);
  }

  haveAllVotes(room) {
    const game = room.game;
    const requiredVoters = this.getEligibleVoters(room);
    return requiredVoters.every((playerId) => game.votes[playerId]);
  }

  startNextRound(room) {
    const game = room.game;
    if (!game) {
      return;
    }

    if (game.mode === 'classic' && game.currentRound >= game.totalRounds) {
      this.finishGame(room);
      return;
    }

    if (game.mode === 'dictator' && game.dictatorCursor >= game.dictatorOrder.length) {
      this.finishGame(room);
      return;
    }

    game.currentRound += 1;
    game.votes = {};
    game.voteTotals = {};
    game.topTargets = [];
    game.dictatorChoice = null;
    game.reveal = null;
    game.prompt = this.drawPrompt(game);
    if (game.mode === 'dictator') {
      let dictatorId = null;
      while (game.dictatorCursor < game.dictatorOrder.length && !dictatorId) {
        const candidateId = game.dictatorOrder[game.dictatorCursor];
        game.dictatorCursor += 1;
        const candidate = room.players.find((player) => player.id === candidateId && player.connected);
        if (candidate) {
          dictatorId = candidate.id;
        }
      }
      if (!dictatorId) {
        this.finishGame(room);
        return;
      }
      game.dictatorPlayerId = dictatorId;
    } else {
      game.dictatorPlayerId = null;
    }

    game.phase = 'voting';
    this.setPhaseTimer(room, room.settings.turnSeconds, () => this.resolveVoting(room));
    this.broadcastRoom(room);
  }

  drawPrompt(game) {
    if (!game.drawPile.length) {
      game.drawPile = shuffle([...game.discardPile]);
      game.discardPile = [];
    }
    const prompt = game.drawPile.shift();
    if (prompt) {
      game.discardPile.push(prompt);
      game.promptHistory.push(prompt);
    }
    return prompt || 'Who is most likely to become the story everyone repeats tomorrow?';
  }

  resolveVoting(room) {
    const game = room.game;
    if (!game || game.phase !== 'voting') {
      return;
    }
    this.clearTimers(room);
    game.voteTotals = summarizeVotes(game.votes);
    game.topTargets = getTopTargets(game.voteTotals);
    if (game.mode === 'classic') {
      game.topTargets.forEach((playerId) => {
        const player = room.players.find((entry) => entry.id === playerId);
        if (player) {
          player.score += 1;
        }
      });
      game.reveal = {
        votes: this.expandVoteDetails(room),
        voteTotals: game.voteTotals,
        topTargets: game.topTargets,
        scoreboard: this.buildRanking(room)
      };
      const winners = game.topTargets
        .map((playerId) => room.players.find((player) => player.id === playerId)?.displayName)
        .filter(Boolean);
      this.enterReveal(room, {
        headline: winners.length ? `${winners.join(' & ')} take the point.` : 'No points awarded.',
        subline: winners.length > 1 ? 'Classic mode rewards every tied leader.' : 'The votes are locked in.'
      });
      return;
    }

    game.phase = 'dictator_choice';
    this.setPhaseTimer(room, DICTATOR_CHOICE_SECONDS, () => this.finishDictatorChoiceAutomatically(room));
    this.broadcastRoom(room);
  }

  finishDictatorChoiceAutomatically(room) {
    const game = room.game;
    if (!game || game.phase !== 'dictator_choice') {
      return;
    }
    const automaticTarget = game.topTargets[0] || this.getEligibleTargets(room, game.dictatorPlayerId)[0];
    if (!automaticTarget) {
      this.enterReveal(room, {
        headline: 'Nobody was available for the final call.',
        subline: 'The round moves on without extra points.'
      });
      return;
    }
    const fakeSocket = { data: { roomCode: room.code, playerId: game.dictatorPlayerId } };
    this.submitDictatorChoice(fakeSocket, automaticTarget);
  }

  enterReveal(room, copy) {
    const game = room.game;
    if (!game) {
      return;
    }
    game.phase = 'reveal';
    game.reveal = {
      ...game.reveal,
      headline: copy.headline,
      subline: copy.subline,
      scoreboard: this.buildRanking(room)
    };
    this.setPhaseTimer(room, REVEAL_SECONDS, () => this.startNextRound(room));
    this.broadcastRoom(room);
  }

  async finishGame(room) {
    const game = room.game;
    if (!game) {
      return;
    }
    this.clearTimers(room);
    game.status = 'game_over';
    game.phase = 'game_over';
    const ranking = this.buildRanking(room);
    game.reveal = {
      headline: `${ranking[0]?.displayName || 'The table'} wins the game.`,
      subline: 'Final results are locked in.',
      scoreboard: ranking
    };
    const publicResult = {
      roomCode: room.code,
      mode: game.mode,
      finishedAt: new Date().toISOString(),
      ranking: ranking.map((player) => ({
        name: player.displayName,
        characterId: player.characterId,
        score: player.score
      }))
    };
    await recordGameResult(publicResult);
    this.broadcastRoom(room, await getLeaderboard());
  }

  buildRanking(room) {
    return sortRanking(room.players).map((player, index) => ({
      rank: index + 1,
      id: player.id,
      displayName: player.displayName,
      characterId: player.characterId,
      score: player.score,
      connected: player.connected
    }));
  }

  expandVoteDetails(room) {
    return Object.entries(room.game?.votes || {}).map(([voterId, targetId]) => ({
      voterId,
      voterName: room.players.find((player) => player.id === voterId)?.displayName || 'Unknown',
      targetId,
      targetName: room.players.find((player) => player.id === targetId)?.displayName || 'Nobody'
    }));
  }

  setPhaseTimer(room, seconds, onExpire) {
    this.clearTimers(room);
    room.game.timerEndsAt = now() + seconds * 1000;
    room.timers.tick = setInterval(() => {
      const currentRoom = this.rooms.get(room.code);
      if (!currentRoom?.game) {
        return;
      }
      if (buildTimer(currentRoom.game.timerEndsAt) <= 0) {
        return;
      }
      this.broadcastRoom(currentRoom);
    }, 1000);
    room.timers.timeout = setTimeout(() => {
      onExpire();
    }, seconds * 1000);
  }

  clearTimers(room) {
    if (room.timers.tick) {
      clearInterval(room.timers.tick);
      room.timers.tick = null;
    }
    if (room.timers.timeout) {
      clearTimeout(room.timers.timeout);
      room.timers.timeout = null;
    }
    if (room.game) {
      room.game.timerEndsAt = null;
    }
  }

  createSnapshot(room, playerId, leaderboardOverride) {
    const leaderboard = leaderboardOverride || null;
    const game = room.game;
    return {
      roomCode: room.code,
      hostId: room.hostId,
      status: game?.status || 'lobby',
      settings: room.settings,
      selfId: playerId,
      players: sortRanking(room.players).map((player) => ({
        id: player.id,
        displayName: player.displayName,
        characterId: player.characterId,
        connected: player.connected,
        isHost: player.id === room.hostId,
        score: player.score,
        seat: player.seat,
        hasVoted: Boolean(game?.votes?.[player.id])
      })),
      game: game
        ? {
            status: game.status,
            phase: game.phase,
            mode: game.mode,
            currentRound: game.currentRound,
            totalRounds: game.totalRounds,
            prompt: game.prompt,
            dictatorPlayerId: game.dictatorPlayerId,
            topTargets: game.phase === 'dictator_choice' || game.phase === 'reveal' || game.phase === 'game_over' ? game.topTargets : [],
            voteTotals: game.phase === 'dictator_choice' || game.phase === 'reveal' || game.phase === 'game_over' ? game.voteTotals : {},
            reveal: game.phase === 'reveal' || game.phase === 'game_over' ? game.reveal : game.phase === 'dictator_choice' ? {
              votes: this.expandVoteDetails(room),
              voteTotals: game.voteTotals,
              topTargets: game.topTargets,
              scoreboard: this.buildRanking(room)
            } : null,
            timerRemaining: buildTimer(game.timerEndsAt),
            selfVote: game.votes?.[playerId] || null
          }
        : null,
      leaderboard
    };
  }

  async broadcastRoom(room, leaderboardOverride = null) {
    const leaderboard = leaderboardOverride || (room.game?.phase === 'game_over' ? await getLeaderboard() : null);
    room.players.forEach((player) => {
      if (!player.socketId) {
        return;
      }
      this.io.to(player.socketId).emit('room:update', this.createSnapshot(room, player.id, leaderboard));
    });
  }
}
