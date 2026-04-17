-- Enable RLS on tables that Supabase Realtime watches and add SELECT policies
-- so the realtime service can deliver row payloads to authenticated clients.
-- Without these policies the realtime worker returns error 401 / empty records.

-- Auction: all active auctions are public game data
ALTER TABLE public."Auction" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "realtime_select_auction"
    ON public."Auction"
    FOR SELECT
    TO authenticated
    USING (true);

-- Bid: bids are public game data
ALTER TABLE public."Bid" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "realtime_select_bid"
    ON public."Bid"
    FOR SELECT
    TO authenticated
    USING (true);

-- Player: only the owning player may read their own row via realtime
ALTER TABLE public."Player" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "realtime_select_own_player"
    ON public."Player"
    FOR SELECT
    TO authenticated
    USING (id = auth.uid()::text);

-- PlayerItem: only the owning player may read their own items via realtime
ALTER TABLE public."PlayerItem" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "realtime_select_own_player_item"
    ON public."PlayerItem"
    FOR SELECT
    TO authenticated
    USING ("playerId" = auth.uid()::text);
