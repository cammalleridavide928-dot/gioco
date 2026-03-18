const rules = {
  common: [
    'Si gioca da 3 a 14 persone.',
    'Il server controlla stanza, voti, timer e punteggi.',
    'Ogni round mostra la domanda, poi 15 secondi di lettura e fino a 30 secondi di voto.',
    'Chi si disconnette durante la partita resta al tavolo come assente e puo rientrare.'
  ],
  classic: [
    'La domanda appare al centro del tavolo e resta visibile durante tutto il round.',
    'Tutti votano in segreto un altro giocatore connesso.',
    'Non puoi votare te stesso.',
    'Se tutti votano prima dello scadere dei 30 secondi, il round accelera subito.',
    'Dopo la rivelazione, ogni giocatore a pari merito in testa prende 1 punto.',
    'La modalita Classica dura per il numero di round scelto dall host.'
  ],
  dictator: [
    'Ogni round un giocatore diverso diventa il Dittatore seguendo l ordine dei posti.',
    'Dopo i 15 secondi di lettura, il Dittatore vota in segreto un altro giocatore.',
    'Gli altri giocatori votano chi pensano sia stato scelto dal Dittatore.',
    'Non puoi mai votare te stesso.',
    'Se indovini la scelta del Dittatore, prendi 1 punto.',
    'Se nessuno indovina, segnano i voti sul bersaglio piu popolare tra le ipotesi del tavolo.'
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
