import { pgTable, text, serial, integer, boolean, timestamp, pgEnum, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  withdrawalPhone: text("withdrawal_phone"),
  isActivated: boolean("is_activated").default(false).notNull(),
  accountBalance: integer("account_balance").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  fullName: true,
  phone: true,
  withdrawalPhone: true,
});

export const referrals = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerId: integer("referrer_id").notNull().references(() => users.id),
  referredId: integer("referred_id").notNull().references(() => users.id),
  level: integer("level").notNull(), // 1 for direct, 2 for secondary
  amount: integer("amount").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Additional fields for display
  referredUsername: text("referred_username"),
  referredFullName: text("referred_full_name"),
  isActive: boolean("is_active").default(false),
});

export const insertReferralSchema = createInsertSchema(referrals).pick({
  referrerId: true,
  referredId: true,
  level: true,
  amount: true,
  referredUsername: true,
  referredFullName: true,
  isActive: true,
});

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
});

export const insertWithdrawalSchema = createInsertSchema(withdrawals).pick({
  userId: true,
  source: true,
  amount: true,
  fee: true,
  status: true,
  paymentMethod: true,
  phoneNumber: true,
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

// FIXED: Use table inference instead of z.infer for better compatibility
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
};