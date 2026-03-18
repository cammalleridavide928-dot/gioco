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
        <small>pts</small>
      </div>
      {isDictator ? <span className="dictator-crown">Crown</span> : null}
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

  let title = 'Waiting';
  let helper = 'Hold tight while the table catches up.';
  let action = onVote;

  if (isVoting && !isDictator) {
    title = selfVote ? 'Vote submitted' : 'Cast your secret vote';
    helper = selfVote ? 'Your vote is locked until the reveal.' : 'Choose the player that best fits the prompt.';
  }

  if (isVoting && isDictator) {
    title = 'You are the dictator';
    helper = 'Sit back during voting. You choose after the votes are revealed.';
  }

  if (isDictatorChoice) {
    if (isDictator) {
      title = 'Make the final call';
      helper = 'Pick any player except yourself. Crowd favorites glow gold.';
      action = onDictatorChoice;
    } else {
      title = 'Dictator deciding';
      helper = 'The dictator is choosing the final spotlight target.';
    }
  }

  return (
    <section className="vote-tray panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Your Area</p>
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
          <p className="eyebrow">Reveal</p>
          <h3>{reveal.headline || 'Votes revealed'}</h3>
        </div>
        <span>{reveal.subline}</span>
      </div>
      <div className="reveal-grid">
        <div>
          <h4>Votes</h4>
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
          <h4>Standings</h4>
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
            <p className="eyebrow">Game Over</p>
            <h2>{room.game.reveal?.headline}</h2>
          </div>
          <span>{room.game.mode === 'classic' ? 'Classic complete' : 'Dictator cycle complete'}</span>
        </div>
        <div className="final-columns">
          <div>
            <h3>Final ranking</h3>
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
            <h3>All-time wins</h3>
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
          {selfPlayer?.isHost ? <button type="button" className="primary-button" onClick={onRestart}>Back to Lobby</button> : null}
          <button type="button" className="secondary-button" onClick={onLeave}>Leave Room</button>
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
          <p className="eyebrow">{room.game.mode === 'classic' ? 'Classic Mode' : 'Dictator Mode'}</p>
          <h1>Room {room.roomCode}</h1>
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
          <button type="button" className="ghost-button" onClick={onOpenRules}>Rules</button>
          <button type="button" className="ghost-button" onClick={() => setMuted(!muted)}>{muted ? 'Unmute' : 'Mute'}</button>
          <button type="button" className="ghost-button" onClick={onLeave}>Leave</button>
        </div>
      </header>

      <section className="table-layout">
        <aside className="panel side-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Scoreboard</p>
              <h3>Current ranking</h3>
            </div>
            <span>{dictator ? `Dictator: ${dictator.displayName}` : 'Secret votes live'}</span>
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
              <img src="/assets/card-back.svg" alt="Card back" />
            </div>
            <div className="prompt-face prompt-front">
              <p className="eyebrow">Prompt Card</p>
              <h2>{room.game.prompt}</h2>
              <div className="prompt-meta">
                <span>{room.game.phase.replace('_', ' ')}</span>
                {dictator ? <strong>{dictator.displayName} wears the crown</strong> : null}
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
              <p className="eyebrow">Round Info</p>
              <h3>State machine</h3>
            </div>
            <span>{room.game.phase.replace('_', ' ')}</span>
          </div>
          <ul className="status-list">
            <li>{room.game.phase === 'voting' ? 'Votes are hidden until reveal.' : 'The server has frozen the votes.'}</li>
            <li>{room.game.mode === 'classic' ? 'Top-voted players all earn points.' : 'The dictator can steal a bonus by matching the crowd.'}</li>
            <li>{room.players.filter((player) => player.hasVoted).length} players have locked their vote.</li>
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
