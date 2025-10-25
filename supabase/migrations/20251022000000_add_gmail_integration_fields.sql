-- Add sender_user_id to email_messages if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_messages' AND column_name = 'sender_user_id'
  ) THEN
    ALTER TABLE email_messages ADD COLUMN sender_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for sender_user_id
CREATE INDEX IF NOT EXISTS idx_email_messages_sender_user_id ON email_messages(sender_user_id);
