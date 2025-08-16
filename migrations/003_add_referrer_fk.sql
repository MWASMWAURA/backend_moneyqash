ALTER TABLE users 
ADD CONSTRAINT users_referrer_id_fkey 
FOREIGN KEY (referrer_id) REFERENCES users(id);