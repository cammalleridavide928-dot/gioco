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
          <p className="eyebrow">Party Game Online</p>
          <h1>Spotlight Suspects</h1>
          <p className="lede">
            Un party game da browser con accuse assurde, voti segreti e personaggi abbastanza teatrali da creare subito il caos.
          </p>
          <div className="hero-pills">
            <span>Da 3 a 14 giocatori</span>
            <span>Classica + Dittatore</span>
            <span>Round da 30 secondi</span>
          </div>
        </div>
        <div className="card-showcase">
          <img src="/assets/card-back.svg" alt="Retro della carta" className="showcase-back" />
          {draft.characterId ? (
            <img
              src={bootstrap.characters.find((character) => character.id === draft.characterId)?.asset}
              alt="Personaggio selezionato"
              className="showcase-front"
            />
          ) : null}
        </div>
      </section>

      <section className="entry-panel">
        <div className="entry-header">
          <div>
            <p className="eyebrow">Crea o Entra</p>
            <h2>Prenota il tuo posto</h2>
          </div>
          <p>Scegli un nome, blocca il tuo personaggio e apri una stanza oppure entra con un codice condiviso.</p>
        </div>

        <div className="form-grid">
          <label>
            <span>Nome giocatore</span>
            <input
              value={draft.displayName}
              maxLength={20}
              placeholder="Inserisci il tuo nome di gioco"
              onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))}
            />
          </label>
          <label>
            <span>Codice stanza</span>
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
          <button type="button" className="primary-button" onClick={onCreate}>Crea stanza</button>
          <button type="button" className="secondary-button" onClick={onJoin}>Entra nella stanza</button>
        </div>

        <div className="leaderboard-card">
          <div>
            <p className="eyebrow">Vittorie di sempre</p>
            <h3>Classifica locale</h3>
          </div>
          <ol>
            {bootstrap.leaderboard.length ? bootstrap.leaderboard.slice(0, 5).map((entry) => (
              <li key={entry.name}>
                <span>{entry.name}</span>
                <strong>{entry.wins} vittorie</strong>
              </li>
            )) : <li><span>Nessuna vittoria registrata</span><strong>Inizia tu</strong></li>}
          </ol>
        </div>
      </section>
    </main>
  );
}
