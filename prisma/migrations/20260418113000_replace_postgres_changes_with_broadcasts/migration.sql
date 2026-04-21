-- Replace client-side postgres_changes subscriptions with realtime.broadcast_changes()
-- trigger-based broadcasts.

DO $migration$
BEGIN
  IF to_regnamespace('realtime') IS NOT NULL
     AND to_regrole('authenticated') IS NOT NULL
     AND to_regclass('realtime.messages') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM pg_proc proc
       JOIN pg_namespace namespace ON namespace.oid = proc.pronamespace
       WHERE namespace.nspname = 'realtime'
         AND proc.proname = 'broadcast_changes'
     ) THEN
    -- Broadcast receive policies for authenticated users.
    DROP POLICY IF EXISTS auction_feed_can_receive ON realtime.messages;
    CREATE POLICY auction_feed_can_receive
    ON realtime.messages
    FOR SELECT
    TO authenticated
    USING (
      extension = 'broadcast'
      AND topic = 'public:Auction:feed'
    );

    DROP POLICY IF EXISTS auction_detail_can_receive ON realtime.messages;
    CREATE POLICY auction_detail_can_receive
    ON realtime.messages
    FOR SELECT
    TO authenticated
    USING (
      extension = 'broadcast'
      AND topic LIKE 'auction-detail:%'
    );

    DROP POLICY IF EXISTS player_wallet_can_send ON realtime.messages;
    CREATE POLICY player_wallet_can_send
    ON realtime.messages
    FOR INSERT
    TO authenticated
    WITH CHECK (
      extension = 'broadcast'
      AND topic = ('player-wallet:' || auth.uid())
    );

    DROP POLICY IF EXISTS player_wallet_can_receive ON realtime.messages;
    CREATE POLICY player_wallet_can_receive
    ON realtime.messages
    FOR SELECT
    TO authenticated
    USING (
      extension = 'broadcast'
      AND topic = ('player-wallet:' || auth.uid())
    );

    DROP POLICY IF EXISTS player_items_can_send ON realtime.messages;
    CREATE POLICY player_items_can_send
    ON realtime.messages
    FOR INSERT
    TO authenticated
    WITH CHECK (
      extension = 'broadcast'
      AND topic = ('player-items:' || auth.uid())
    );

    DROP POLICY IF EXISTS player_items_can_receive ON realtime.messages;
    CREATE POLICY player_items_can_receive
    ON realtime.messages
    FOR SELECT
    TO authenticated
    USING (
      extension = 'broadcast'
      AND topic = ('player-items:' || auth.uid())
    );

    DROP POLICY IF EXISTS player_auctions_can_send ON realtime.messages;
    CREATE POLICY player_auctions_can_send
    ON realtime.messages
    FOR INSERT
    TO authenticated
    WITH CHECK (
      extension = 'broadcast'
      AND topic = ('player-auctions:' || auth.uid())
    );

    DROP POLICY IF EXISTS player_auctions_can_receive ON realtime.messages;
    CREATE POLICY player_auctions_can_receive
    ON realtime.messages
    FOR SELECT
    TO authenticated
    USING (
      extension = 'broadcast'
      AND topic = ('player-auctions:' || auth.uid())
    );

    CREATE OR REPLACE FUNCTION public.handle_auction_broadcast()
    RETURNS trigger
    SECURITY DEFINER
    LANGUAGE plpgsql
    AS $function$
    DECLARE
      auction_id text;
      seller_id text;
      winner_id text;
    BEGIN
      auction_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id::text ELSE NEW.id::text END;
      seller_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."listedBy" ELSE NEW."listedBy" END;
      winner_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."winningPlayerId" ELSE NEW."winningPlayerId" END;

      PERFORM realtime.broadcast_changes(
        'public:Auction:feed',
        TG_OP,
        TG_OP,
        TG_TABLE_NAME,
        TG_TABLE_SCHEMA,
        NEW,
        OLD
      );

      IF auction_id IS NOT NULL THEN
        PERFORM realtime.broadcast_changes(
          'auction-detail:' || auction_id,
          TG_OP,
          TG_OP,
          TG_TABLE_NAME,
          TG_TABLE_SCHEMA,
          NEW,
          OLD
        );
      END IF;

      IF seller_id IS NOT NULL THEN
        PERFORM realtime.broadcast_changes(
          'player-auctions:' || seller_id,
          TG_OP,
          TG_OP,
          TG_TABLE_NAME,
          TG_TABLE_SCHEMA,
          NEW,
          OLD
        );
      END IF;

      IF winner_id IS NOT NULL AND winner_id <> seller_id THEN
        PERFORM realtime.broadcast_changes(
          'player-auctions:' || winner_id,
          TG_OP,
          TG_OP,
          TG_TABLE_NAME,
          TG_TABLE_SCHEMA,
          NEW,
          OLD
        );
      END IF;

      RETURN NULL;
    END;
    $function$;

    CREATE OR REPLACE FUNCTION public.handle_bid_broadcast()
    RETURNS trigger
    SECURITY DEFINER
    LANGUAGE plpgsql
    AS $function$
    DECLARE
      auction_id text;
    BEGIN
      auction_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."auctionId"::text ELSE NEW."auctionId"::text END;

      IF auction_id IS NOT NULL THEN
        PERFORM realtime.broadcast_changes(
          'auction-detail:' || auction_id,
          TG_OP,
          TG_OP,
          TG_TABLE_NAME,
          TG_TABLE_SCHEMA,
          NEW,
          OLD
        );
      END IF;

      RETURN NULL;
    END;
    $function$;

    CREATE OR REPLACE FUNCTION public.handle_player_item_broadcast()
    RETURNS trigger
    SECURITY DEFINER
    LANGUAGE plpgsql
    AS $function$
    DECLARE
      player_id text;
    BEGIN
      player_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."playerId" ELSE NEW."playerId" END;

      IF player_id IS NOT NULL THEN
        PERFORM realtime.broadcast_changes(
          'player-items:' || player_id,
          TG_OP,
          TG_OP,
          TG_TABLE_NAME,
          TG_TABLE_SCHEMA,
          NEW,
          OLD
        );
      END IF;

      RETURN NULL;
    END;
    $function$;

    DROP TRIGGER IF EXISTS broadcast_auction_changes ON public."Auction";
    CREATE TRIGGER broadcast_auction_changes
    AFTER INSERT OR UPDATE OR DELETE ON public."Auction"
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_auction_broadcast();

    DROP TRIGGER IF EXISTS broadcast_bid_changes ON public."Bid";
    CREATE TRIGGER broadcast_bid_changes
    AFTER INSERT ON public."Bid"
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_bid_broadcast();

    DROP TRIGGER IF EXISTS broadcast_player_item_changes ON public."PlayerItem";
    CREATE TRIGGER broadcast_player_item_changes
    AFTER INSERT OR UPDATE OR DELETE ON public."PlayerItem"
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_player_item_broadcast();
  END IF;
END
$migration$;