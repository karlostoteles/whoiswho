export { supabase, isSupabaseConfigured } from './client';
export { createGame, joinGame, sendEvent, submitCommitment, updateTurn, finishGame, revealCharacter, getGame, getPastEvents, subscribeToGame, subscribeToEvents } from './gameService';
export type { GameStatus, OnlineEventType, SupabaseGame, SupabaseGameEvent } from './types';
