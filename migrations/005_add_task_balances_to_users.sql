-- Add task-specific balance columns to users table
ALTER TABLE users 
  ADD COLUMN ad_balance INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN tiktok_balance INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN youtube_balance INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN instagram_balance INTEGER DEFAULT 0 NOT NULL;