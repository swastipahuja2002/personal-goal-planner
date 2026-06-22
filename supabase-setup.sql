-- =============================================================
-- Goal Planner — full database setup (run once)
-- Supabase Dashboard > your project > SQL Editor > New query > paste all > Run
-- This creates every table and seeds a set of EXAMPLE goals/habits.
-- =============================================================

-- ---------- Core tables ----------
CREATE TABLE goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- career, health, education, impact, personal
  status TEXT DEFAULT 'active', -- active, completed, paused
  priority INTEGER DEFAULT 0, -- higher = more important
  target_date DATE,
  progress INTEGER DEFAULT 0, -- 0-100
  current_phase TEXT,
  icon TEXT,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE milestones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target_date DATE,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE habits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  frequency TEXT DEFAULT 'daily', -- daily, weekdays, weekends
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE habit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  habit_id UUID REFERENCES habits(id) ON DELETE CASCADE,
  completed_date DATE NOT NULL,
  completed BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(habit_id, completed_date)
);

CREATE TABLE checkins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  week_start DATE NOT NULL,
  responses JSONB NOT NULL,
  ai_feedback TEXT,
  score INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  role TEXT NOT NULL, -- user, assistant
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE weekly_priorities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(week_start)
);

-- ---------- Daily tracking tables ----------
CREATE TABLE IF NOT EXISTS daily_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  task_date DATE NOT NULL DEFAULT CURRENT_DATE,
  completed BOOLEAN DEFAULT FALSE,
  rolled_from DATE,
  roll_count INTEGER DEFAULT 0,
  skip_reason TEXT,
  recurrence TEXT, -- null | 'daily' | 'weekly:1'..'weekly:7' | 'monthly'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS day_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  log_date DATE NOT NULL,
  hour_slot TEXT NOT NULL,
  content TEXT,
  span_hours INTEGER DEFAULT 1, -- multi-hour blocks
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(log_date, hour_slot)
);

-- ---------- Gamification + insights ----------
CREATE TABLE life_map (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE xp_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  xp_amount INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE achievements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  unlocked BOOLEAN DEFAULT FALSE,
  unlocked_at TIMESTAMPTZ,
  category TEXT,
  xp_reward INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- Activity log ----------
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  entity_title TEXT,
  goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  metadata JSONB,
  source TEXT DEFAULT 'web',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- Row Level Security (single-user: allow all) ----------
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_priorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE life_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE xp_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON goals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON milestones FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON habits FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON habit_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON checkins FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON chat_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON weekly_priorities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON daily_tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON day_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON life_map FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON insights FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON xp_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON achievements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON activity_log FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS activity_log_created_at_idx ON activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS activity_log_entity_type_idx ON activity_log (entity_type);

-- =============================================================
-- EXAMPLE SEED DATA — replace with your own once you're set up
-- =============================================================
INSERT INTO goals (title, description, category, priority, target_date, progress, current_phase, icon, color) VALUES
('Land a New Role', 'Switch into your target field or company', 'career', 10, '2026-05-15', 15, 'Applying & Interviewing', 'Briefcase', '#f472b6'),
('Get Fit', 'Build a consistent exercise and nutrition routine', 'health', 9, '2026-12-31', 5, 'Starting routine', 'Dumbbell', '#fb923c'),
('Pass a Certification', 'Study for and clear a target exam or certification', 'education', 7, '2026-08-31', 0, 'Not started', 'BookOpen', '#60a5fa'),
('Further Studies', 'Research programs and submit applications', 'education', 8, '2026-12-31', 10, 'Research phase', 'GraduationCap', '#a78bfa'),
('Build a Reputation', 'Grow visibility through writing, talks and projects', 'impact', 6, '2028-03-31', 5, 'Building foundation', 'Trophy', '#fbbf24'),
('Ship a Side Project', 'Build and launch a real product with users', 'impact', 7, '2027-03-31', 0, 'Ideation phase', 'Globe', '#34d399'),
('Give Back', 'Volunteer or contribute to a cause you care about', 'impact', 5, '2026-09-30', 0, 'Exploring options', 'Heart', '#f87171'),
('Hobby & Joy', 'Keep a hobby that keeps life fun and balanced', 'personal', 4, NULL, 20, 'Ongoing', 'Music', '#e879f9');

INSERT INTO milestones (goal_id, title, target_date, sort_order) VALUES
((SELECT id FROM goals WHERE title = 'Land a New Role'), 'Update resume & portfolio', '2026-04-10', 1),
((SELECT id FROM goals WHERE title = 'Land a New Role'), 'Apply to 20+ roles', '2026-04-20', 2),
((SELECT id FROM goals WHERE title = 'Land a New Role'), 'Complete 5 interviews', '2026-05-01', 3),
((SELECT id FROM goals WHERE title = 'Land a New Role'), 'Accept offer', '2026-05-15', 4),
((SELECT id FROM goals WHERE title = 'Get Fit'), 'Set a weekly workout schedule', '2026-04-10', 1),
((SELECT id FROM goals WHERE title = 'Get Fit'), 'Complete 4 consistent weeks', '2026-05-10', 2),
((SELECT id FROM goals WHERE title = 'Get Fit'), 'Hit first fitness milestone', '2026-07-31', 3),
((SELECT id FROM goals WHERE title = 'Get Fit'), 'Hit second fitness milestone', '2026-11-30', 4),
((SELECT id FROM goals WHERE title = 'Further Studies'), 'Shortlist 10 programs', '2026-05-31', 1),
((SELECT id FROM goals WHERE title = 'Further Studies'), 'Reach out to 15 contacts', '2026-06-30', 2),
((SELECT id FROM goals WHERE title = 'Further Studies'), 'Prepare application materials', '2026-08-31', 3),
((SELECT id FROM goals WHERE title = 'Further Studies'), 'Submit all applications', '2026-12-31', 4),
((SELECT id FROM goals WHERE title = 'Pass a Certification'), 'Start daily 1hr practice', '2026-06-15', 1),
((SELECT id FROM goals WHERE title = 'Pass a Certification'), 'Take mock test #1', '2026-07-15', 2),
((SELECT id FROM goals WHERE title = 'Pass a Certification'), 'Take the actual exam', '2026-08-31', 3);

INSERT INTO habits (goal_id, title, frequency) VALUES
((SELECT id FROM goals WHERE title = 'Land a New Role'), 'Apply to 2 roles or do 1 interview prep', 'weekdays'),
((SELECT id FROM goals WHERE title = 'Get Fit'), 'Exercise', 'weekdays'),
((SELECT id FROM goals WHERE title = 'Get Fit'), 'Eat a protein-rich meal', 'daily'),
((SELECT id FROM goals WHERE title = 'Further Studies'), 'Research 1 program or email 1 contact', 'weekdays'),
((SELECT id FROM goals WHERE title = 'Build a Reputation'), 'Post on social / write', 'weekdays'),
((SELECT id FROM goals WHERE title = 'Ship a Side Project'), 'Work on the side project (30 min)', 'daily'),
((SELECT id FROM goals WHERE title = 'Hobby & Joy'), 'Spend time on a hobby', 'weekends');

INSERT INTO life_map (data) VALUES ('{
  "current_phase": "Focused Sprint",
  "phase_started": "2026-01-01",
  "active_priorities": [
    {"name": "Career Goal", "status": "active", "urgency": "critical"},
    {"name": "Side Project", "status": "active", "urgency": "high"},
    {"name": "Exercise", "status": "active", "urgency": "daily"}
  ],
  "waiting": [
    {"name": "Certification", "trigger": "career_goal_done", "note": "After landing the role"},
    {"name": "Bigger Project", "trigger": "side_project_shipped", "note": "Next phase"}
  ]
}'::jsonb);

INSERT INTO achievements (title, description, icon, category, xp_reward) VALUES
('First Blood', 'Complete your first day with all priorities done', '⚔️', 'milestone', 50),
('Consistency (Week 1)', 'Hit your daily habit 5 days in a single week', '💪', 'consistency', 100),
('Consistency (Month 1)', 'Complete 4 consecutive weeks of your daily habit', '🔥', 'consistency', 500),
('Application Machine', 'Send 20 applications', '📨', 'milestone', 100),
('Goal Landed', 'Achieve your top career goal', '🏆', 'milestone', 1000),
('Builder Mode', 'Ship your side project MVP', '🛠️', 'builder', 300),
('Certified', 'Pass a target certification or exam', '📝', 'milestone', 500),
('30-Day Streak', 'Check in 30 days in a row', '⭐', 'consistency', 500);
