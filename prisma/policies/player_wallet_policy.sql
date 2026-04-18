-- Ensure broadcasts to a player's wallet topic are only allowed when the topic matches the authenticated user
-- Run this in your Supabase SQL editor (or include as a migration).

-- Drop existing policy if present (safe for re-run during development)
DROP POLICY IF EXISTS player_wallet_can_send ON realtime.messages;

CREATE POLICY player_wallet_can_send
  ON realtime.messages
  TO authenticated
  USING (true)
  WITH CHECK (
    extension = 'broadcast'
    AND topic = ('player-wallet:' || auth.uid())
  );

-- Notes:
-- - This requires Postgres' RLS context to have the authenticated JWT available (Supabase does this for authenticated connections).
-- - It enforces that any insert/update that creates a broadcast message for 'player-wallet:*' must have the exact topic matching the caller's auth.uid().
-- - If you also have server-side processes that need to publish broadcasts for other users, run those as the service role (server-side) which bypasses RLS.
