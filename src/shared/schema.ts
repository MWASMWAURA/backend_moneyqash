import { pgTable, text, serial, integer, boolean, timestamp, pgEnum, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users:any = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  withdrawalPhone: text("withdrawal_phone"),
  isActivated: boolean("is_activated").default(false).notNull(),
  accountBalance: integer("account_balance").default(0).notNull(),
  adBalance: integer("ad_balance").default(0).notNull(),
  tiktokBalance: integer("tiktok_balance").default(0).notNull(),
  youtubeBalance: integer("youtube_balance").default(0).notNull(),
  instagramBalance: integer("instagram_balance").default(0).notNull(),
  referralCode: text("referral_code").notNull().unique(),
  referrerId: integer("referrer_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  fullName: true,
  phone: true,
  withdrawalPhone: true,
  referralCode: true,
  referrerId: true,
});

export const referrals = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerId: integer("referrer_id").notNull().references(() => users.id),
  referredId: integer("referred_id").notNull().references(() => users.id),
  referredUsername: varchar("referred_username", { length: 255 }).notNull(),
  level: integer("level").notNull().default(1),
  amount: integer("amount").notNull().default(0),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertReferralSchema = createInsertSchema(referrals);

export const availableTasks = pgTable("available_tasks", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // 'ad', 'tiktok', 'youtube', 'instagram'
  description: text("description").notNull(),
  duration: text("duration").notNull(),
  reward: integer("reward").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAvailableTaskSchema = createInsertSchema(availableTasks).pick({
  type: true,
  description: true,
  duration: true,
  reward: true,
});

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // 'ad', 'tiktok', 'youtube', 'instagram'
  amount: integer("amount").notNull(),
  completed: boolean("completed").default(false).notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Reference to available task
  availableTaskId: integer("available_task_id").references(() => availableTasks.id),
  // Copied fields for convenience
  description: text("description"),
  duration: text("duration"),
  reward: integer("reward"),
});

export const insertTaskSchema = createInsertSchema(tasks).pick({
  userId: true,
  type: true,
  amount: true,
  availableTaskId: true,
  description: true,
  duration: true,
  reward: true,
});

export const earnings = pgTable("earnings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  source: text("source").notNull(), // 'referral', 'ad', 'tiktok', 'youtube', 'instagram'
  amount: integer("amount").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  description: text("description"),
});

export const insertEarningSchema = createInsertSchema(earnings).pick({
  userId: true,
  source: true,
  amount: true,
  description: true,
});

export const withdrawals = pgTable("withdrawals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  source: text("source").notNull(), // 'referral', 'ad', 'tiktok', 'youtube', 'instagram'
  amount: integer("amount").notNull(),
  fee: integer("fee").notNull(),
  status: text("status").notNull(), // 'pending', 'completed', 'failed'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
  paymentMethod: text("payment_method").notNull(),
  phoneNumber: text("phone_number"),
  mpesaConversationId: text("mpesa_conversation_id"),
  mpesaOriginatorConversationId: text("mpesa_originator_conversation_id"),
  failureReason: text("failure_reason"),
  completedAt: timestamp("completed_at"),
});

export const insertWithdrawalSchema = createInsertSchema(withdrawals).pick({
  userId: true,
  source: true,
  amount: true,
  fee: true,
  status: true,
  paymentMethod: true,
  phoneNumber: true,
  mpesaConversationId: true,
  mpesaOriginatorConversationId: true,
  failureReason: true,
  completedAt: true,
});

// M-Pesa Transactions Table
export const mpesaTransactionStatusEnum = pgEnum('mpesa_transaction_status', ['pending', 'completed', 'failed', 'cancelled']);

export const mpesaTransactions = pgTable("mpesa_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  checkoutRequestId: varchar("checkout_request_id", { length: 100 }).unique().notNull(),
  merchantRequestId: varchar("merchant_request_id", { length: 100 }).unique().notNull(),
  status: mpesaTransactionStatusEnum("status").default('pending').notNull(),
  amount: integer("amount").notNull(),
  mpesaReceiptNumber: varchar("mpesa_receipt_number", { length: 50 }),
  resultCode: integer("result_code"),
  resultDesc: text("result_desc"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertMpesaTransactionSchema = createInsertSchema(mpesaTransactions);

// Type definitions using table inference for better compatibility
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export type Referral = typeof referrals.$inferSelect;
export type InsertReferral = typeof referrals.$inferInsert;

export type AvailableTask = typeof availableTasks.$inferSelect;
export type InsertAvailableTask = typeof availableTasks.$inferInsert;

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

export type Earning = typeof earnings.$inferSelect;
export type InsertEarning = typeof earnings.$inferInsert;

export type Withdrawal = typeof withdrawals.$inferSelect;
export type InsertWithdrawal = typeof withdrawals.$inferInsert;

export type MpesaTransaction = typeof mpesaTransactions.$inferSelect;
export type InsertMpesaTransaction = typeof mpesaTransactions.$inferInsert;

// Custom types for API responses
export type UserStats = {
  accountBalance: number;
  totalProfit: number;
  directReferrals: number;
  secondaryReferrals: number;
  referralLink: string;
  taskEarnings: {
    ads: number;
    tiktok: number;
    youtube: number;
    instagram: number;
  };
  taskBalances: {
    ads: number;
    tiktok: number;
    youtube: number;
    instagram: number;
  };
};

// API response types for frontend consumption
export type ApiResponse<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

export type UserResponse = ApiResponse<User>;
export type UserStatsResponse = ApiResponse<UserStats>;
export type TasksResponse = ApiResponse<Task[]>;
export type AvailableTasksResponse = ApiResponse<AvailableTask[]>;
export type EarningsResponse = ApiResponse<Earning[]>;
export type WithdrawalsResponse = ApiResponse<Withdrawal[]>;
export type ReferralsResponse = ApiResponse<Referral[]>;