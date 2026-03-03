-- Exercise Images cache table: stores AI-generated exercise illustration URLs
CREATE TABLE IF NOT EXISTS exercise_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  exercise_id TEXT NOT NULL UNIQUE,
  exercise_name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  prompt TEXT,
  provider TEXT DEFAULT 'dall-e-3',
  generated_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exercise_images_exercise_id ON exercise_images(exercise_id);

-- RLS policies
ALTER TABLE exercise_images ENABLE ROW LEVEL SECURITY;

-- Everyone can read exercise images (they are shared assets)
CREATE POLICY "Anyone can view exercise images" ON exercise_images
  FOR SELECT USING (true);

-- Server can insert/update exercise images
CREATE POLICY "Server can insert exercise images" ON exercise_images
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Server can update exercise images" ON exercise_images
  FOR UPDATE USING (true);

-- Create Supabase storage bucket for images if it doesn't exist
-- NOTE: Run this in the Supabase dashboard SQL editor:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('images', 'images', true) ON CONFLICT DO NOTHING;
