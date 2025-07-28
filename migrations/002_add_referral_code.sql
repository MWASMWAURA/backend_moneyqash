-- Add referral_code column to users table
ALTER TABLE users ADD COLUMN referral_code TEXT UNIQUE;

-- Generate unique referral codes for existing users
UPDATE users SET referral_code = UPPER(LEFT(MD5(RANDOM()::text), 8)) WHERE referral_code IS NULL;

-- Make the column NOT NULL after populating existing records
ALTER TABLE users ALTER COLUMN referral_code SET NOT NULL;

-- Create index for faster lookups
CREATE INDEX idx_users_referral_code ON users(referral_code);
