-- Add all realtime-subscribed tables to the supabase_realtime WAL publication
-- so that postgres_changes events include full row payloads instead of
-- returning empty records with a 401 error from the REST fallback.

ALTER PUBLICATION supabase_realtime ADD TABLE public."Auction";
ALTER PUBLICATION supabase_realtime ADD TABLE public."player";
ALTER PUBLICATION supabase_realtime ADD TABLE public."PlayerItem";
ALTER PUBLICATION supabase_realtime ADD TABLE public."Bid";
