const rules = {
  classic: [
    'Everyone secretly votes for another connected player.',
    'You cannot vote for yourself.',
    'The round ends when all votes are in or the timer expires.',
    'Every tied top-voted player gets 1 point.',
    'Classic mode lasts for the configured number of rounds.'
  ],
  dictator: [
    'One player becomes the dictator each round in seat order.',
    'Only non-dictator players vote secretly.',
    'After the reveal, the dictator picks any connected player except themselves.',
    'The chosen target gets 1 point.',
    'The dictator gets 1 bonus point only if the final pick matches the crowd’s top-voted set.'
  ]
};

export default function RulesModal({ open, onClose }) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel panel" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">Rules</p>
            <h3>How Spotlight Suspects works</h3>
          </div>
          <button type="button" className="ghost-button" onClick={onClose}>Close</button>
        </div>
        <section>
          <h4>Classic Mode</h4>
          <ul>
            {rules.classic.map((rule) => <li key={rule}>{rule}</li>)}
          </ul>
        </section>
        <section>
          <h4>Dictator Mode</h4>
          <ul>
            {rules.dictator.map((rule) => <li key={rule}>{rule}</li>)}
          </ul>
        </section>
      </div>
    </div>
  );
}
