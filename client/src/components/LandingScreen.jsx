import CharacterPicker from './CharacterPicker.jsx';

export default function LandingScreen({
  bootstrap,
  draft,
  setDraft,
  onCreate,
  onJoin,
  error
}) {
  return (
    <main className="landing-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Party Card Game</p>
          <h1>Spotlight Suspects</h1>
          <p className="lede">
            A live browser game of outrageous accusations, secret voting, and suspiciously dramatic character cards.
          </p>
          <div className="hero-pills">
            <span>Up to 14 players</span>
            <span>Classic + Dictator</span>
            <span>30 second rounds</span>
          </div>
        </div>
        <div className="card-showcase">
          <img src="/assets/card-back.svg" alt="Card back" className="showcase-back" />
          {draft.characterId ? (
            <img
              src={bootstrap.characters.find((character) => character.id === draft.characterId)?.asset}
              alt="Selected character"
              className="showcase-front"
            />
          ) : null}
        </div>
      </section>

      <section className="entry-panel">
        <div className="entry-header">
          <div>
            <p className="eyebrow">Create or Join</p>
            <h2>Claim your seat</h2>
          </div>
          <p>Pick a display name, lock in a character card, then open a room or join one with a shared code.</p>
        </div>

        <div className="form-grid">
          <label>
            <span>Display name</span>
            <input
              value={draft.displayName}
              maxLength={20}
              placeholder="Enter your game name"
              onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))}
            />
          </label>
          <label>
            <span>Room code</span>
            <input
              value={draft.roomCode}
              maxLength={5}
              placeholder="ABCDE"
              onChange={(event) => setDraft((current) => ({
                ...current,
                roomCode: event.target.value.toUpperCase().replace(/[^A-Z]/g, '')
              }))}
            />
          </label>
        </div>

        <CharacterPicker
          characters={bootstrap.characters}
          selectedId={draft.characterId}
          onSelect={(characterId) => setDraft((current) => ({ ...current, characterId }))}
        />

        {error ? <p className="error-banner">{error}</p> : null}

        <div className="cta-row">
          <button type="button" className="primary-button" onClick={onCreate}>Create Room</button>
          <button type="button" className="secondary-button" onClick={onJoin}>Join Room</button>
        </div>

        <div className="leaderboard-card">
          <div>
            <p className="eyebrow">All-time winners</p>
            <h3>Local leaderboard</h3>
          </div>
          <ol>
            {bootstrap.leaderboard.length ? bootstrap.leaderboard.slice(0, 5).map((entry) => (
              <li key={entry.name}>
                <span>{entry.name}</span>
                <strong>{entry.wins} wins</strong>
              </li>
            )) : <li><span>No wins yet</span><strong>Be the first</strong></li>}
          </ol>
        </div>
      </section>
    </main>
  );
}
