function PlayerToken({ player, character, isSelf, isDictator, isTopTarget, isSelectedChoice }) {
  return (
    <article
      className={[
        'player-token',
        !player.connected ? 'offline' : '',
        isSelf ? 'self' : '',
        isDictator ? 'dictator' : '',
        isTopTarget ? 'top-target' : '',
        isSelectedChoice ? 'final-choice' : ''
      ].filter(Boolean).join(' ')}
    >
      <img src={character.asset} alt={character.name} />
      <div className="player-token-copy">
        <strong>{player.displayName}</strong>
        <span>{character.title}</span>
      </div>
      <div className="player-token-meta">
        <b>{player.score}</b>
        <small>pt</small>
      </div>
      {isDictator ? <span className="dictator-crown">Corona</span> : null}
    </article>
  );
}

function VoteTray({
  room,
  selfPlayer,
  availableTargets,
  charactersById,
  onVote,
  onDictatorChoice
}) {
  const isVoting = room.game.phase === 'voting';
  const isDictatorChoice = room.game.phase === 'dictator_choice';
  const selfVote = room.game.selfVote;
  const isDictator = room.game.dictatorPlayerId === selfPlayer.id;

  let title = 'In attesa';
  let helper = 'Aspetta un attimo: il tavolo sta ancora completando il round.';
  let action = onVote;

  if (isVoting && !isDictator) {
    title = selfVote ? 'Voto inviato' : 'Esprimi il tuo voto segreto';
    helper = selfVote ? 'Il tuo voto e bloccato fino alla rivelazione.' : 'Scegli il giocatore che si adatta meglio alla carta prompt.';
  }

  if (isVoting && isDictator) {
    title = 'Sei il Dittatore';
    helper = 'Per ora osserva il tavolo: sceglierai dopo la rivelazione dei voti.';
  }

  if (isDictatorChoice) {
    if (isDictator) {
      title = 'Fai la scelta finale';
      helper = 'Scegli un giocatore diverso da te. I preferiti del gruppo brillano in oro.';
      action = onDictatorChoice;
    } else {
      title = 'Il Dittatore sta decidendo';
      helper = 'La scelta finale del bersaglio e in corso.';
    }
  }

  return (
    <section className="vote-tray panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">La tua area</p>
          <h3>{title}</h3>
        </div>
        <span>{helper}</span>
      </div>
      <div className="vote-cards">
        {availableTargets.map((player) => {
          const character = charactersById[player.characterId];
          const selected = selfVote === player.id || room.game.reveal?.dictatorChoice === player.id;
          const disabled = (isVoting && (selfVote || isDictator)) || (isDictatorChoice && !isDictator);
          return (
            <button
              type="button"
              key={player.id}
              disabled={disabled}
              className={[
                'vote-card',
                selected ? 'locked' : '',
                room.game.topTargets?.includes(player.id) ? 'crowd-top' : ''
              ].filter(Boolean).join(' ')}
              onClick={() => action(player.id)}
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
  const reveal = room.game.reveal;
  if (!reveal) {
    return null;
  }

  return (
    <section className="reveal-panel panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Rivelazione</p>
          <h3>{reveal.headline || 'Voti rivelati'}</h3>
        </div>
        <span>{reveal.subline}</span>
      </div>
      <div className="reveal-grid">
        <div>
          <h4>Voti</h4>
          <div className="vote-list">
            {reveal.votes?.map((vote) => (
              <div className="vote-row" key={`${vote.voterId}-${vote.targetId}`}>
                <span>{vote.voterName}</span>
                <strong>{vote.targetName}</strong>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h4>Classifica</h4>
          <div className="score-list">
            {reveal.scoreboard?.map((player) => (
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
  const ranking = room.game.reveal?.scoreboard || [];
  const leaderboard = room.leaderboard || [];
  return (
    <section className="final-overlay">
      <div className="final-card panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Partita finita</p>
            <h2>{room.game.reveal?.headline}</h2>
          </div>
          <span>{room.game.mode === 'classic' ? 'Modalita Classica conclusa' : 'Giro Dittatore completato'}</span>
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

function formatPhaseLabel(phase) {
  const labels = {
    voting: 'votazione',
    dictator_choice: 'scelta del dittatore',
    reveal: 'rivelazione',
    game_over: 'partita finita'
  };
  return labels[phase] || phase;
}

export default function GameScreen({
  room,
  selfPlayer,
  charactersById,
  onVote,
  onDictatorChoice,
  onRestart,
  onLeave,
  onOpenRules,
  muted,
  setMuted
}) {
  const playersBySeat = room.players.slice().sort((a, b) => a.seat - b.seat);
  const availableTargets = playersBySeat.filter((player) => player.id !== selfPlayer.id && player.connected);
  const dictator = room.players.find((player) => player.id === room.game.dictatorPlayerId);

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
            <span>Timer</span>
            <strong>{room.game.timerRemaining}s</strong>
          </div>
          <button type="button" className="ghost-button" onClick={onOpenRules}>Regole</button>
          <button type="button" className="ghost-button" onClick={() => setMuted(!muted)}>{muted ? 'Attiva audio' : 'Disattiva audio'}</button>
          <button type="button" className="ghost-button" onClick={onLeave}>Esci</button>
        </div>
      </header>

      <section className="table-layout">
        <aside className="panel side-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Punteggi</p>
              <h3>Classifica attuale</h3>
            </div>
            <span>{dictator ? `Dittatore: ${dictator.displayName}` : 'I voti restano segreti'}</span>
          </div>
          <div className="score-list">
            {room.players.map((player, index) => (
              <div className="score-row" key={player.id}>
                <span>#{index + 1} {player.displayName}</span>
                <strong>{player.score}</strong>
              </div>
            ))}
          </div>
        </aside>

        <section className="center-table panel">
          <div className={`prompt-card ${room.game.phase}`}>
            <div className="prompt-face prompt-back">
              <img src="/assets/card-back.svg" alt="Retro della carta" />
            </div>
            <div className="prompt-face prompt-front">
              <p className="eyebrow">Carta prompt</p>
              <h2>{room.game.prompt}</h2>
              <div className="prompt-meta">
                <span>{formatPhaseLabel(room.game.phase)}</span>
                {dictator ? <strong>{dictator.displayName} ha la corona</strong> : null}
              </div>
            </div>
          </div>
          <div className="table-ring">
            {playersBySeat.map((player) => (
              <PlayerToken
                key={player.id}
                player={player}
                character={charactersById[player.characterId]}
                isSelf={player.id === selfPlayer.id}
                isDictator={player.id === room.game.dictatorPlayerId}
                isTopTarget={room.game.topTargets?.includes(player.id)}
                isSelectedChoice={room.game.reveal?.dictatorChoice === player.id}
              />
            ))}
          </div>
        </section>

        <aside className="panel side-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Stato round</p>
              <h3>Panoramica</h3>
            </div>
            <span>{formatPhaseLabel(room.game.phase)}</span>
          </div>
          <ul className="status-list">
            <li>{room.game.phase === 'voting' ? 'I voti restano nascosti fino alla rivelazione.' : 'Il server ha bloccato i voti di questo round.'}</li>
            <li>{room.game.mode === 'classic' ? 'Tutti i piu votati prendono 1 punto.' : 'Il Dittatore puo guadagnare un bonus se indovina il gruppo in testa.'}</li>
            <li>{room.players.filter((player) => player.hasVoted).length} giocatori hanno gia bloccato il voto.</li>
          </ul>
        </aside>
      </section>

      <VoteTray
        room={room}
        selfPlayer={selfPlayer}
        availableTargets={availableTargets}
        charactersById={charactersById}
        onVote={onVote}
        onDictatorChoice={onDictatorChoice}
      />

      {(room.game.phase === 'dictator_choice' || room.game.phase === 'reveal' || room.game.phase === 'game_over') ? <RevealPanel room={room} /> : null}

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
