import {
  users, User, InsertUser,
  referrals, Referral, InsertReferral,
  availableTasks, AvailableTask, InsertAvailableTask,
  tasks, Task, InsertTask,
  earnings, Earning, InsertEarning,
  withdrawals, Withdrawal, InsertWithdrawal,
  mpesaTransactions, MpesaTransaction, InsertMpesaTransaction,
  UserStats,
  insertUserSchema,
  insertReferralSchema,
  insertAvailableTaskSchema,
  insertTaskSchema,
  insertEarningSchema,
  insertWithdrawalSchema,
  insertMpesaTransactionSchema
} from "./shared/schema";

import session from "express-session";
import { Pool } from "pg";
import { NodePgDatabase, drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./shared/schema";
import PgSession from "connect-pg-simple";
import { eq, desc, count, and } from "drizzle-orm";

// modify the interface with CRUD methods needed
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, userData: Partial<User>): Promise<User | undefined>;
  updateUserContact(id: number, phone: string, withdrawalPhone: string): Promise<User | undefined>;
  updateUserPassword(id: number, password: string): Promise<User | undefined>;

  // Referral operations
  createReferral(referral: InsertReferral): Promise<Referral>;
  getReferralsByReferrerId(referrerId: number): Promise<Referral[]>;
  getReferralsByReferredId(referredId: number): Promise<Referral[]>;

  // Available Task operations
  getAvailableTasks(): Promise<AvailableTask[]>;
  getAvailableTasksByType(type: string): Promise<AvailableTask[]>;
  createAvailableTask(task: InsertAvailableTask): Promise<AvailableTask>;

  // Task operations
  createTask(task: InsertTask): Promise<Task>;
  getTasksByUserId(userId: number): Promise<Task[]>;
  completeTask(id: number): Promise<Task | undefined>;

  // Earning operations
  createEarning(earning: InsertEarning): Promise<Earning>;
  getEarningsByUserId(userId: number): Promise<Earning[]>;

  // Withdrawal operations
  createWithdrawal(withdrawal: InsertWithdrawal): Promise<Withdrawal>;
  getWithdrawalsByUserId(userId: number): Promise<Withdrawal[]>;

  // M-Pesa Transaction operations
  createMpesaTransaction(transaction: InsertMpesaTransaction): Promise<MpesaTransaction>;
  updateMpesaTransaction(id: number, data: Partial<MpesaTransaction>): Promise<MpesaTransaction | undefined>;
  getMpesaTransactionByCheckoutId(checkoutRequestId: string): Promise<MpesaTransaction | undefined>;
  getMpesaTransactionsByUserId(userId: number): Promise<MpesaTransaction[]>;

  // Stats operations
  getUserStats(userId: number): Promise<UserStats>;

  // Session store
  sessionStore: session.Store;
}

export class DrizzleStorage implements IStorage {
  private db: NodePgDatabase<typeof schema>;
  sessionStore: session.Store;

  constructor(databaseUrl: string) {
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is not defined in environment variables");
    }
    const pool = new Pool({ connectionString: databaseUrl });
    this.db = drizzle(pool, { schema });

    const PGStore = PgSession(session);
    this.sessionStore = new PGStore({
      pool: pool,
      tableName: "user_sessions", // Optional: specify table name for sessions
      createTableIfMissing: true, // Optional: create table if it doesn't exist
    });
    this.seedAvailableTasks();
  }

  private async seedAvailableTasks() {
    try {
      const existingTasks = await this.db.select().from(availableTasks).limit(1);
      if (existingTasks.length > 0) {
        // console.log("Available tasks already seeded.");
        return;
      }

      const adTasksData = [
        { type: 'ad', description: 'Watch promotional ad for health product', duration: '30 seconds', reward: 10 },
        { type: 'ad', description: 'Watch tech gadget advertisement', duration: '45 seconds', reward: 10 }
      ];

      const tiktokTasksData = [
        { type: 'tiktok', description: 'Watch trending TikTok video', duration: '15 seconds', reward: 5 },
        { type: 'tiktok', description: 'Watch dance challenge TikTok', duration: '20 seconds', reward: 5 }
      ];

      const youtubeTasksData = [
        { type: 'youtube', description: 'Watch YouTube tutorial video', duration: '1 minute', reward: 15 },
        { type: 'youtube', description: 'Watch product review on YouTube', duration: '1 minute', reward: 15 }
      ];

      const instagramTasksData = [
        { type: 'instagram', description: 'Watch Instagram fashion reel', duration: '30 seconds', reward: 7 },
        { type: 'instagram', description: 'Watch travel reel on Instagram', duration: '30 seconds', reward: 7 }
      ];

      const allTasksData = [...adTasksData, ...tiktokTasksData, ...youtubeTasksData, ...instagramTasksData];

      for (const taskData of allTasksData) {
          const validatedTask = insertAvailableTaskSchema.parse(taskData);
          await this.db.insert(availableTasks).values(validatedTask);
      }
      // console.log("Available tasks seeded successfully.");
    } catch (error) {
      console.error("Error seeding available tasks:", error);
    }
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const validatedUser = insertUserSchema.parse(insertUser);
    const result = await this.db.insert(users).values(validatedUser).returning();
    return result[0];
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const result = await this.db.update(users).set(userData).where(eq(users.id, id)).returning();
    return result[0];
  }

  async updateUserContact(id: number, phone: string, withdrawalPhone: string): Promise<User | undefined> {
    const result = await this.db.update(users).set({ phone, withdrawalPhone }).where(eq(users.id, id)).returning();
    return result[0];
  }

  async updateUserPassword(id: number, password: string): Promise<User | undefined> {
    const result = await this.db.update(users).set({ password }).where(eq(users.id, id)).returning();
    return result[0];
  }

  // Referral operations
  async createReferral(referral: InsertReferral): Promise<Referral> {
    const validatedReferral = insertReferralSchema.parse(referral);
    const result = await this.db.insert(referrals).values(validatedReferral).returning();
    return result[0];
  }

  async getReferralsByReferrerId(referrerId: number): Promise<Referral[]> {
    return this.db.select().from(referrals).where(eq(referrals.referrerId, referrerId)).orderBy(desc(referrals.createdAt));
  }

  async getReferralsByReferredId(referredId: number): Promise<Referral[]> {
    return this.db.select().from(referrals).where(eq(referrals.referredId, referredId)).orderBy(desc(referrals.createdAt));
  }

  // Available Task operations
  async getAvailableTasks(): Promise<AvailableTask[]> {
    return this.db.select().from(availableTasks).orderBy(desc(availableTasks.createdAt));
  }

  async getAvailableTasksByType(type: string): Promise<AvailableTask[]> {
    return this.db.select().from(availableTasks).where(eq(availableTasks.type, type)).orderBy(desc(availableTasks.createdAt));
  }

  async createAvailableTask(task: InsertAvailableTask): Promise<AvailableTask> {
    const validatedTask = insertAvailableTaskSchema.parse(task);
    const result = await this.db.insert(availableTasks).values(validatedTask).returning();
    return result[0];
  }

  // Task operations
  async createTask(task: InsertTask): Promise<Task> {
    const validatedTask = insertTaskSchema.parse(task);
    const result = await this.db.insert(tasks).values(validatedTask).returning();
    return result[0];
  }

  async getTasksByUserId(userId: number): Promise<Task[]> {
    return this.db.select().from(tasks).where(eq(tasks.userId, userId)).orderBy(desc(tasks.createdAt));
  }

  async completeTask(id: number): Promise<Task | undefined> {
    const result = await this.db.update(tasks)
      .set({ completed: true, completedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
    return result[0];
  }

  // Earning operations
  async createEarning(earning: InsertEarning): Promise<Earning> {
    const validatedEarning = insertEarningSchema.parse(earning);
    const result = await this.db.insert(earnings).values(validatedEarning).returning();
    return result[0];
  }

  async getEarningsByUserId(userId: number): Promise<Earning[]> {
    return this.db.select().from(earnings).where(eq(earnings.userId, userId)).orderBy(desc(earnings.createdAt));
  }

  // Withdrawal operations
  async createWithdrawal(withdrawal: InsertWithdrawal): Promise<Withdrawal> {
    const validatedWithdrawal = insertWithdrawalSchema.parse(withdrawal);
    const result = await this.db.insert(withdrawals).values(validatedWithdrawal).returning();
    return result[0];
  }

  async getWithdrawalsByUserId(userId: number): Promise<Withdrawal[]> {
    return this.db.select().from(withdrawals).where(eq(withdrawals.userId, userId)).orderBy(desc(withdrawals.createdAt));
  }

  // M-Pesa Transaction operations
  async createMpesaTransaction(transaction: InsertMpesaTransaction): Promise<MpesaTransaction> {
    const validatedTransaction = insertMpesaTransactionSchema.parse(transaction);
    const result = await this.db.insert(mpesaTransactions).values(validatedTransaction).returning();
    return result[0];
  }

  async updateMpesaTransaction(id: number, data: Partial<MpesaTransaction>): Promise<MpesaTransaction | undefined> {
    const result = await this.db
      .update(mpesaTransactions)
      .set(data)
      .where(eq(mpesaTransactions.id, id))
      .returning();
    return result[0];
  }

  async getMpesaTransactionByCheckoutId(checkoutRequestId: string): Promise<MpesaTransaction | undefined> {
    const result = await this.db.select().from(mpesaTransactions)
      .where(eq(mpesaTransactions.checkoutRequestId, checkoutRequestId))
      .then(rows => rows[0]);
    return result;
  }

  // Get all M-Pesa transactions for a user
  async getMpesaTransactionsByUserId(userId: number): Promise<MpesaTransaction[]> {
    return this.db.select().from(mpesaTransactions)
      .where(eq(mpesaTransactions.userId, userId))
      .orderBy(desc(mpesaTransactions.id));
  }

  // Stats operations
  async getUserStats(userId: number): Promise<UserStats> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const directReferralsResult = await this.db
      .select({ value: count() })
      .from(referrals)
      .where(and(eq(referrals.referrerId, userId), eq(referrals.level, 1)));
    const directReferrals = directReferralsResult[0]?.value || 0;
    
    const secondaryReferralsResult = await this.db
      .select({ value: count() })
      .from(referrals)
      .where(and(eq(referrals.referrerId, userId), eq(referrals.level, 2)));
    const secondaryReferrals = secondaryReferralsResult[0]?.value || 0;

    const userEarnings = await this.getEarningsByUserId(userId);

    const sumEarningsBySource = (source: string): number => {
        return userEarnings
            .filter(e => e.source === source && e.amount > 0) // only positive earnings for task earnings
            .reduce((acc, curr) => acc + curr.amount, 0);
    };
    
    const taskEarnings = {
      ads: sumEarningsBySource('ad'),
      tiktok: sumEarningsBySource('tiktok'),
      youtube: sumEarningsBySource('youtube'),
      instagram: sumEarningsBySource('instagram')
    };

    // Total profit is account balance (which should reflect referral earnings) + task earnings
    // Account balance in the user table is primarily for referral commissions.
    // Task earnings are tracked separately and summed up.
    const accountBalance = user.accountBalance || 0;
    const totalProfit = accountBalance + 
      taskEarnings.ads + 
      taskEarnings.tiktok + 
      taskEarnings.youtube + 
      taskEarnings.instagram;

    const referralLink = `${process.env.APP_URL || "http://localhost:5000"}/register?ref=${user.username}&uid=${userId}`;

    return {
      accountBalance, // This is mainly referral balance
      totalProfit,
      directReferrals,
      secondaryReferrals,
      referralLink,
      taskEarnings
    };
  }
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL environment variable is not set. Please ensure it is configured in your .env file.");
  // Potentially throw an error or exit if DATABASE_URL is critical for startup in all environments
  // For now, we'll let it proceed, but DrizzleStorage instantiation will fail if DATABASE_URL is missing.
}

export const storage = new DrizzleStorage(process.env.DATABASE_URL!);