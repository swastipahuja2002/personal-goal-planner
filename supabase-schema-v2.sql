-- Run this in Supabase SQL Editor AFTER the first schema

-- Life Map: structured JSON that the app maintains
CREATE TABLE life_map (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insights: patterns the AI notices over time
CREATE TABLE insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL, -- pattern, achievement, warning, phase_change
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- XP / Gamification tracking
CREATE TABLE xp_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL, -- workout, applied, checked_in, milestone_done, etc.
  xp_amount INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Achievements / badges
CREATE TABLE achievements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  unlocked BOOLEAN DEFAULT FALSE,
  unlocked_at TIMESTAMPTZ,
  category TEXT, -- consistency, milestone, social, builder
  xp_reward INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE life_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE xp_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON life_map FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON insights FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON xp_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON achievements FOR ALL USING (true) WITH CHECK (true);

-- Insert an example life map (edit to match your own life)
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
  ],
  "weekend_slots": ["Deep work", "Learning", "Rest & hobbies"],
  "phase_triggers": {
    "career_goal_done": ["Start the next learning goal", "Celebrate properly"],
    "side_project_shipped": ["Begin the bigger project", "Share it publicly"]
  },
  "fitness_tracker": {
    "days_this_week": 0,
    "last_went": null,
    "target": "4 days/week"
  },
  "career_search": {
    "applications_sent": 0,
    "interviews_scheduled": 0,
    "callbacks": 0,
    "target_companies": ["Company A", "Company B", "Company C"]
  }
}'::jsonb);

-- Insert example achievements (rename / re-theme these for your own goals)
INSERT INTO achievements (title, description, icon, category, xp_reward) VALUES
('First Blood', 'Complete your first day with all priorities done', '⚔️', 'milestone', 50),
('Consistency (Week 1)', 'Hit your daily habit 5 days in a single week', '💪', 'consistency', 100),
('Consistency (Month 1)', 'Complete 4 consecutive weeks of your daily habit', '🔥', 'consistency', 500),
('Application Machine', 'Send 20 applications', '📨', 'milestone', 100),
('Interview Ready', 'Complete 5 interviews', '🎯', 'milestone', 200),
('Goal Landed', 'Achieve your top career goal', '🏆', 'milestone', 1000),
('Builder Mode', 'Ship your side project MVP', '🛠️', 'builder', 300),
('Networker', 'Reach out to 10 people in your field', '✉️', 'milestone', 200),
('Certified', 'Pass a target certification or exam', '📝', 'milestone', 500),
('7-Day Streak', 'Check in 7 days in a row', '🔥', 'consistency', 150),
('30-Day Streak', 'Check in 30 days in a row', '⭐', 'consistency', 500),
('Fitness Milestone', 'Hit a fitness milestone', '⚖️', 'milestone', 300),
('Deep Focus', 'Log 5 productive focus sessions in a week', '🦉', 'consistency', 100),
('Spotlight', 'Complete something worth sharing publicly', '📰', 'milestone', 250);
