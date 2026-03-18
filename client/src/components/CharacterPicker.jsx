export default function CharacterPicker({
  characters,
  selectedId,
  onSelect,
  unavailableIds = [],
  lockedId = null,
  compact = false
}) {
  return (
    <div className={`character-grid ${compact ? 'compact' : ''}`}>
      {characters.map((character) => (
        <button
          type="button"
          key={character.id}
          disabled={unavailableIds.includes(character.id) && character.id !== lockedId}
          className={[
            'character-choice',
            selectedId === character.id ? 'selected' : '',
            unavailableIds.includes(character.id) && character.id !== lockedId ? 'unavailable' : ''
          ].filter(Boolean).join(' ')}
          onClick={() => onSelect(character.id)}
        >
          <img src={character.asset} alt={character.name} />
          <div className="character-copy">
            <strong>{character.name}</strong>
            <span>{character.title}</span>
          </div>
          {unavailableIds.includes(character.id) && character.id !== lockedId ? (
            <small className="character-flag">Occupata</small>
          ) : null}
        </button>
      ))}
    </div>
  );
}
