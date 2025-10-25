/*
  # Enable Realtime and Unread Email Tracking

  1. Enable Realtime on email_messages table
  2. Create unread_email_count table for tracking unread counts per user
  3. Add RLS policies for realtime subscriptions
*/

-- Enable realtime on email_messages table
ALTER PUBLICATION supabase_realtime ADD TABLE email_messages;

-- Create unread_email_count table for efficient badge updates
CREATE TABLE IF NOT EXISTS unread_email_count (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  unread_count integer DEFAULT 0,
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on unread_email_count
ALTER TABLE unread_email_count ENABLE ROW LEVEL SECURITY;

-- Policies for unread_email_count
DROP POLICY IF EXISTS "Users can view own unread count" ON unread_email_count;
CREATE POLICY "Users can view own unread count"
  ON unread_email_count FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own unread count" ON unread_email_count;
CREATE POLICY "Users can update own unread count"
  ON unread_email_count FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_unread_email_count_user_id ON unread_email_count(user_id);

-- Add is_read column to email_messages if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_messages' AND column_name = 'is_read'
  ) THEN
    ALTER TABLE email_messages ADD COLUMN is_read boolean DEFAULT false;
  END IF;
END $$;

-- Create index for is_read for efficient queries
CREATE INDEX IF NOT EXISTS idx_email_messages_is_read ON email_messages(is_read);
CREATE INDEX IF NOT EXISTS idx_email_messages_sender_user_id_is_read ON email_messages(sender_user_id, is_read);

