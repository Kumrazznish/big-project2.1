/*
  # Create detailed courses table

  1. New Tables
    - `detailed_courses`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `roadmap_id` (text)
      - `title` (text)
      - `description` (text)
      - `chapters` (jsonb)
      - `generated_at` (timestamp)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `detailed_courses` table
    - Add policy for authenticated users to read their own courses
    - Add policy for authenticated users to manage their own courses
*/

CREATE TABLE IF NOT EXISTS detailed_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  roadmap_id text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  chapters jsonb DEFAULT '[]'::jsonb,
  generated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE detailed_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own detailed courses"
  ON detailed_courses
  FOR SELECT
  TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::text));

CREATE POLICY "Users can insert own detailed courses"
  ON detailed_courses
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::text));

CREATE POLICY "Users can update own detailed courses"
  ON detailed_courses
  FOR UPDATE
  TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::text));

CREATE POLICY "Users can delete own detailed courses"
  ON detailed_courses
  FOR DELETE
  TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::text));

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_detailed_courses_user_id ON detailed_courses(user_id);
CREATE INDEX IF NOT EXISTS idx_detailed_courses_roadmap_id ON detailed_courses(roadmap_id);

-- Create unique constraint to prevent duplicate courses per user per roadmap
CREATE UNIQUE INDEX IF NOT EXISTS idx_detailed_courses_user_roadmap 
ON detailed_courses(user_id, roadmap_id);