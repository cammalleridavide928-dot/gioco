const rules = {
  common: [
    'Si gioca da 3 a 14 persone.',
    'Il server controlla stanza, voti, timer e punteggi.',
    'Ogni round dura al massimo 30 secondi.',
    'Chi si disconnette durante la partita resta al tavolo come assente e puo rientrare.'
  ],
  classic: [
    'Tutti votano in segreto un altro giocatore connesso.',
    'Non puoi votare te stesso.',
    'Il round finisce quando arrivano tutti i voti oppure scade il timer.',
    'Ogni giocatore a pari merito in testa prende 1 punto.',
    'La modalita Classica dura per il numero di round scelto dall host.'
  ],
  dictator: [
    'Ogni round un giocatore diverso diventa il Dittatore seguendo l ordine dei posti.',
    'Solo i non-dittatori votano in segreto.',
    'Dopo la rivelazione, il Dittatore sceglie un giocatore connesso diverso da se stesso.',
    'Il bersaglio scelto prende 1 punto.',
    'Il Dittatore prende 1 punto bonus solo se la sua scelta coincide con il gruppo dei piu votati.'
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
            <p className="eyebrow">Regole</p>
            <h3>Come si gioca a Spotlight Suspects</h3>
          </div>
          <button type="button" className="ghost-button" onClick={onClose}>Chiudi</button>
        </div>
        <section>
          <h4>Info rapide</h4>
          <ul>
            {rules.common.map((rule) => <li key={rule}>{rule}</li>)}
          </ul>
        </section>
        <section>
          <h4>Modalita Classica</h4>
          <ul>
            {rules.classic.map((rule) => <li key={rule}>{rule}</li>)}
          </ul>
        </section>
        <section>
          <h4>Modalita Dittatore</h4>
          <ul>
            {rules.dictator.map((rule) => <li key={rule}>{rule}</li>)}
          </ul>
        </section>
      </div>
    </div>
  );
}
