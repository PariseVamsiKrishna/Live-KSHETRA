-- ============================================================
-- Live Kshetra — Database Migration 001
-- Run via: supabase db push  OR  paste in Supabase SQL Editor
-- ============================================================

-- ─── 1. Rooms table ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rooms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT UNIQUE NOT NULL,
  title       TEXT DEFAULT 'Live Kshetra Meeting',
  locked      BOOLEAN DEFAULT false,
  created_by  UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ─── 2. Room participants table ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.room_participants (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code    TEXT NOT NULL REFERENCES public.rooms(code) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT 'Guest',
  joined_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(room_code, user_id)
);

-- ─── 3. Enable Row Level Security ───────────────────────────
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_participants ENABLE ROW LEVEL SECURITY;

-- ─── 4. Policies for rooms ───────────────────────────────────

CREATE POLICY "Users can create rooms"
  ON public.rooms FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Participants can view room details"
  ON public.rooms FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.room_participants
      WHERE room_participants.room_code = rooms.code
        AND room_participants.user_id = auth.uid()
    ) OR created_by = auth.uid()
  );

-- Host can lock/unlock their own room
CREATE POLICY "Host can update room"
  ON public.rooms FOR UPDATE TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- ─── 5. Policies for room_participants ──────────────────────

CREATE POLICY "Users can join rooms"
  ON public.room_participants FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view participants in their room"
  ON public.room_participants FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.room_participants rp
      WHERE rp.room_code = room_participants.room_code
        AND rp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can leave rooms"
  ON public.room_participants FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ─── 6. Realtime Authorization on realtime.messages ─────────
-- Requires Supabase project version >= Dec 2024 (Realtime RLS)
-- Enable via: Dashboard → Realtime → Policies

CREATE POLICY "Authorized participants can receive signals"
  ON realtime.messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.room_participants rp
      WHERE rp.room_code = SUBSTRING(realtime.topic() FROM 'room:(.*)')
        AND rp.user_id = auth.uid()
    )
  );

CREATE POLICY "Authorized participants can send signals"
  ON realtime.messages FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.room_participants rp
      WHERE rp.room_code = SUBSTRING(realtime.topic() FROM 'room:(.*)')
        AND rp.user_id = auth.uid()
    )
  );
