export default function LobbyScreen({
  room,
  selfPlayer,
  charactersById,
  onStartGame,
  onUpdateSettings,
  onKick,
  onCopyInvite,
  onLeave,
  onOpenRules,
  error
}) {
  const inviteLink = `${window.location.origin}?room=${room.roomCode}`;
  const canStart = room.players.filter((player) => player.connected).length >= 3;

  return (
    <main className="lobby-shell">
      <section className="lobby-topbar">
        <div>
          <p className="eyebrow">Lobby</p>
          <h1>Room {room.roomCode}</h1>
        </div>
        <div className="topbar-actions">
          <button type="button" className="ghost-button" onClick={onOpenRules}>Rules</button>
          <button type="button" className="ghost-button" onClick={onLeave}>Leave</button>
        </div>
      </section>

      <section className="lobby-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Invite</p>
              <h2>Friends can join instantly</h2>
            </div>
            <button type="button" className="secondary-button" onClick={() => onCopyInvite(inviteLink)}>Copy Link</button>
          </div>
          <div className="invite-block">
            <span>Code</span>
            <strong>{room.roomCode}</strong>
            <small>{inviteLink}</small>
          </div>
          <div className="settings-grid">
            <label>
              <span>Mode</span>
              <select
                disabled={!selfPlayer?.isHost}
                value={room.settings.mode}
                onChange={(event) => onUpdateSettings({
                  ...room.settings,
                  mode: event.target.value
                })}
              >
                <option value="classic">Classic</option>
                <option value="dictator">Dictator</option>
              </select>
            </label>
            <label>
              <span>Classic rounds</span>
              <input
                disabled={!selfPlayer?.isHost || room.settings.mode !== 'classic'}
                type="number"
                min="3"
                max="20"
                value={room.settings.classicRounds}
                onChange={(event) => onUpdateSettings({
                  ...room.settings,
                  classicRounds: Number(event.target.value)
                })}
              />
            </label>
          </div>
          <p className="helper-text">
            {selfPlayer?.isHost ? 'You are the host. Choose the mode, then start when everyone is ready.' : 'Waiting for the host to start the game.'}
          </p>
          {error ? <p className="error-banner">{error}</p> : null}
          {selfPlayer?.isHost ? (
            <button type="button" className="primary-button wide" disabled={!canStart} onClick={onStartGame}>
              Start Game
            </button>
          ) : null}
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Players</p>
              <h2>Seats at the table</h2>
            </div>
            <span>{room.players.length} / 14</span>
          </div>
          <div className="lobby-players">
            {room.players
              .slice()
              .sort((a, b) => a.seat - b.seat)
              .map((player) => {
                const character = charactersById[player.characterId];
                return (
                  <article className={`lobby-player ${!player.connected ? 'offline' : ''}`} key={player.id}>
                    <img src={character.asset} alt={character.name} />
                    <div>
                      <strong>{player.displayName}</strong>
                      <p>{character.name}</p>
                      <small>{player.connected ? 'Connected' : 'Disconnected'}</small>
                    </div>
                    {player.isHost ? <span className="badge">Host</span> : null}
                    {selfPlayer?.isHost && player.id !== selfPlayer.id ? (
                      <button type="button" className="ghost-button small" onClick={() => onKick(player.id)}>Kick</button>
                    ) : null}
                  </article>
                );
              })}
          </div>
        </div>
      </section>
    </main>
  );
}
