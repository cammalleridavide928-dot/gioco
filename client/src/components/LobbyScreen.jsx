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
  const connectedPlayers = room.players.filter((player) => player.connected).length;
  const canStart = connectedPlayers >= 3;

  return (
    <main className="lobby-shell">
      <section className="lobby-topbar">
        <div>
          <p className="eyebrow">Lobby</p>
          <h1>Stanza {room.roomCode}</h1>
        </div>
        <div className="topbar-actions">
          <button type="button" className="ghost-button" onClick={onOpenRules}>Regole</button>
          <button type="button" className="ghost-button" onClick={onLeave}>Esci</button>
        </div>
      </section>

      <section className="lobby-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Invita</p>
              <h2>Fai entrare il gruppo al volo</h2>
            </div>
            <button type="button" className="secondary-button" onClick={() => onCopyInvite(inviteLink)}>Copia link</button>
          </div>
          <div className="invite-block">
            <span>Codice</span>
            <strong>{room.roomCode}</strong>
            <small>{inviteLink}</small>
          </div>
          <div className="settings-grid">
            <label>
              <span>Modalita</span>
              <select
                disabled={!selfPlayer?.isHost}
                value={room.settings.mode}
                onChange={(event) => onUpdateSettings({
                  ...room.settings,
                  mode: event.target.value
                })}
              >
                <option value="classic">Classica</option>
                <option value="dictator">Dittatore</option>
              </select>
            </label>
            <label>
              <span>Round classici</span>
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
            {selfPlayer?.isHost
              ? 'Sei l host: scegli la modalita e avvia quando siete almeno in 3. La stanza supporta fino a 14 giocatori.'
              : 'In attesa dell host. Per partire servono almeno 3 giocatori; il massimo e 14.'}
          </p>
          {error ? <p className="error-banner">{error}</p> : null}
          {selfPlayer?.isHost ? (
            <button type="button" className="primary-button wide" disabled={!canStart} onClick={onStartGame}>
              Avvia partita
            </button>
          ) : null}
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Giocatori</p>
              <h2>Posti al tavolo</h2>
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
                      <small>{player.connected ? 'Connesso' : 'Disconnesso'}</small>
                    </div>
                    {player.isHost ? <span className="badge">Host</span> : null}
                    {selfPlayer?.isHost && player.id !== selfPlayer.id ? (
                      <button type="button" className="ghost-button small" onClick={() => onKick(player.id)}>Espelli</button>
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
