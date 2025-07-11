/*
  # Create roadmaps table

  1. New Tables
    - `roadmaps`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `roadmap_id` (text, unique identifier for the roadmap)
      - `subject` (text)
      - `difficulty` (text)
      - `description` (text)
      - `total_duration` (text)
      - `estimated_hours` (text)
      - `prerequisites` (jsonb)
      - `learning_outcomes` (jsonb)
      - `chapters` (jsonb)
      - `generated_at` (timestamp)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `roadmaps` table
    - Add policy for authenticated users to read their own roadmaps
    - Add policy for authenticated users to manage their own roadmaps
*/

CREATE TABLE IF NOT EXISTS roadmaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  roadmap_id text NOT NULL,
  subject text NOT NULL,
  difficulty text NOT NULL,
  description text NOT NULL,
  total_duration text NOT NULL,
  estimated_hours text NOT NULL,
  prerequisites jsonb DEFAULT '[]'::jsonb,
  learning_outcomes jsonb DEFAULT '[]'::jsonb,
  chapters jsonb DEFAULT '[]'::jsonb,
  generated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE roadmaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own roadmaps"
  ON roadmaps
  FOR SELECT
  TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::text));

CREATE POLICY "Users can insert own roadmaps"
  ON roadmaps
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::text));

CREATE POLICY "Users can update own roadmaps"
  ON roadmaps
  FOR UPDATE
  TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::text));

CREATE POLICY "Users can delete own roadmaps"
  ON roadmaps
  FOR DELETE
  TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::text));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_roadmaps_user_id ON roadmaps(user_id);
CREATE INDEX IF NOT EXISTS idx_roadmaps_roadmap_id ON roadmaps(roadmap_id);

-- Create unique constraint to prevent duplicate roadmaps per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_roadmaps_user_roadmap 
ON roadmaps(user_id, roadmap_id);