import characters from '../data/characters.json' with { type: 'json' };
import prompts from '../data/prompts.json' with { type: 'json' };
import { getLeaderboard, recordGameResult } from '../persistence/storage.js';
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  DEFAULT_CLASSIC_ROUNDS,
  READING_SECONDS,
  VOTING_SECONDS,
  QUESTION_REVEAL_SECONDS,
  REVEAL_SECONDS,
  SCORING_SECONDS,
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
      minPlayers: MIN_PLAYERS,
      defaultClassicRounds: DEFAULT_CLASSIC_ROUNDS,
      readingSeconds: READING_SECONDS,
      votingSeconds: VOTING_SECONDS,
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
        classicRounds: DEFAULT_CLASSIC_ROUNDS
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
    await this.broadcastRoom(room);
    return { roomCode, playerId: player.id, sessionId: player.sessionId };
  }

  async joinRoom(socket, payload) {
    const roomCode = (payload.roomCode || '').toUpperCase().trim();
    const room = this.rooms.get(roomCode);
    if (!room) {
      throw new Error('Stanza non trovata.');
    }
    const player = this.addOrReconnectPlayer(room, socket, payload, false);
    socket.join(roomCode);
    await this.broadcastRoom(room);
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
      if (characterMap.has(characterId) && !this.isCharacterTaken(room, characterId, existing.id)) {
        existing.characterId = characterId;
      }
      socket.data = { roomCode: room.code, playerId: existing.id, sessionId: existing.sessionId };
      return existing;
    }

    if (!displayName) {
      throw new Error('Inserisci un nome giocatore.');
    }
    if (!characterMap.has(characterId)) {
      throw new Error('Scegli una carta personaggio.');
    }
    if (room.game && room.game.status !== 'game_over') {
      throw new Error('La partita e gia iniziata. Puoi rientrare solo con la tua sessione.');
    }
    if (room.players.length >= MAX_PLAYERS) {
      throw new Error('La stanza e piena. Il massimo e 14 giocatori.');
    }
    if (this.isCharacterTaken(room, characterId)) {
      throw new Error('Questa carta personaggio e gia occupata nella stanza.');
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

  async updateSettings(socket, payload) {
    const room = this.requireRoomForSocket(socket);
    this.requireHost(room, socket.data.playerId);
    if (room.game) {
      throw new Error('Le impostazioni si possono cambiare solo nella lobby.');
    }
    room.settings.mode = payload.mode === 'dictator' ? 'dictator' : 'classic';
    room.settings.classicRounds = clamp(Number(payload.classicRounds) || DEFAULT_CLASSIC_ROUNDS, 3, 20);
    await this.broadcastRoom(room);
  }

  async updateProfile(socket, payload) {
    const room = this.requireRoomForSocket(socket);
    if (room.game) {
      throw new Error('Profilo modificabile solo nella lobby.');
    }
    const player = room.players.find((entry) => entry.id === socket.data.playerId);
    if (!player) {
      throw new Error('Giocatore non trovato.');
    }
    const nextName = String(payload.displayName || '').trim().slice(0, 20);
    const nextCharacterId = String(payload.characterId || '');
    if (!nextName) {
      throw new Error('Inserisci un nome giocatore.');
    }
    if (!characterMap.has(nextCharacterId)) {
      throw new Error('Scegli una carta personaggio.');
    }
    if (this.isCharacterTaken(room, nextCharacterId, player.id)) {
      throw new Error('Questa carta personaggio e gia occupata nella stanza.');
    }
    player.displayName = nextName;
    player.characterId = nextCharacterId;
    await this.broadcastRoom(room);
    return {
      displayName: player.displayName,
      characterId: player.characterId
    };
  }

  async kickPlayer(socket, targetId) {
    const room = this.requireRoomForSocket(socket);
    this.requireHost(room, socket.data.playerId);
    if (room.game) {
      throw new Error('Puoi espellere giocatori solo prima dell inizio della partita.');
    }
    room.players = room.players.filter((player) => player.id !== targetId);
    this.reassignSeats(room);
    this.ensureHost(room);
    await this.broadcastRoom(room);
  }

  startGame(socket) {
    const room = this.requireRoomForSocket(socket);
    this.requireHost(room, socket.data.playerId);
    const connectedPlayers = this.getConnectedPlayers(room);
    if (connectedPlayers.length < MIN_PLAYERS) {
      throw new Error(`Servono almeno ${MIN_PLAYERS} giocatori connessi per iniziare.`);
    }

    room.players.forEach((player) => {
      player.score = 0;
    });

    room.game = {
      status: 'in_progress',
      mode: room.settings.mode,
      currentRound: 0,
      totalRounds: room.settings.mode === 'classic' ? room.settings.classicRounds : connectedPlayers.length,
      prompt: null,
      promptHistory: [],
      drawPile: shuffle([...prompts]),
      discardPile: [],
      dictatorOrder: connectedPlayers.map((player) => player.id),
      dictatorCursor: 0,
      dictatorPlayerId: null,
      phase: 'question_reveal',
      votes: {},
      resolution: null,
      timerEndsAt: null
    };

    this.startNextRound(room);
  }

  submitVote(socket, targetId) {
    const room = this.requireRoomForSocket(socket);
    const game = room.game;
    const voterId = socket.data.playerId;
    if (!game || game.status !== 'in_progress' || game.phase !== 'voting') {
      throw new Error('La votazione non e aperta in questo momento.');
    }

    const voter = room.players.find((player) => player.id === voterId);
    if (!voter?.connected) {
      throw new Error('I giocatori disconnessi non possono votare.');
    }

    const validTargets = this.getValidVoteTargets(room, voterId);
    if (!validTargets.length) {
      throw new Error('Non hai bersagli validi in questo round.');
    }
    if (!validTargets.includes(targetId)) {
      throw new Error('Questo bersaglio non e disponibile.');
    }
    if (game.votes[voterId]) {
      throw new Error('Hai gia inviato il tuo voto.');
    }

    game.votes[voterId] = targetId;
    this.broadcastRoom(room);

    if (this.haveAllRequiredVotes(room)) {
      this.resolveVoting(room);
    }
  }

  async restartGame(socket) {
    const room = this.requireRoomForSocket(socket);
    this.requireHost(room, socket.data.playerId);
    room.players.forEach((player) => {
      player.score = 0;
    });
    room.game = null;
    this.clearTimers(room);
    await this.broadcastRoom(room);
  }

  async handleDisconnect(socket) {
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
      await this.broadcastRoom(room);
      return;
    }

    if (room.hostId === playerId) {
      this.ensureHost(room);
    }

    if (room.game.phase === 'voting' && this.haveAllRequiredVotes(room)) {
      this.resolveVoting(room);
      return;
    }

    await this.broadcastRoom(room);
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
      throw new Error('Stanza non trovata.');
    }
    return room;
  }

  requireHost(room, playerId) {
    if (room.hostId !== playerId) {
      throw new Error('Solo l host puo farlo.');
    }
  }

  isCharacterTaken(room, characterId, ignorePlayerId = null) {
    return room.players.some((player) => player.id !== ignorePlayerId && player.characterId === characterId);
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

  getCurrentDictator(room) {
    return room.players.find((player) => player.id === room.game?.dictatorPlayerId) || null;
  }

  getRequiredVoterIds(room) {
    const game = room.game;
    if (!game) {
      return [];
    }
    if (game.mode === 'classic') {
      return this.getConnectedPlayers(room)
        .map((player) => player.id)
        .filter((playerId) => this.getValidVoteTargets(room, playerId).length > 0);
    }
    return this.getConnectedPlayers(room)
      .map((player) => player.id)
      .filter((playerId) => this.getValidVoteTargets(room, playerId).length > 0);
  }

  getValidVoteTargets(room, voterId) {
    const game = room.game;
    const connectedIds = this.getConnectedPlayers(room).map((player) => player.id);
    if (!game) {
      return connectedIds.filter((playerId) => playerId !== voterId);
    }

    if (game.mode === 'classic') {
      return connectedIds.filter((playerId) => playerId !== voterId);
    }

    const dictatorId = game.dictatorPlayerId;
    if (voterId === dictatorId) {
      return connectedIds.filter((playerId) => playerId !== dictatorId);
    }
    return connectedIds.filter((playerId) => playerId !== voterId && playerId !== dictatorId);
  }

  haveAllRequiredVotes(room) {
    return this.getRequiredVoterIds(room).every((playerId) => room.game.votes[playerId]);
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
    game.resolution = null;
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

    this.enterQuestionReveal(room);
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
    return prompt || 'Chi e piu probabile che diventi la storia che tutti racconteranno domani?';
  }

  enterQuestionReveal(room) {
    room.game.phase = 'question_reveal';
    this.setPhaseTimer(room, QUESTION_REVEAL_SECONDS, () => this.enterReadingPhase(room));
    this.broadcastRoom(room);
  }

  enterReadingPhase(room) {
    if (!room.game) {
      return;
    }
    room.game.phase = 'reading_time';
    this.setPhaseTimer(room, READING_SECONDS, () => this.enterVotingPhase(room));
    this.broadcastRoom(room);
  }

  enterVotingPhase(room) {
    if (!room.game) {
      return;
    }
    room.game.phase = 'voting';
    room.game.votes = {};
    this.setPhaseTimer(room, VOTING_SECONDS, () => this.resolveVoting(room));
    this.broadcastRoom(room);
  }

  resolveVoting(room) {
    const game = room.game;
    if (!game || game.phase !== 'voting') {
      return;
    }
    this.clearTimers(room);

    game.resolution = game.mode === 'classic'
      ? this.buildClassicResolution(room)
      : this.buildDictatorResolution(room);

    game.phase = 'reveal';
    this.setPhaseTimer(room, REVEAL_SECONDS, () => this.enterScoringPhase(room));
    this.broadcastRoom(room);
  }

  buildClassicResolution(room) {
    const voteTotals = summarizeVotes(room.game.votes);
    const winners = getTopTargets(voteTotals);
    return {
      type: 'classic',
      votes: this.expandVoteDetails(room),
      voteTotals,
      pointRecipients: winners,
      summary: winners.length
        ? `${winners.map((playerId) => this.getPlayerName(room, playerId)).join(' e ')} prendono 1 punto.`
        : 'Nessun voto valido in questo round.',
      title: 'Voti rivelati',
      scoreboardBefore: this.buildRanking(room)
    };
  }

  buildDictatorResolution(room) {
    const dictatorId = room.game.dictatorPlayerId;
    const dictatorChoice = room.game.votes[dictatorId] || null;
    const guessEntries = Object.entries(room.game.votes)
      .filter(([playerId]) => playerId !== dictatorId)
      .map(([playerId, targetId]) => ({
        voterId: playerId,
        voterName: this.getPlayerName(room, playerId),
        targetId,
        targetName: this.getPlayerName(room, targetId)
      }));

    const guessTotals = summarizeVotes(
      Object.fromEntries(guessEntries.map((guess) => [guess.voterId, guess.targetId]))
    );

    const correctGuessers = dictatorChoice
      ? guessEntries.filter((guess) => guess.targetId === dictatorChoice).map((guess) => guess.voterId)
      : [];

    const popularTargets = getTopTargets(guessTotals);
    const popularGuessers = correctGuessers.length
      ? []
      : guessEntries.filter((guess) => popularTargets.includes(guess.targetId)).map((guess) => guess.voterId);

    const pointRecipients = correctGuessers.length ? correctGuessers : popularGuessers;
    const title = dictatorChoice
      ? `${this.getPlayerName(room, dictatorId)} aveva scelto ${this.getPlayerName(room, dictatorChoice)}.`
      : 'Il Dittatore non ha espresso una scelta valida.';
    const summary = correctGuessers.length
      ? `${correctGuessers.map((playerId) => this.getPlayerName(room, playerId)).join(' e ')} indovinano e prendono 1 punto.`
      : pointRecipients.length
        ? 'Nessuno ha indovinato: segnano i voti sul bersaglio piu popolare.'
        : 'Nessun punto assegnato in questo round.';

    return {
      type: 'dictator',
      dictatorId,
      dictatorChoice,
      dictatorChoiceName: this.getPlayerName(room, dictatorChoice),
      guesses: guessEntries,
      voteTotals: guessTotals,
      correctGuessers,
      popularTargets,
      pointRecipients,
      title,
      summary,
      scoreboardBefore: this.buildRanking(room)
    };
  }

  enterScoringPhase(room) {
    const game = room.game;
    if (!game || game.phase !== 'reveal') {
      return;
    }
    game.phase = 'scoring';
    this.applyResolutionPoints(room);
    game.resolution = {
      ...game.resolution,
      scoreboardAfter: this.buildRanking(room)
    };
    this.setPhaseTimer(room, SCORING_SECONDS, () => this.startNextRound(room));
    this.broadcastRoom(room);
  }

  applyResolutionPoints(room) {
    const recipients = room.game?.resolution?.pointRecipients || [];
    recipients.forEach((playerId) => {
      const player = room.players.find((entry) => entry.id === playerId);
      if (player) {
        player.score += 1;
      }
    });
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
    game.resolution = {
      ...(game.resolution || {}),
      title: `${ranking[0]?.displayName || 'Il tavolo'} vince la partita.`,
      summary: 'La classifica finale e confermata.',
      scoreboardAfter: ranking
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
    await this.broadcastRoom(room, await getLeaderboard());
  }

  getPlayerName(room, playerId) {
    return room.players.find((player) => player.id === playerId)?.displayName || 'Nessuno';
  }

  buildRanking(room) {
    return sortRanking(room.players).map((player, index) => ({
      rank: index + 1,
      id: player.id,
      displayName: player.displayName,
      characterId: player.characterId,
      score: player.score,
      connected: player.connected,
      seat: player.seat
    }));
  }

  expandVoteDetails(room) {
    return Object.entries(room.game?.votes || {}).map(([voterId, targetId]) => ({
      voterId,
      voterName: this.getPlayerName(room, voterId),
      targetId,
      targetName: this.getPlayerName(room, targetId)
    }));
  }

  setPhaseTimer(room, seconds, onExpire) {
    this.clearTimers(room);
    room.game.timerEndsAt = now() + seconds * 1000;
    room.timers.tick = setInterval(() => {
      const liveRoom = this.rooms.get(room.code);
      if (!liveRoom?.game) {
        return;
      }
      this.broadcastRoom(liveRoom);
    }, 1000);
    room.timers.timeout = setTimeout(() => onExpire(), seconds * 1000);
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
    const availableCharacterIds = characters
      .filter((character) => !room.players.some((player) => player.characterId === character.id && player.id !== playerId))
      .map((character) => character.id);
    const validTargets = game ? this.getValidVoteTargets(room, playerId) : [];
    const requiredVoters = game ? this.getRequiredVoterIds(room) : [];
    const submittedVoteCount = game ? requiredVoters.filter((id) => game.votes[id]).length : 0;

    return {
      roomCode: room.code,
      hostId: room.hostId,
      status: game?.status || 'lobby',
      settings: room.settings,
      selfId: playerId,
      availableCharacterIds,
      players: room.players
        .slice()
        .sort((a, b) => a.seat - b.seat)
        .map((player) => ({
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
            timerRemaining: buildTimer(game.timerEndsAt),
            selfVote: game.votes[playerId] || null,
            validVoteTargetIds: validTargets,
            requiredVoteCount: requiredVoters.length,
            submittedVoteCount,
            resolution: game.phase === 'reveal' || game.phase === 'scoring' || game.phase === 'game_over'
              ? game.resolution
              : null
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
