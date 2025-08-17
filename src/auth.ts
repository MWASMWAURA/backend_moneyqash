import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import bcrypt from "bcryptjs";
import { storage } from "./storage.js";
import { User as SelectUser } from "./shared/schema.js";
import crypto from "crypto";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

async function comparePasswords(supplied: string, storedHash: string): Promise<boolean> {
  return bcrypt.compare(supplied, storedHash);
}

// Generate a unique referral code
function generateReferralCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

export function setupAuth(app: Express): void {
  const isProduction = process.env.NODE_ENV === 'production';
  
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "referral-app-secret",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      sameSite: isProduction ? 'none' : 'lax',
      secure: isProduction, // true in production, false in development
      httpOnly: true, // Prevent XSS
      domain: isProduction ? undefined : undefined, // Let browser decide
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        } else {
          return done(null, user);
        }
      } catch (err) {
        return done(err);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  // Validate referral code endpoint
  app.get("/api/validate-referral/:code", async (req, res) => {
    try {
      const { code } = req.params;
      console.log("[VALIDATE] Checking referral code:", code);
      
      const referrer = await storage.getUserByReferralCode(code);
      if (!referrer) {
        console.log("[VALIDATE] Invalid referral code:", code);
        return res.status(404).json({ 
          valid: false, 
          message: "Invalid referral code" 
        });
      }

      console.log("[VALIDATE] Valid referral code:", code, "Referrer:", referrer.username);
      return res.json({ 
        valid: true, 
        referrer: {
          id: referrer.id,
          username: referrer.username,
          fullName: referrer.fullName,
          isActivated: referrer.isActivated
        }
      });
    } catch (error) {
      console.error("[VALIDATE] Error validating referral code:", error);
      return res.status(500).json({ 
        valid: false, 
        message: "Error validating referral code" 
      });
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const { username, password, fullName, phone, referralCode } = req.body;
      
      if (!username || !password || !fullName) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Generate unique referral code (6-character alphanumeric)
      const generateReferralCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
      };
      let newReferralCode = generateReferralCode();
      // Ensure referral code is unique
      while (await storage.getUserByReferralCode(newReferralCode)) {
        newReferralCode = generateReferralCode();
      }

      // Handle referral lookup BEFORE creating user
      let referrerId = undefined;
      if (referralCode) {
        const referrer = await storage.getUserByReferralCode(referralCode.toUpperCase());
        if (referrer) {
          referrerId = referrer.id;
          console.log(`[REGISTER] Found referrer: ${referrer.username} (ID: ${referrer.id})`);
        } else {
          console.log(`[REGISTER] Invalid referral code provided: ${referralCode}`);
        }
      }

      // Create new user with referrerId properly set
      const newUser = await storage.createUser({
        username,
        password: hashedPassword,
        fullName,
        phone,
        referralCode: newReferralCode,
        referrerId: referrerId, // This will now be set correctly
        isActivated: false,
        accountBalance: 0
      });

      console.log(`[REGISTER] Created user: ${newUser.username} with referrerId: ${newUser.referrerId}`);

      // Create referral record if we have a referrer
      if (referrerId) {
        // Create referral record (inactive until user activates)
        await storage.createReferral({
          referrerId: referrerId,
          referredId: newUser.id,
          level: 1,
          amount: 0, // Will be set when user activates
          isActive: false,
          referredUsername: newUser.username
        });
        console.log(`[REGISTER] Referral record created: ReferrerID(${referrerId}) -> NewUser(${newUser.id})`);
      }

      // Log user in
      req.login(newUser, (err) => {
        if (err) {
          console.error("Login error after registration:", err);
          return res.status(500).json({ message: "Registration successful but login failed" });
        }
        const { password: _, ...userWithoutPassword } = newUser;
        return res.json(userWithoutPassword);
      });
      return;
    } catch (error) {
      console.error("Registration error:", error);
      return res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (
      err: Error | null,
      user: Express.User | false | null,
      info: { message: string } | undefined
    ) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }
      
      req.login(user, (loginErr) => {
        if (loginErr) return next(loginErr);
        
        // Return user without password
        const { password: _, ...userWithoutPassword } = user as Express.User;
        return res.status(200).json(userWithoutPassword);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      return res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }
    
    // Return user without password
    const { password: _, ...userWithoutPassword } = req.user;
    return res.json(userWithoutPassword);
  });
}