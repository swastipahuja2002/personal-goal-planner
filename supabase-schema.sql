-- Run this in Supabase SQL Editor (supabase.com > your project > SQL Editor > New Query)

-- Goals table
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

-- Milestones for each goal
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

-- Daily habits
CREATE TABLE habits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  frequency TEXT DEFAULT 'daily', -- daily, weekdays, weekends
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habit completions (one row per habit per day)
CREATE TABLE habit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  habit_id UUID REFERENCES habits(id) ON DELETE CASCADE,
  completed_date DATE NOT NULL,
  completed BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(habit_id, completed_date)
);

-- Weekly check-ins
CREATE TABLE checkins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  week_start DATE NOT NULL,
  responses JSONB NOT NULL, -- answers to the 5 questions
  ai_feedback TEXT, -- Claude's analysis
  score INTEGER, -- 1-10
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages with AI coach
CREATE TABLE chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  role TEXT NOT NULL, -- user, assistant
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Weekly priority
CREATE TABLE weekly_priorities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(week_start)
);

-- Enable Row Level Security (but allow all for now — single user app)
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_priorities ENABLE ROW LEVEL SECURITY;

-- Policies: allow all operations (single user, no auth yet)
CREATE POLICY "Allow all" ON goals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON milestones FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON habits FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON habit_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON checkins FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON chat_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON weekly_priorities FOR ALL USING (true) WITH CHECK (true);

-- Example seed goals — replace these with your own
INSERT INTO goals (title, description, category, priority, target_date, progress, current_phase, icon, color) VALUES
('Land a New Role', 'Switch into your target field or company', 'career', 10, '2026-05-15', 15, 'Applying & Interviewing', 'Briefcase', '#f472b6'),
('Get Fit', 'Build a consistent exercise and nutrition routine', 'health', 9, '2026-12-31', 5, 'Starting routine', 'Dumbbell', '#fb923c'),
('Pass a Certification', 'Study for and clear a target exam or certification', 'education', 7, '2026-08-31', 0, 'Not started', 'BookOpen', '#60a5fa'),
('Further Studies', 'Research programs and submit applications', 'education', 8, '2026-12-31', 10, 'Research phase', 'GraduationCap', '#a78bfa'),
('Build a Reputation', 'Grow visibility through writing, talks and projects', 'impact', 6, '2028-03-31', 5, 'Building foundation', 'Trophy', '#fbbf24'),
('Ship a Side Project', 'Build and launch a real product with users', 'impact', 7, '2027-03-31', 0, 'Ideation phase', 'Globe', '#34d399'),
('Give Back', 'Volunteer or contribute to a cause you care about', 'impact', 5, '2026-09-30', 0, 'Exploring options', 'Heart', '#f87171'),
('Hobby & Joy', 'Keep a hobby that keeps life fun and balanced', 'personal', 4, NULL, 20, 'Ongoing', 'Music', '#e879f9');

-- Example milestones for top goals
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

-- Example habits tied to goals
INSERT INTO habits (goal_id, title, frequency) VALUES
((SELECT id FROM goals WHERE title = 'Land a New Role'), 'Apply to 2 roles or do 1 interview prep', 'weekdays'),
((SELECT id FROM goals WHERE title = 'Get Fit'), 'Exercise', 'weekdays'),
((SELECT id FROM goals WHERE title = 'Get Fit'), 'Eat a protein-rich meal', 'daily'),
((SELECT id FROM goals WHERE title = 'Further Studies'), 'Research 1 program or email 1 contact', 'weekdays'),
((SELECT id FROM goals WHERE title = 'Build a Reputation'), 'Post on social / write', 'weekdays'),
((SELECT id FROM goals WHERE title = 'Ship a Side Project'), 'Work on the side project (30 min)', 'daily'),
((SELECT id FROM goals WHERE title = 'Hobby & Joy'), 'Spend time on a hobby', 'weekends');
