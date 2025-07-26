-- Create enums
CREATE TYPE mpesa_transaction_status AS ENUM ('pending', 'completed', 'failed', 'cancelled');

-- Create tables
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  withdrawal_phone TEXT,
  is_activated BOOLEAN DEFAULT false NOT NULL,
  account_balance INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE referrals (
  id SERIAL PRIMARY KEY,
  referrer_id INTEGER NOT NULL REFERENCES users(id),
  referred_id INTEGER NOT NULL REFERENCES users(id),
  level INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  referred_username TEXT,
  referred_full_name TEXT,
  is_active BOOLEAN DEFAULT false
);

CREATE TABLE available_tasks (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  duration TEXT NOT NULL,
  reward INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE tasks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  completed BOOLEAN DEFAULT false NOT NULL,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  available_task_id INTEGER REFERENCES available_tasks(id),
  description TEXT,
  duration TEXT,
  reward INTEGER
);

CREATE TABLE earnings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  source TEXT NOT NULL,
  amount INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  description TEXT
);

CREATE TABLE withdrawals (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  source TEXT NOT NULL,
  amount INTEGER NOT NULL,
  fee INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  processed_at TIMESTAMP,
  payment_method TEXT NOT NULL,
  phone_number TEXT
);

CREATE TABLE mpesa_transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  checkout_request_id VARCHAR(100) UNIQUE NOT NULL,
  merchant_request_id VARCHAR(100) UNIQUE NOT NULL,
  status mpesa_transaction_status DEFAULT 'pending' NOT NULL,
  amount INTEGER NOT NULL,
  mpesa_receipt_number VARCHAR(50),
  result_code INTEGER,
  result_desc TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
