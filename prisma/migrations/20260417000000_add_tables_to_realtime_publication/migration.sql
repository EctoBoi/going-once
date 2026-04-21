-- Add all realtime-subscribed tables to the supabase_realtime WAL publication
-- so that postgres_changes events include full row payloads instead of
-- returning empty records with a 401 error from the REST fallback.

DO $migration$
BEGIN
	IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
		IF NOT EXISTS (
			SELECT 1
			FROM pg_publication_tables
			WHERE pubname = 'supabase_realtime'
				AND schemaname = 'public'
				AND tablename = 'Auction'
		) THEN
			ALTER PUBLICATION supabase_realtime ADD TABLE public."Auction";
		END IF;

		IF to_regclass('public."Player"') IS NOT NULL AND NOT EXISTS (
			SELECT 1
			FROM pg_publication_tables
			WHERE pubname = 'supabase_realtime'
				AND schemaname = 'public'
				AND tablename = 'Player'
		) THEN
			ALTER PUBLICATION supabase_realtime ADD TABLE public."Player";
		END IF;

		IF NOT EXISTS (
			SELECT 1
			FROM pg_publication_tables
			WHERE pubname = 'supabase_realtime'
				AND schemaname = 'public'
				AND tablename = 'PlayerItem'
		) THEN
			ALTER PUBLICATION supabase_realtime ADD TABLE public."PlayerItem";
		END IF;

		IF NOT EXISTS (
			SELECT 1
			FROM pg_publication_tables
			WHERE pubname = 'supabase_realtime'
				AND schemaname = 'public'
				AND tablename = 'Bid'
		) THEN
			ALTER PUBLICATION supabase_realtime ADD TABLE public."Bid";
		END IF;
	END IF;
END
$migration$;
