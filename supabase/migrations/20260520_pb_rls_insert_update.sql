-- v14-D20: Add INSERT/UPDATE policies for personal_bests and medals.
-- Root cause of "Page Unavailable" overlay: trainers were blocked from syncing
-- PBs for their clients because only SELECT policies existed. The upsert would
-- fail with an empty error object {}, triggering a console.error that the dev
-- overlay surfaced aggressively.

-- Personal Bests: Users can insert/update their own PBs
CREATE POLICY IF NOT EXISTS "Users can manage own PBs" ON personal_bests
  FOR ALL USING (auth.uid() = user_id);

-- Personal Bests: Trainers can insert/update client PBs
CREATE POLICY IF NOT EXISTS "Trainers can manage client PBs" ON personal_bests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM trainer_clients 
      WHERE trainer_id = auth.uid() AND client_id = personal_bests.user_id
    )
  );

-- Medals: Users can insert/update their own medals
CREATE POLICY IF NOT EXISTS "Users can manage own medals" ON medals
  FOR ALL USING (auth.uid() = user_id);

-- Medals: Trainers can insert/update client medals
CREATE POLICY IF NOT EXISTS "Trainers can manage client medals" ON medals
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM trainer_clients 
      WHERE trainer_id = auth.uid() AND client_id = medals.user_id
    )
  );
