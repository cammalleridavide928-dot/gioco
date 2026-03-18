export default function CharacterPicker({ characters, selectedId, onSelect }) {
  return (
    <div className="character-grid">
      {characters.map((character) => (
        <button
          type="button"
          key={character.id}
          className={`character-choice ${selectedId === character.id ? 'selected' : ''}`}
          onClick={() => onSelect(character.id)}
        >
          <img src={character.asset} alt={character.name} />
          <div className="character-copy">
            <strong>{character.name}</strong>
            <span>{character.title}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
