-- =====================================================
-- NEONDB SCHEMA UPDATES FOR ENHANCED MONEYQASH BACKEND
-- Run these commands in your NeonDB SQL console
-- =====================================================

-- 1. Add B2C transaction fields to withdrawals table
-- =====================================================
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS mpesa_transaction_id TEXT;
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS mpesa_conversation_id TEXT;
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS mpesa_originator_conversation_id TEXT;
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS result_code INTEGER;
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS result_description TEXT;
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP;
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS failure_reason TEXT;

-- 2. Add task balance columns to users table
-- =====================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS ads_balance INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS youtube_balance INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tiktok_balance INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS instagram_balance INTEGER DEFAULT 0;

-- 3. Add withdrawal_phone column to users table (if not exists)
-- =====================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS withdrawal_phone TEXT;

-- 4. Update existing users to have task balances from their earnings
-- =====================================================
-- Update ads_balance for each user based on their ad earnings
UPDATE users SET ads_balance = COALESCE((
    SELECT SUM(amount) 
    FROM earnings 
    WHERE earnings.user_id = users.id 
    AND earnings.source = 'ad'
), 0);

-- Update youtube_balance for each user based on their youtube earnings
UPDATE users SET youtube_balance = COALESCE((
    SELECT SUM(amount) 
    FROM earnings 
    WHERE earnings.user_id = users.id 
    AND earnings.source = 'youtube'
), 0);

-- Update tiktok_balance for each user based on their tiktok earnings
UPDATE users SET tiktok_balance = COALESCE((
    SELECT SUM(amount) 
    FROM earnings 
    WHERE earnings.user_id = users.id 
    AND earnings.source = 'tiktok'
), 0);

-- Update instagram_balance for each user based on their instagram earnings
UPDATE users SET instagram_balance = COALESCE((
    SELECT SUM(amount) 
    FROM earnings 
    WHERE earnings.user_id = users.id 
    AND earnings.source = 'instagram'
), 0);

-- 5. Create index for better query performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_earnings_user_source ON earnings(user_id, source);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_status ON withdrawals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_referrals_user_level ON referrals(referrer_id, level);

-- 6. Add constraints to ensure data integrity
-- =====================================================
-- Ensure balance columns are non-negative
ALTER TABLE users ADD CONSTRAINT IF NOT EXISTS check_ads_balance_positive CHECK (ads_balance >= 0);
ALTER TABLE users ADD CONSTRAINT IF NOT EXISTS check_youtube_balance_positive CHECK (youtube_balance >= 0);
ALTER TABLE users ADD CONSTRAINT IF NOT EXISTS check_tiktok_balance_positive CHECK (tiktok_balance >= 0);
ALTER TABLE users ADD CONSTRAINT IF NOT EXISTS check_instagram_balance_positive CHECK (instagram_balance >= 0);

-- 7. Update withdrawal status values (if needed)
-- =====================================================
-- Ensure all withdrawals have proper status values
UPDATE withdrawals SET status = 'pending' WHERE status IS NULL OR status = '';

-- 8. Verify the schema updates
-- =====================================================
-- Check if all columns were added successfully
SELECT 
    column_name, 
    data_type, 
    is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('ads_balance', 'youtube_balance', 'tiktok_balance', 'instagram_balance', 'withdrawal_phone')
ORDER BY column_name;

-- Check withdrawal table columns
SELECT 
    column_name, 
    data_type, 
    is_nullable 
FROM information_schema.columns 
WHERE table_name = 'withdrawals' 
AND column_name IN ('mpesa_transaction_id', 'mpesa_conversation_id', 'processed_at', 'completed_at', 'failure_reason')
ORDER BY column_name;

-- Show final table structure
SELECT COUNT(*) as total_users FROM users;
SELECT COUNT(*) as total_earnings FROM earnings;
SELECT COUNT(*) as total_withdrawals FROM withdrawals;
SELECT COUNT(*) as total_referrals FROM referrals;

-- =====================================================
-- SCHEMA UPDATE COMPLETE!
-- Your database is now ready for the enhanced backend
-- =====================================================