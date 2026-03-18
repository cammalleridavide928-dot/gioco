import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import LandingScreen from './components/LandingScreen.jsx';
import LobbyScreen from './components/LobbyScreen.jsx';
import GameScreen from './components/GameScreen.jsx';
import RulesModal from './components/RulesModal.jsx';
import { useLocalStorage } from './hooks/useLocalStorage.js';
import { useSoundEffects } from './hooks/useSoundEffects.js';

const emptyDraft = {
  displayName: '',
  characterId: '',
  roomCode: new URLSearchParams(window.location.search).get('room')?.toUpperCase() || ''
};

export default function App() {
  const socketRef = useRef(null);
  const autoJoinAttempted = useRef(false);
  const [bootstrap, setBootstrap] = useState(null);
  const [room, setRoom] = useState(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [error, setError] = useState('');
  const [rulesOpen, setRulesOpen] = useState(false);
  const [session, setSession] = useLocalStorage('spotlight-session', null);
  const [muted, setMuted] = useLocalStorage('spotlight-muted', false);
  const sounds = useSoundEffects(muted);

  const charactersById = useMemo(
    () => Object.fromEntries((bootstrap?.characters || []).map((character) => [character.id, character])),
    [bootstrap]
  );

  useEffect(() => {
    fetch('/api/bootstrap')
      .then((response) => response.json())
      .then((data) => setBootstrap(data))
      .catch(() => setError('Impossibile caricare i dati del gioco.'));
  }, []);

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;
    socket.on('room:update', (nextRoom) => {
      setRoom((current) => {
        if (current?.game?.phase !== nextRoom.game?.phase) {
          if (nextRoom.game?.phase === 'reveal') {
            sounds.playRoundEnd();
          } else if (nextRoom.game?.phase === 'game_over') {
            sounds.playWinner();
          } else if (nextRoom.game?.phase === 'voting') {
            sounds.playFlip();
          }
        }
        return { ...nextRoom, leaderboard: nextRoom.leaderboard || current?.leaderboard || null };
      });
      if (nextRoom.leaderboard) {
        setBootstrap((current) => current ? { ...current, leaderboard: nextRoom.leaderboard } : current);
      }
      window.history.replaceState({}, '', nextRoom.roomCode ? `?room=${nextRoom.roomCode}` : window.location.pathname);
      setError('');
    });
    return () => socket.disconnect();
  }, [sounds]);

  useEffect(() => {
    if (!bootstrap || !socketRef.current || autoJoinAttempted.current || !session?.roomCode || !session?.sessionId) {
      return;
    }
    autoJoinAttempted.current = true;
    emit('player:join', {
      roomCode: session.roomCode,
      sessionId: session.sessionId,
      displayName: session.displayName,
      characterId: session.characterId
    }).then((result) => {
      if (!result.ok) {
        setSession(null);
      }
    });
  }, [bootstrap, session, setSession]);

  const selfPlayer = room?.players.find((player) => player.id === room.selfId);

  function emit(eventName, payload) {
    return new Promise((resolve) => {
      socketRef.current.emit(eventName, payload, resolve);
    });
  }

  function validateDraft(needsRoomCode = false) {
    if (!draft.displayName.trim()) {
      setError('Inserisci un nome giocatore.');
      return false;
    }
    if (!draft.characterId) {
      setError('Scegli una carta personaggio.');
      return false;
    }
    if (needsRoomCode && !draft.roomCode.trim()) {
      setError('Inserisci un codice stanza per entrare.');
      return false;
    }
    return true;
  }

  async function handleCreate() {
    if (!validateDraft()) {
      return;
    }
    const result = await emit('room:create', {
      displayName: draft.displayName.trim(),
      characterId: draft.characterId,
      sessionId: session?.sessionId
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSession({
      roomCode: result.roomCode,
      sessionId: result.sessionId,
      displayName: draft.displayName.trim(),
      characterId: draft.characterId
    });
  }

  async function handleJoin() {
    if (!validateDraft(true)) {
      return;
    }
    const result = await emit('player:join', {
      roomCode: draft.roomCode,
      displayName: draft.displayName.trim(),
      characterId: draft.characterId,
      sessionId: session?.sessionId
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSession({
      roomCode: result.roomCode,
      sessionId: result.sessionId,
      displayName: draft.displayName.trim(),
      characterId: draft.characterId
    });
  }

  async function handleUpdateSettings(settings) {
    const result = await emit('room:updateSettings', settings);
    if (!result.ok) {
      setError(result.error);
    }
  }

  async function handleStartGame() {
    const result = await emit('game:start', {});
    if (!result.ok) {
      setError(result.error);
    }
  }

  async function handleKick(playerId) {
    const result = await emit('room:kick', playerId);
    if (!result.ok) {
      setError(result.error);
    }
  }

  async function handleVote(targetId) {
    const result = await emit('game:vote', targetId);
    if (result.ok) {
      sounds.playVote();
    } else {
      setError(result.error);
    }
  }

  async function handleDictatorChoice(targetId) {
    const result = await emit('game:dictatorChoice', targetId);
    if (!result.ok) {
      setError(result.error);
    }
  }

  async function handleRestart() {
    const result = await emit('game:restart', {});
    if (!result.ok) {
      setError(result.error);
    }
  }

  function handleLeave() {
    setSession(null);
    window.location.href = window.location.origin;
  }

  async function copyInvite(text) {
    try {
      await navigator.clipboard.writeText(text);
      setError('Link di invito copiato negli appunti.');
    } catch {
      setError('Copia non riuscita. Condividi il codice stanza manualmente.');
    }
  }

  if (!bootstrap) {
    return <div className="loading-screen">Caricamento di Spotlight Suspects...</div>;
  }

  return (
    <>
      {!room ? (
        <LandingScreen
          bootstrap={bootstrap}
          draft={draft}
          setDraft={setDraft}
          onCreate={handleCreate}
          onJoin={handleJoin}
          error={error}
        />
      ) : room.status === 'lobby' ? (
        <LobbyScreen
          room={room}
          selfPlayer={selfPlayer}
          charactersById={charactersById}
          onStartGame={handleStartGame}
          onUpdateSettings={handleUpdateSettings}
          onKick={handleKick}
          onCopyInvite={copyInvite}
          onLeave={handleLeave}
          onOpenRules={() => setRulesOpen(true)}
          error={error}
        />
      ) : (
        <GameScreen
          room={room}
          selfPlayer={selfPlayer}
          charactersById={charactersById}
          onVote={handleVote}
          onDictatorChoice={handleDictatorChoice}
          onRestart={handleRestart}
          onLeave={handleLeave}
          onOpenRules={() => setRulesOpen(true)}
          muted={muted}
          setMuted={setMuted}
        />
      )}
      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </>
  );
}
