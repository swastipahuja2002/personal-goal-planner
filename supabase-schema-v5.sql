-- Activity log: captures every meaningful action from desktop or mobile
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  -- e.g. 'task.complete', 'task.add', 'habit.log', 'kr.complete', 'checkin.submit', 'goal.phase_update'
  entity_type TEXT,        -- 'task' | 'habit' | 'milestone' | 'goal' | 'checkin'
  entity_id TEXT,    
        -- the id of the thing acted on
  entity_title TEXT,       -- human-readable label for easy reading
  goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  metadata JSONB,          -- any extra context (e.g. { from: false, to: true } for a toggle)
  source TEXT DEFAULT 'web',  -- 'web' | 'mobile' (set client-side via user agent)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON activity_log FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS activity_log_created_at_idx ON activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS activity_log_entity_type_idx ON activity_log (entity_type);
