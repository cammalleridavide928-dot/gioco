# Spotlight Suspects

Spotlight Suspects is a local-first real-time party card game for the browser. One player creates a room, friends join with a room code, everyone picks a strange character card, and the server runs secret-vote rounds until a winner is crowned.

## Features

- Real-time multiplayer rooms for up to 14 players
- Create and join flow with shareable room codes and reconnect support
- Two complete game modes: Classic and Dictator
- Server-authoritative game state with Socket.IO
- Secret voting, reveal phase, scoreboard, round timer, and rematch flow
- Persistent all-time wins leaderboard stored in JSON on the server
- 14 generated placeholder character cards as editable SVG assets
- 64 editable prompt cards in JSON
- Responsive React + Vite interface with card animations and optional procedural sounds

## Tech Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Real-time: Socket.IO
- Persistence: JSON file storage
- Styling: plain CSS

## Folder Structure

```text
.
├── client
│   ├── public/assets
│   │   ├── characters
│   │   └── card-back.svg
│   └── src
│       ├── components
│       ├── hooks
│       └── styles
├── server
│   └── src
│       ├── data
│       ├── lib
│       ├── persistence
│       └── state
└── package.json
```

## Installation

```bash
npm install
```

## Running Locally

Development mode starts both the backend and the Vite client:

```bash
npm run dev
```

Useful individual commands:

```bash
npm run server
npm run client
npm run start
npm run build
```

The client runs on `http://localhost:5173` and the server runs on `http://localhost:3001`.

## How Room Creation Works

1. A player enters a display name, picks a character card, and creates a room.
2. The server assigns a 5-letter room code and makes the creator host.
3. Other players join with the room code or a shareable URL containing `?room=CODE`.
4. The server keeps the room state authoritative and broadcasts updates in real time.
5. A reconnect token is stored in browser local storage so a player can recover their seat after a refresh.

## Game Modes

### Classic Mode

- Default round count: 8
- Every round reveals one prompt card.
- All connected players secretly vote for another connected player.
- Players cannot vote for themselves.
- When everyone has voted, or the 30-second timer ends, the round reveals automatically.
- Every player tied for the highest vote count gains 1 point.
- The game ends after the configured number of rounds.

### Dictator Mode

- The dictator rotates in seat order based on the players present when the game starts.
- Each round only non-dictator players vote secretly.
- After voting ends, the table sees the full vote reveal and the top-voted crowd set.
- The dictator then chooses any connected player except themselves.
- The chosen target gains 1 point.
- The dictator gains 1 bonus point only if their final pick belongs to the crowd’s top-voted set.
- If the scheduled dictator is disconnected when their turn arrives, the server skips their round and moves to the next available dictator.
- The game ends after every starting player has had a dictator slot considered once.

## Rules Modal

The client includes an in-game rules modal that mirrors the scoring rules above so players can quickly learn both modes at the table.

## Customizing Characters

Edit these files:

- Character metadata: [server/src/data/characters.json](/c:/Users/camma/Desktop/gioco/server/src/data/characters.json)
- Character SVG art: [client/public/assets/characters](/c:/Users/camma/Desktop/gioco/client/public/assets/characters)

Each character entry includes a stable `id`, `name`, `title`, palette info, and an asset path so you can swap art later without changing gameplay code.

## Customizing Prompt Cards

Edit:

- Prompt deck: [server/src/data/prompts.json](/c:/Users/camma/Desktop/gioco/server/src/data/prompts.json)

The backend shuffles the deck, avoids repeats until exhaustion, and then reshuffles automatically.

## Persistence

The server writes JSON to:

- Storage file: [server/src/persistence/storage.json](/c:/Users/camma/Desktop/gioco/server/src/persistence/storage.json)

Stored data includes:

- All-time wins by display name
- Last room results

The file is created automatically on first run.

## Key Implementation Decisions

- Game title: Spotlight Suspects
- Room code format: 5 uppercase letters
- Persistence method: JSON file storage for zero-setup local use
- Reconnect policy: browser session token restores a player seat if the same room is rejoined
- Classic tie rule: every tied top-voted player gets 1 point
- Dictator scoring: target always gets 1 point, dictator gets 1 bonus point only for matching the top crowd set
- Client preference persistence: mute state and reconnect session are stored in local storage

## Future Improvements

- Add private host controls for custom timers and tie rules
- Add spectator mode and stronger reconnect recovery
- Add richer sound packs and alternate board themes
- Add deployment config for remote play
- Add analytics and per-room history browsing
