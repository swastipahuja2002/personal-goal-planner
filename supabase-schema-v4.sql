-- Run in Supabase SQL Editor

ALTER TABLE daily_tasks ADD COLUMN IF NOT EXISTS recurrence TEXT;
-- values: null | 'daily' | 'weekly:1' (Mon) ... 'weekly:7' (Sun) | 'monthly:8' (8th of month)

ALTER TABLE day_logs ADD COLUMN IF NOT EXISTS span_hours INTEGER DEFAULT 1;
-- for multi-hour blocks (e.g. sleeping = 8)
