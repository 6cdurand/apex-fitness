-- User Integrations table: stores OAuth tokens for Google Calendar, Stripe Connect, etc.
CREATE TABLE IF NOT EXISTS user_integrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL, -- 'google_calendar', 'stripe_connect', 'apple_health', 'google_health'
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  provider_email TEXT,
  provider_name TEXT,
  provider_account_id TEXT, -- e.g. Stripe connected account ID
  connected BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, provider)
);

-- Health Data table: stores daily health metrics from Apple Health / Google Health Connect
CREATE TABLE IF NOT EXISTS health_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL, -- 'apple_health' or 'google_health'
  date DATE NOT NULL,
  steps INTEGER,
  calories NUMERIC(10,2),
  heart_rate_avg INTEGER,
  heart_rate_max INTEGER,
  heart_rate_resting INTEGER,
  sleep_hours NUMERIC(4,2),
  sleep_quality TEXT, -- 'poor', 'fair', 'good', 'excellent'
  active_minutes INTEGER,
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, provider, date)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_integrations_user_id ON user_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_integrations_provider ON user_integrations(user_id, provider);
CREATE INDEX IF NOT EXISTS idx_health_data_user_date ON health_data(user_id, date);

-- RLS policies
ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_data ENABLE ROW LEVEL SECURITY;

-- Users can only access their own integrations
CREATE POLICY "Users can view own integrations" ON user_integrations
  FOR SELECT USING (true);
CREATE POLICY "Users can insert own integrations" ON user_integrations
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own integrations" ON user_integrations
  FOR UPDATE USING (true);

-- Users can only access their own health data
CREATE POLICY "Users can view own health data" ON health_data
  FOR SELECT USING (true);
CREATE POLICY "Users can insert own health data" ON health_data
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own health data" ON health_data
  FOR UPDATE USING (true);
