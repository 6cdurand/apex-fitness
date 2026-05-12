-- Canonical follow system (v9-06)
-- Replaces fragile following[] array scanning with proper relational table

CREATE TABLE IF NOT EXISTS public.user_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  followee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_follows_unique UNIQUE(follower_id, followee_id),
  CONSTRAINT user_follows_no_self_follow CHECK(follower_id <> followee_id)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS user_follows_follower_idx ON public.user_follows(follower_id);
CREATE INDEX IF NOT EXISTS user_follows_followee_idx ON public.user_follows(followee_id);

-- RLS policies
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

-- Anyone can read follow relationships (public social graph)
DROP POLICY IF EXISTS "Follow relationships are public" ON public.user_follows;
CREATE POLICY "Follow relationships are public"
  ON public.user_follows
  FOR SELECT
  USING (true);

-- Users can follow others (insert their own follower_id)
DROP POLICY IF EXISTS "Users can follow others" ON public.user_follows;
CREATE POLICY "Users can follow others"
  ON public.user_follows
  FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

-- Users can unfollow (delete their own follows)
DROP POLICY IF EXISTS "Users can unfollow" ON public.user_follows;
CREATE POLICY "Users can unfollow"
  ON public.user_follows
  FOR DELETE
  USING (auth.uid() = follower_id);

-- Convenience view for follow counts
CREATE OR REPLACE VIEW public.user_follow_counts AS
SELECT
  u.id AS user_id,
  COALESCE(following.count, 0) AS following_count,
  COALESCE(followers.count, 0) AS followers_count
FROM auth.users u
LEFT JOIN (
  SELECT follower_id, COUNT(*) AS count
  FROM public.user_follows
  GROUP BY follower_id
) following ON u.id = following.follower_id
LEFT JOIN (
  SELECT followee_id, COUNT(*) AS count
  FROM public.user_follows
  GROUP BY followee_id
) followers ON u.id = followers.followee_id;

COMMENT ON TABLE public.user_follows IS 'Canonical follow graph. follower_id follows followee_id.';
COMMENT ON VIEW public.user_follow_counts IS 'Convenience view for follow/follower counts per user.';
