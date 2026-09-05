-- Base schema, unchanged from luma-clone's database-setup.sql except for the
-- DROP POLICY IF EXISTS lines, which make `supabase db push` re-runnable.
-- Everything this project adds lives in the later migrations.

-- Create events table
CREATE TABLE IF NOT EXISTS events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  location TEXT,
  is_public BOOLEAN DEFAULT true,
  is_free BOOLEAN DEFAULT true,
  requires_approval BOOLEAN DEFAULT false,
  capacity INTEGER,
  theme TEXT DEFAULT 'minimal',
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create attendees table
CREATE TABLE IF NOT EXISTS attendees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- Enable Row Level Security (RLS)
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendees ENABLE ROW LEVEL SECURITY;

-- Create policies for events table
DROP POLICY IF EXISTS "Users can view public events" ON events;
CREATE POLICY "Users can view public events" ON events
  FOR SELECT USING (is_public = true OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own events" ON events;
CREATE POLICY "Users can create their own events" ON events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own events" ON events;
CREATE POLICY "Users can update their own events" ON events
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own events" ON events;
CREATE POLICY "Users can delete their own events" ON events
  FOR DELETE USING (auth.uid() = user_id);

-- Create policies for attendees table
DROP POLICY IF EXISTS "Users can view event attendees" ON attendees;
CREATE POLICY "Users can view event attendees" ON attendees
  FOR SELECT USING (
    auth.uid() = user_id OR 
    EXISTS (
      SELECT 1 FROM events 
      WHERE events.id = attendees.event_id 
      AND events.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can register for events" ON attendees;
CREATE POLICY "Users can register for events" ON attendees
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own attendance" ON attendees;
CREATE POLICY "Users can update their own attendance" ON attendees
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Event owners can manage attendees" ON attendees;
CREATE POLICY "Event owners can manage attendees" ON attendees
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM events 
      WHERE events.id = attendees.event_id 
      AND events.user_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date);
CREATE INDEX IF NOT EXISTS idx_events_public ON events(is_public);
CREATE INDEX IF NOT EXISTS idx_attendees_event_id ON attendees(event_id);
CREATE INDEX IF NOT EXISTS idx_attendees_user_id ON attendees(user_id);
