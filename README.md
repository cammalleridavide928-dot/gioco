# Spotlight Suspects

Spotlight Suspects is a local-first real-time party card game for the browser. One player creates a room, friends join with a room code, everyone picks a strange character card, and the server runs secret-vote rounds until a winner is crowned.

## Features

- Real-time multiplayer rooms with a minimum of 3 players to start and a maximum of 14 players per room
- Create and join flow with shareable room codes and reconnect support
- Reliable room joining from manual room code entry or shareable `?room=CODE` links
- Fully localized Italian in-game experience for UI, rules, prompts, and player feedback
- Two complete game modes: Classic and Dictator
- Server-authoritative game state with Socket.IO
- Server-timed round flow with question reveal, 15-second reading time, 30-second voting, reveal, scoring, and rematch flow
- Persistent all-time wins leaderboard stored in JSON on the server
- 14 generated placeholder character cards as editable SVG assets
- Fairytale / fantasy SVG character cards with stable IDs and replaceable asset paths
- 64 editable prompt cards in JSON, now localized in Italian
- Responsive React + Vite interface with a poker-table board that adapts across desktop, tablet, and phone
- Unique character cards per room, enforced server-side
- Render-ready single-service deployment, with Express serving the built client in production

## Tech Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Real-time: Socket.IO
- Persistence: JSON file storage
- Styling: plain CSS

## Folder Structure

```text
.
|-- client
|   |-- public/assets
|   |   |-- characters
|   |   `-- card-back.svg
|   `-- src
|       |-- components
|       |-- hooks
|       `-- styles
|-- server
|   `-- src
|       |-- data
|       |-- lib
|       |-- persistence
|       `-- state
`-- package.json
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

## Render Deployment

This repository supports Render as a single full-stack service:

- Build command: `npm install && npm run build`
- Start command: `npm run start`

In production, Express serves the built frontend from `client/dist` while preserving `/api/*` routes and Socket.IO.
Health checks are available at `/health` and `/api/health`.

## How Room Creation Works

1. A player enters a display name, picks a character card, and creates a room.
2. The server assigns a 5-letter room code and makes the creator host.
3. Other players join with the room code or a shareable URL containing `?room=CODE`.
4. The server keeps the room state authoritative and broadcasts updates in real time.
5. A reconnect token is stored in browser local storage so a player can recover their seat after a refresh.
6. A game can only start with at least 3 connected players.
7. A room accepts at most 14 players.
8. Character cards are unique inside a room. If a card is already claimed, the server rejects duplicate selection.
9. Successful joins are broadcast immediately so every connected device sees the updated lobby state in real time.

## Game Modes

### Classic Mode

- Default round count: 8
- Every round starts with the prompt card revealed in the center of the table.
- A 15-second reading phase begins automatically before voting.
- All connected players secretly vote for another connected player.
- Players cannot vote for themselves.
- Voting lasts at most 30 seconds.
- If everyone votes early, the server ends voting immediately.
- The server reveals all votes, identifies the target group with the highest vote count, and awards 1 point to every voter who chose one of those top-voted targets.
- The game ends after the configured number of rounds.

### Dictator Mode

- The dictator rotates in seat order based on the players present when the game starts.
- Each round starts with the prompt card revealed, followed by a 15-second reading phase.
- During voting, the dictator secretly chooses one other player.
- Every non-dictator player votes for the player they believe the dictator selected.
- Voting lasts at most 30 seconds and ends early if everyone submits.
- During reveal, the table sees the dictator's hidden choice and every player's guess.
- Every non-dictator player who guessed correctly earns 1 point.
- If nobody guessed correctly, every player who voted for the most popular guessed target earns 1 point.
- The dictator earns no points during their own turn.
- If the scheduled dictator is disconnected when their turn arrives, the server skips their round and moves to the next available dictator.
- The game ends after every starting player has had a dictator slot considered once.

## Rules Modal

The client includes an in-game rules modal in Italian that mirrors the scoring rules above, the 15-second reading phase, the 30-second voting phase, and the 3-player minimum / 14-player maximum.

## In-Game Layout

- The prompt card stays in the center of a poker-style table visual
- Player cards are distributed around the table perimeter based on seat order and player count
- Voting controls appear below the table during the voting phase
- The board remains responsive across desktop, tablet, and mobile, keeping the table-centric feel

## Customizing Characters

Edit these files:

- Character metadata: [server/src/data/characters.json](/c:/Users/camma/Desktop/gioco/server/src/data/characters.json)
- Character SVG art: [client/public/assets/characters](/c:/Users/camma/Desktop/gioco/client/public/assets/characters)

Each character entry includes a stable `id`, `name`, `title`, palette info, and an asset path so you can swap art later without changing gameplay code.

## Customizing Prompt Cards

Edit:

- Prompt deck: [server/src/data/prompts.json](/c:/Users/camma/Desktop/gioco/server/src/data/prompts.json)

The default deck is localized in Italian. The backend shuffles the deck, avoids repeats until exhaustion, and then reshuffles automatically.

## Persistence

The server writes JSON to:

- Storage file: [server/src/persistence/storage.json](/c:/Users/camma/Desktop/gioco/server/src/persistence/storage.json)

Stored data includes:

- All-time wins by display name
- Last room results

The file is created automatically on first run.

## Backend Robustness

- The server binds with `process.env.PORT || 3001`
- Socket.IO shares the same HTTP server as Express
- Production serving keeps API routes and sockets intact
- Startup, room creation, join failures, vote failures, and disconnects are logged
- Unhandled promise rejections and uncaught exceptions are surfaced in server logs

## Key Implementation Decisions

- Game title: Spotlight Suspects
- Room code format: 5 uppercase letters
- Persistence method: JSON file storage for zero-setup local use
- Reconnect policy: browser session token restores a player seat if the same room is rejoined
- Minimum players to start: 3 connected players
- Maximum room size: 14 players
- Classic tie rule: every tied top-voted player gets 1 point
- Dictator scoring: target always gets 1 point, dictator gets 1 bonus point only for matching the top crowd set
- Client preference persistence: mute state and reconnect session are stored in local storage

## Future Improvements

- Add private host controls for custom timers and tie rules
- Add spectator mode and stronger reconnect recovery
- Add richer sound packs and alternate board themes
- Add analytics and per-room history browsing
