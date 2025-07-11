/*
  # Create learning history table

  1. New Tables
    - `learning_history`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `subject` (text)
      - `difficulty` (text)
      - `roadmap_id` (text)
      - `chapter_progress` (jsonb)
      - `learning_preferences` (jsonb)
      - `started_at` (timestamp)
      - `last_accessed_at` (timestamp)
      - `completed_at` (timestamp, nullable)
      - `time_spent` (text, nullable)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `learning_history` table
    - Add policy for authenticated users to read their own history
    - Add policy for authenticated users to manage their own history
*/

CREATE TABLE IF NOT EXISTS learning_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  difficulty text NOT NULL,
  roadmap_id text NOT NULL,
  chapter_progress jsonb DEFAULT '[]'::jsonb,
  learning_preferences jsonb DEFAULT '{}'::jsonb,
  started_at timestamptz DEFAULT now(),
  last_accessed_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  time_spent text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE learning_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own learning history"
  ON learning_history
  FOR SELECT
  TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::text));

CREATE POLICY "Users can insert own learning history"
  ON learning_history
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::text));

CREATE POLICY "Users can update own learning history"
  ON learning_history
  FOR UPDATE
  TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::text));

CREATE POLICY "Users can delete own learning history"
  ON learning_history
  FOR DELETE
  TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::text));

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_learning_history_user_id ON learning_history(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_history_roadmap_id ON learning_history(roadmap_id);