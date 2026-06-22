-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS daily_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  task_date DATE NOT NULL DEFAULT CURRENT_DATE,
  completed BOOLEAN DEFAULT FALSE,
  rolled_from DATE,
  roll_count INTEGER DEFAULT 0,
  skip_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS day_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  log_date DATE NOT NULL,
  hour_slot TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(log_date, hour_slot)
);

ALTER TABLE daily_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON daily_tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON day_logs FOR ALL USING (true) WITH CHECK (true);
