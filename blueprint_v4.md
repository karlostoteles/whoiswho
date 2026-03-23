# Claude Code Blueprint V4: Server-Authoritative State Machine

Execute this blueprint to migrate guessNFT from ephemeral broadcast events to a strict, database-driven state machine.

## 1. Database Schema Additions
In `supabase-schema.sql`, add the following columns to the `games` table:
```sql
  current_phase       text,
  current_question    jsonb,
  current_answer      boolean,
  eliminated_p1       text[] default '{}',
  eliminated_p2       text[] default '{}',
```
*(Also apply these via the Supabase Dashboard SQL Editor manually or advise the human to do it).*

## 2. Update Supabase Types & Services
In `supabase/types.ts`:
- Add `current_phase`, `current_question`, `current_answer`, `eliminated_p1`, `eliminated_p2` to the `SupabaseGame` interface.

In `supabase/gameService.ts`:
- Add a new function:
  ```ts
  export async function updateGameState(gameId: string, updates: Partial<SupabaseGame>) {
    await supabase.from('games').update(updates).eq('id', gameId);
  }
  ```
- Modify `updateTurn` to nullify the current turn state:
  ```ts
  export async function updateTurn(gameId: string, activePlayerNum: 1 | 2, turnNumber: number): Promise<void> {
    await supabase.from('games').update({
      active_player_num: activePlayerNum,
      turn_number: turnNumber,
      current_phase: 'QUESTION_SELECT',
      current_question: null,
      current_answer: null,
      updated_at: new Date().toISOString(),
    }).eq('id', gameId);
  }
  ```

## 3. Burn the Ephemeral Broadcasts
In `useOnlineGameSync.ts`:
- **Delete** the `channel.send({ type: 'broadcast', ... })` calls for `QUESTION_ASKED`, `ANSWER_GIVEN`, `ELIMINATION_UPDATE`.
- **Delete** the `channel.on('broadcast', ...)` listener that handles these events.
- Keep only the Presence hook (for disconnects) and the `postgres_changes` hook.

## 4. Drive Local State strictly from the DB Row
In `gameStore.ts`, add a master sync action:
```ts
syncOnlineStateFromDB: (game: SupabaseGame) => set((state) => {
  if (state.mode !== 'online') return;
  // If the DB explicitly dictates a phase, snap to it.
  if (game.current_phase) {
    state.phase = game.current_phase as GamePhase;
  }
  if (game.current_question) {
    state.currentQuestion = game.current_question as QuestionRecord;
  }
  // Sync eliminations
  state.players.player1.eliminatedCharacterIds = game.eliminated_p1 || [];
  state.players.player2.eliminatedCharacterIds = game.eliminated_p2 || [];
  
  // Apply other scalar fields (turn number, active player)
  const nextPlayer = game.active_player_num === 1 ? 'player1' : 'player2';
  state.turnNumber = game.turn_number;
  state.activePlayer = nextPlayer;
})
```
*Note: Ensure `isCorrect` verification logic is moved to the place where DB updates happen, or handled safely within the DB sync.*

## 5. Rewrite Output Actions
Update `askQuestion`, `answerQuestion`, and `finishElimination` in `gameStore.ts`.
- When `askQuestion` fires in online mode, do NOT broadcast. Call `updateGameState` with `{ current_phase: 'ANSWER_PENDING', current_question: payload }`.
- When `answerQuestion` fires, call `updateGameState` with `{ current_phase: 'ANSWER_REVEALED', current_answer: bool }`.
- When `finishElimination` fires, push the updated `eliminatedCharacterIds` array to `eliminated_p1` or `eliminated_p2` in the DB via `updateGameState`.

**Constraint:** The `handleGameUpdate` hook in `useOnlineGameSync.ts` must listen to the DB `UPDATE` and instantly call `state.syncOnlineStateFromDB(game)`. This way, both clients are perfectly puppeteered by the database row.
