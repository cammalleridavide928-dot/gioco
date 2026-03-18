function phaseLabel(phase) {
  return {
    question_reveal: 'Rivelazione domanda',
    reading_time: 'Tempo di lettura',
    voting: 'Votazione',
    reveal: 'Rivelazione voti',
    scoring: 'Assegnazione punti',
    game_over: 'Partita finita'
  }[phase] || phase;
}

function phaseDescription(room, selfPlayer) {
  const { game } = room;
  const dictatorId = game.dictatorPlayerId;
  const isDictator = dictatorId === selfPlayer.id;
  if (game.phase === 'question_reveal') {
    return 'La carta centrale entra in scena.';
  }
  if (game.phase === 'reading_time') {
    return 'Leggete la domanda: la votazione parte automaticamente allo scadere del timer.';
  }
  if (game.phase === 'voting') {
    if (game.mode === 'classic') {
      return game.selfVote ? 'Voto registrato. In attesa degli altri.' : 'Scegli in segreto chi descrive meglio la domanda.';
    }
    return isDictator
      ? (game.selfVote ? 'La tua scelta segreta e stata registrata.' : 'Scegli in segreto un altro giocatore.')
      : (game.selfVote ? 'La tua ipotesi e stata inviata.' : 'Indovina chi pensi abbia scelto il Dittatore.');
  }
  if (game.phase === 'reveal') {
    return 'Il server sta mostrando tutti i voti reali del round.';
  }
  if (game.phase === 'scoring') {
    return 'Punti assegnati. Il prossimo round arriva tra pochi secondi.';
  }
  return 'La partita e conclusa.';
}

function getSeatPositions(players) {
  const count = players.length;
  const startAngle = -90;
  return players.map((player, index) => {
    const angle = ((360 / Math.max(count, 1)) * index + startAngle) * (Math.PI / 180);
    const radiusX = count <= 4 ? 38 : count <= 8 ? 42 : 45;
    const radiusY = count <= 4 ? 33 : count <= 8 ? 35 : 37;
    const left = 50 + Math.cos(angle) * radiusX;
    const top = 50 + Math.sin(angle) * radiusY;
    return {
      ...player,
      orbitStyle: {
        left: `${left}%`,
        top: `${top}%`
      }
    };
  });
}

function PlayerSeat({ player, character, isSelf, isDictator, isWinner, isRevealedTarget }) {
  return (
    <article
      className={[
        'seat-card',
        isSelf ? 'self' : '',
        isDictator ? 'dictator' : '',
        isWinner ? 'winner' : '',
        isRevealedTarget ? 'targeted' : '',
        !player.connected ? 'offline' : ''
      ].filter(Boolean).join(' ')}
      style={player.orbitStyle}
    >
      <img src={character.asset} alt={character.name} />
      <div className="seat-copy">
        <strong>{player.displayName}</strong>
        <span>{player.connected ? 'Connesso' : 'Disconnesso'}</span>
      </div>
      <div className="seat-score">{player.score}</div>
      {isDictator ? <span className="dictator-crown">Corona</span> : null}
    </article>
  );
}

function VoteTray({ room, selfPlayer, charactersById, onVote }) {
  const validTargets = room.players.filter((player) => room.game.validVoteTargetIds.includes(player.id));
  const waiting = room.game.submittedVoteCount >= room.game.requiredVoteCount && room.game.requiredVoteCount > 0;

  return (
    <section className="vote-tray panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">La tua scelta</p>
          <h3>{room.game.selfVote ? 'Voto inviato' : 'Seleziona un bersaglio'}</h3>
        </div>
        <span>
          {room.game.selfVote
            ? 'Il tuo voto e bloccato fino alla rivelazione.'
            : waiting
              ? 'Tutti i voti sono arrivati.'
              : `Voti ricevuti: ${room.game.submittedVoteCount}/${room.game.requiredVoteCount}`}
        </span>
      </div>
      <div className="vote-cards compact">
        {validTargets.map((player) => {
          const character = charactersById[player.characterId];
          return (
            <button
              type="button"
              key={player.id}
              className={`vote-card mini ${room.game.selfVote === player.id ? 'locked' : ''}`}
              disabled={Boolean(room.game.selfVote) || room.game.phase !== 'voting'}
              onClick={() => onVote(player.id)}
            >
              <img src={character.asset} alt={character.name} />
              <strong>{player.displayName}</strong>
              <span>{character.name}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function RevealPanel({ room }) {
  const resolution = room.game.resolution;
  if (!resolution) {
    return null;
  }

  return (
    <section className="reveal-panel panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">{room.game.phase === 'scoring' ? 'Punteggio' : 'Rivelazione'}</p>
          <h3>{resolution.title}</h3>
        </div>
        <span>{resolution.summary}</span>
      </div>

      <div className="reveal-grid">
        <div>
          <h4>{resolution.type === 'classic' ? 'Voti del tavolo' : 'Scelte del round'}</h4>
          <div className="vote-list">
            {resolution.type === 'classic' ? resolution.votes?.map((vote) => (
              <div className="vote-row" key={`${vote.voterId}-${vote.targetId}`}>
                <span>{vote.voterName}</span>
                <strong>{vote.targetName}</strong>
              </div>
            )) : (
              <>
                <div className="vote-row">
                  <span>Scelta del Dittatore</span>
                  <strong>{resolution.dictatorChoiceName}</strong>
                </div>
                {resolution.guesses?.map((vote) => (
                  <div className="vote-row" key={`${vote.voterId}-${vote.targetId}`}>
                    <span>{vote.voterName}</span>
                    <strong>{vote.targetName}</strong>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
        <div>
          <h4>{room.game.phase === 'scoring' ? 'Classifica aggiornata' : 'Classifica corrente'}</h4>
          <div className="score-list">
            {(room.game.phase === 'scoring' ? resolution.scoreboardAfter : resolution.scoreboardBefore)?.map((player) => (
              <div className="score-row" key={player.id}>
                <span>#{player.rank} {player.displayName}</span>
                <strong>{player.score}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalResults({ room, charactersById, selfPlayer, onRestart, onLeave }) {
  const ranking = room.game.resolution?.scoreboardAfter || [];
  const leaderboard = room.leaderboard || [];
  return (
    <section className="final-overlay">
      <div className="final-card panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Partita finita</p>
            <h2>{room.game.resolution?.title}</h2>
          </div>
          <span>{room.game.resolution?.summary}</span>
        </div>
        <div className="final-columns">
          <div>
            <h3>Classifica finale</h3>
            <div className="final-ranking">
              {ranking.map((player) => (
                <div key={player.id} className="final-row">
                  <img src={charactersById[player.characterId].asset} alt={charactersById[player.characterId].name} />
                  <span>#{player.rank} {player.displayName}</span>
                  <strong>{player.score}</strong>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3>Vittorie di sempre</h3>
            <div className="final-ranking">
              {leaderboard.slice(0, 6).map((entry) => (
                <div key={entry.name} className="final-row compact">
                  <span>{entry.name}</span>
                  <strong>{entry.wins}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="cta-row">
          {selfPlayer?.isHost ? <button type="button" className="primary-button" onClick={onRestart}>Torna alla lobby</button> : null}
          <button type="button" className="secondary-button" onClick={onLeave}>Esci dalla stanza</button>
        </div>
      </div>
    </section>
  );
}

export default function GameScreen({
  room,
  selfPlayer,
  charactersById,
  onVote,
  onRestart,
  onLeave,
  onOpenRules,
  muted,
  setMuted
}) {
  const playersBySeat = getSeatPositions(room.players.slice().sort((a, b) => a.seat - b.seat));
  const scoringRecipients = room.game.resolution?.pointRecipients || [];
  const dictator = room.players.find((player) => player.id === room.game.dictatorPlayerId);
  const revealTarget = room.game.resolution?.dictatorChoice || null;

  return (
    <main className="game-shell">
      <header className="game-topbar">
        <div>
          <p className="eyebrow">{room.game.mode === 'classic' ? 'Modalita Classica' : 'Modalita Dittatore'}</p>
          <h1>Stanza {room.roomCode}</h1>
        </div>
        <div className="game-stats">
          <div className="stat-chip">
            <span>Round</span>
            <strong>{room.game.currentRound} / {room.game.totalRounds}</strong>
          </div>
          <div className="stat-chip warning">
            <span>{room.game.phase === 'reading_time' ? 'Lettura' : room.game.phase === 'voting' ? 'Voto' : 'Timer'}</span>
            <strong>{room.game.timerRemaining}s</strong>
          </div>
          <button type="button" className="ghost-button" onClick={onOpenRules}>Regole</button>
          <button type="button" className="ghost-button" onClick={() => setMuted(!muted)}>{muted ? 'Attiva audio' : 'Disattiva audio'}</button>
          <button type="button" className="ghost-button" onClick={onLeave}>Esci</button>
        </div>
      </header>

      <section className="board-shell">
        <aside className="panel status-column">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Fase</p>
              <h3>{phaseLabel(room.game.phase)}</h3>
            </div>
            <span>{dictator ? `Dittatore: ${dictator.displayName}` : 'Modalita Classica'}</span>
          </div>
          <p className="phase-copy">{phaseDescription(room, selfPlayer)}</p>
          <div className="score-list">
            {room.players
              .slice()
              .sort((a, b) => b.score - a.score || a.seat - b.seat)
              .map((player, index) => (
                <div className="score-row" key={player.id}>
                  <span>#{index + 1} {player.displayName}</span>
                  <strong>{player.score}</strong>
                </div>
              ))}
          </div>
        </aside>

        <section className="table-panel panel">
          <div className="table-surface">
            <div className={`prompt-spot prompt-${room.game.phase}`}>
              <div className="prompt-card-main">
                <div className="prompt-badge">{phaseLabel(room.game.phase)}</div>
                <h2>{room.game.prompt}</h2>
                <p>
                  {room.game.phase === 'reading_time'
                    ? 'Leggete la carta prima che parta il voto.'
                    : room.game.phase === 'voting'
                      ? 'Il server raccoglie i voti in tempo reale.'
                      : room.game.phase === 'reveal'
                        ? 'Le scelte del round sono state svelate.'
                        : room.game.phase === 'scoring'
                          ? 'Punti assegnati. Preparati al prossimo giro.'
                          : 'Nuova domanda in arrivo.'}
                </p>
              </div>
            </div>

            <div className="player-orbit desktop-only">
              {playersBySeat.map((player) => (
                <PlayerSeat
                  key={player.id}
                  player={player}
                  character={charactersById[player.characterId]}
                  isSelf={player.id === selfPlayer.id}
                  isDictator={player.id === room.game.dictatorPlayerId}
                  isWinner={scoringRecipients.includes(player.id)}
                  isRevealedTarget={revealTarget === player.id}
                />
              ))}
            </div>

            <div className="player-strip mobile-only">
              {playersBySeat.map((player) => (
                <PlayerSeat
                  key={player.id}
                  player={{ ...player, orbitStyle: undefined }}
                  character={charactersById[player.characterId]}
                  isSelf={player.id === selfPlayer.id}
                  isDictator={player.id === room.game.dictatorPlayerId}
                  isWinner={scoringRecipients.includes(player.id)}
                  isRevealedTarget={revealTarget === player.id}
                />
              ))}
            </div>
          </div>
        </section>
      </section>

      {room.game.phase === 'voting' ? (
        <VoteTray
          room={room}
          selfPlayer={selfPlayer}
          charactersById={charactersById}
          onVote={onVote}
        />
      ) : null}

      {(room.game.phase === 'reveal' || room.game.phase === 'scoring' || room.game.phase === 'game_over') ? <RevealPanel room={room} /> : null}

      {room.status === 'game_over' ? (
        <FinalResults
          room={room}
          charactersById={charactersById}
          selfPlayer={selfPlayer}
          onRestart={onRestart}
          onLeave={onLeave}
        />
      ) : null}
    </main>
  );
}
