import type { Express } from "express";
import { createServer, type Server } from "http";
import bcrypt from "bcryptjs";
import { storage } from "./storage.js";
import { setupAuth } from "./auth.js";
import { initiateSTKPush } from "./mpesa.js";
import { 
  insertReferralSchema, 
  insertEarningSchema, 
  insertWithdrawalSchema,
  insertTaskSchema,
  insertAvailableTaskSchema
} from "./shared/schema.js";
import { z } from "zod";

// Temporary in-memory store for pending activations. NOT FOR PRODUCTION.
const pendingActivationsMap = new Map<string, number>(); // CheckoutRequestID -> userId

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);

  // Get user stats
  app.get("/api/user/stats", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const stats = await storage.getUserStats(req.user.id);
      return res.json(stats);
    } catch (error) {
      return res.status(500).json({ message: "Failed to get user stats" });
    }
  });

  // Get user earnings
  app.get("/api/user/earnings", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      console.log("Fetching earnings for user:", req.user.id);
      const userId = req.user.id;
      const earnings = await storage.getEarningsByUserId(userId);
      console.log("Found earnings:", earnings);
      if (!earnings || earnings.length === 0) {
        return res.status(404).json({ message: "No earnings found" });
      }
      return res.json(earnings);
    } catch (error) {
      console.error("Error fetching earnings:", error);
      return res.status(500).json({ message: "Failed to fetch earnings" });
    }
  });

  // Update user profile
  app.patch("/api/user/profile", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const profileSchema = z.object({
      fullName: z.string().min(1, "Full name is required").optional(),
      username: z.string().min(3, "Username must be at least 3 characters").optional(),
    });

    try {
      const validationResult = profileSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ message: "Invalid data", errors: validationResult.error.format() });
      }

      const dataToUpdate: Partial<{ fullName: string; username: string }> = {};
      if (validationResult.data.fullName) {
        dataToUpdate.fullName = validationResult.data.fullName;
      }
      if (validationResult.data.username) {
        // Check if username is already taken by another user
        if (validationResult.data.username !== req.user.username) {
          const existingUser = await storage.getUserByUsername(validationResult.data.username);
          if (existingUser) {
            return res.status(400).json({ message: "Username already taken" });
          }
        }
        dataToUpdate.username = validationResult.data.username;
      }

      if (Object.keys(dataToUpdate).length === 0) {
        return res.status(400).json({ message: "No data provided for update" });
      }

      const updatedUser = await storage.updateUser(req.user.id, dataToUpdate);
      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update profile" });
      }

      const { password: _, ...userWithoutPassword } = updatedUser;
      return res.json(userWithoutPassword);
    } catch (error) {
      console.error("Profile update error:", error);
      return res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Update user contact information
  app.patch("/api/user/contact", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const contactSchema = z.object({
      phone: z.string().min(10, "Phone number must be at least 10 digits").optional(),
      withdrawalPhone: z.string().min(10, "Withdrawal phone must be at least 10 digits").optional(),
    });

    try {
      const validationResult = contactSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ message: "Invalid data", errors: validationResult.error.format() });
      }
      
      const dataToUpdate: Partial<{ phone: string; withdrawalPhone: string }> = {};
      if (validationResult.data.phone) {
        dataToUpdate.phone = validationResult.data.phone;
      }
      if (validationResult.data.withdrawalPhone) {
        dataToUpdate.withdrawalPhone = validationResult.data.withdrawalPhone;
      }

      if (Object.keys(dataToUpdate).length === 0) {
        return res.status(400).json({ message: "No data provided for update" });
      }

      const updatedUser = await storage.updateUser(req.user.id, dataToUpdate);
      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update contact information" });
      }

      const { password: _, ...userWithoutPassword } = updatedUser;
      return res.json(userWithoutPassword);
    } catch (error) {
      console.error("Contact update error:", error);
      return res.status(500).json({ message: "Failed to update contact information" });
    }
  });

  // Update user password
  app.patch("/api/user/password", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const passwordSchema = z.object({
      currentPassword: z.string().min(1, "Current password is required"),
      newPassword: z.string().min(6, "New password must be at least 6 characters"),
    }).refine(data => data.newPassword !== data.currentPassword, {
      message: "New password must be different from the current password",
      path: ["newPassword"],
    });

    try {
      const validationResult = passwordSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ message: "Invalid data", errors: validationResult.error.format() });
      }

      const { currentPassword, newPassword } = validationResult.data;

      const userWithPassword = await storage.getUser(req.user.id);

      if (!userWithPassword || !userWithPassword.password) {
        return res.status(500).json({ message: "Could not retrieve user data for password verification." });
      }

      const isCurrentPasswordCorrect = await bcrypt.compare(currentPassword, userWithPassword.password);
      if (!isCurrentPasswordCorrect) {
        return res.status(400).json({ message: "Incorrect current password" });
      }

      const hashedNewPassword = await bcrypt.hash(newPassword, 10);

      const updatedUser = await storage.updateUser(req.user.id, { password: hashedNewPassword });
      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update password" });
      }

      return res.json({ message: "Password updated successfully" });
    } catch (e) {
      const error = e as Error;
      console.error("Password update error details:", error);
      return res.status(500).json({ message: "Failed to update password" });
    }
  });

  // Activate user account
  app.post("/api/user/activate", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const paymentAmountString = process.env.MPESA_ACTIVATION_FEE;
      const paymentAmount = paymentAmountString ? parseInt(paymentAmountString, 10) : 500;

      if (isNaN(paymentAmount) || paymentAmount <= 0) {
        console.error("Invalid MPESA_ACTIVATION_FEE in .env. Using default of 500.");
      }

      const activationSchema = z.object({
        paymentMethod: z.string(),
        phoneNumber: z.string(),
      });
      
      const result = activationSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid request data", errors: result.error.format() });
      }

      const phoneNumber = result.data.phoneNumber.replace(/[^0-9]/g, '');
      if (!phoneNumber.startsWith('254')) {
        return res.status(400).json({ 
          message: "Invalid phone number format",
          errors: { phoneNumber: "Phone number must start with 254 and be 12 digits long" }
        });
      }
      if (phoneNumber.length !== 12) {
        return res.status(400).json({ 
          message: "Invalid phone number format",
          errors: { phoneNumber: "Phone number must be 12 digits long (including 254 prefix)" }
        });
      }

      if (result.data.paymentMethod === 'M-Pesa') {
        try {
          const pendingActivations = Array.from(pendingActivationsMap.entries());
          const hasPendingActivation = pendingActivations.some(([_, userId]) => userId === req.user.id);
          
          if (req.user.isActivated) {
            return res.status(400).json({
              message: "Your account is already activated."
            });
          }
          
          if (hasPendingActivation) {
            const transactions = await storage.getMpesaTransactionsByUserId(req.user.id);
            const latest = transactions && transactions.length > 0 ? transactions[transactions.length - 1] : null;
            if (latest && latest.status !== 'pending') {
              for (const [checkoutId, userId] of pendingActivationsMap.entries()) {
                if (userId === req.user.id) {
                  pendingActivationsMap.delete(checkoutId);
                }
              }
            } else {
              return res.status(400).json({
                message: "You already have a pending activation. Please wait for the current transaction to complete."
              });
            }
          }
          
          const transaction = await storage.createMpesaTransaction({
            userId: req.user.id,
            status: 'pending',
            amount: paymentAmount,
            checkoutRequestId: '',
            merchantRequestId: ''
          });

          if (!transaction) {
            return res.status(500).json({
              success: false,
              message: "Failed to create transaction record. Please try again."
            });
          }

          const stkPushResponse = await initiateSTKPush(phoneNumber, paymentAmount);

          if (stkPushResponse && stkPushResponse.CheckoutRequestID) {
            pendingActivationsMap.set(stkPushResponse.CheckoutRequestID, req.user.id);
            console.log(`Pending activation stored for CheckoutRequestID: ${stkPushResponse.CheckoutRequestID}, UserID: ${req.user.id}`);

            await storage.updateMpesaTransaction(transaction.id, {
              checkoutRequestId: stkPushResponse.CheckoutRequestID,
              merchantRequestId: stkPushResponse.MerchantRequestID
            });
          } else {
            console.error("STK Push response missing CheckoutRequestID. Cannot track pending activation.");
            return res.status(500).json({
              success: false,
              message: "Failed to track activation transaction. Please try again."
            });
          }

          return res.json({
            success: true,
            message: "STK push initiated. Please check your phone. If you don't receive the prompt, ensure your phone is on and has signal.",
            data: stkPushResponse
          });
        } catch (err) {
          const error = err as Error;
          console.error('Payment initiation error:', error);
          return res.status(500).json({
            success: false,
            message: error.message || "Failed to initiate payment. Please try again."
          });
        }
      }
      
      if (result.data.paymentMethod !== 'M-Pesa') {
        return res.status(400).json({ message: "Unsupported payment method for direct activation in this flow." });
      }
    } catch (error) {
      console.error('General activation error:', error);
      return res.status(500).json({ message: "Failed to process activation request" });
    }
    // Fallback to ensure all code paths return a response
    return res.status(400).json({ message: "Invalid activation request" });
  });

  // Get all referrals for the current user (as referrer)
  app.get("/api/user/referrals", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const referrals = await storage.getReferralsByReferrerId(req.user.id);
      return res.json(referrals);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch referrals" });
    }
  });

 // Register referral - REPLACE THE ENTIRE /api/referrals POST route
app.post("/api/referrals", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  try {
    const { referrerId, uid } = req.body;
    const referringUser = await storage.getUser(parseInt(uid));
    
    if (!referringUser || !referringUser.isActivated || referringUser.id !== parseInt(uid)) {
      return res.status(400).json({ message: "Invalid or inactive referrer" });
    }
    
    const { username, password, fullName, phone } = req.body;
    const existingUser = await storage.getUserByUsername(username);
    
    if (existingUser) {
      return res.status(400).json({ message: "Username already exists" });
    }
    
    // Generate a unique referral code (6-character alphanumeric)
    const generateReferralCode = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let result = '';
      for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };
    let referralCode = generateReferralCode();
    // Ensure referral code is unique
    while (await storage.getUserByReferralCode(referralCode)) {
      referralCode = generateReferralCode();
    }
    const newUser = await storage.createUser({
      username,
      password,
      fullName,
      phone,
      referralCode,
      referrerId: referrerId // Add this line
    });
    
    // Create level 1 referral record (always created, but reward only when activated)
    const level1ReferralData = insertReferralSchema.parse({
      referrerId,
      referredId: newUser.id,
      referredUsername: newUser.username,
      level: 1,
      amount: 0, // Will be updated when user activates
      isActive: false
    });
    
    await storage.createReferral(level1ReferralData);
    
    // FIXED: Check if the level 1 referrer has a referrer (for level 2)
const level1Referrer = await storage.getUser(referrerId);
if (level1Referrer && level1Referrer.referrerId) {
  // The level 1 referrer has a referrer, so create level 2 referral
  const level2ReferralData = insertReferralSchema.parse({
    referrerId: level1Referrer.referrerId, // The person who referred the level 1 referrer
    referredId: newUser.id,
    referredUsername: newUser.username,
    level: 2,
    amount: 0, // Will be updated when user activates
    isActive: false
  });
  
  await storage.createReferral(level2ReferralData);
  console.log(`[REFERRAL] Created level 2 referral: Level2Referrer(${level1Referrer.referrerId}) -> NewUser(${newUser.id})`);
}
    return res.status(201).json({ message: "Referral registered successfully" });
  } catch (error) {
    console.error("Referral registration error:", error);
    return res.status(500).json({ message: "Failed to register referral" });
  }
});
  // Create task
  app.post("/api/tasks", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const { type, amount } = req.body;
      const userId = req.user.id;
      
      const newTask = await storage.createTask({
        userId,
        type,
        amount
      });
      
      return res.status(201).json(newTask);
    } catch (error) {
      return res.status(500).json({ message: "Failed to create task" });
    }
  });

  // Complete task - UPDATED TO PROPERLY HANDLE ACCOUNT BALANCES
  app.post("/api/tasks/:id/complete", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const taskId = parseInt(req.params.id);
      const userId = req.user.id;
      // Get task
      const tasks = await storage.getTasksByUserId(userId);
      const task = tasks.find((t: any) => t.id === taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      if (task.completed) {
        return res.status(400).json({ message: "Task already completed" });
      }
      // Complete task
      const completedTask = await storage.completeTask(taskId);
      if (!completedTask) {
        return res.status(500).json({ message: "Failed to complete task" });
      }
      // Create earning record
      const earningData = insertEarningSchema.parse({
        userId,
        source: task.type,
        amount: task.amount,
        description: `Task completion: ${task.type}`
      });
      await storage.createEarning(earningData);
      // Update user's task balance based on task type
      const user = await storage.getUser(userId);
      if (user) {
        const balanceUpdates: any = {};
        switch (task.type) {
          case 'ad':
            balanceUpdates.adBalance = (user.adBalance || 0) + task.amount;
            break;
          case 'tiktok':
            balanceUpdates.tiktokBalance = (user.tiktokBalance || 0) + task.amount;
            break;
          case 'youtube':
            balanceUpdates.youtubeBalance = (user.youtubeBalance || 0) + task.amount;
            break;
          case 'instagram':
            balanceUpdates.instagramBalance = (user.instagramBalance || 0) + task.amount;
            break;
        }
        if (Object.keys(balanceUpdates).length > 0) {
          await storage.updateUser(userId, balanceUpdates);
        }
      }
      return res.json(completedTask);
    } catch (error) {
      console.error("Task completion error:", error);
      return res.status(500).json({ message: "Failed to complete task" });
    }
  });

  // Process withdrawal - COMPLETELY UPDATED
  app.post("/api/withdrawals", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const withdrawalSchema = z.object({
        source: z.string(),
        amount: z.number().min(600),
        paymentMethod: z.string(),
        phoneNumber: z.string().min(10),
      });
      const result = withdrawalSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid request data", errors: result.error.format() });
      }
      const { source, amount, paymentMethod, phoneNumber } = result.data;
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      // Check available balance based on source
      let availableBalance = 0;
      let balanceField = '';
      switch (source) {
        case 'referral':
          availableBalance = user.accountBalance || 0;
          balanceField = 'accountBalance';
          break;
        case 'ad':
          availableBalance = user.adBalance || 0;
          balanceField = 'adBalance';
          break;
        case 'tiktok':
          availableBalance = user.tiktokBalance || 0;
          balanceField = 'tiktokBalance';
          break;
        case 'youtube':
          availableBalance = user.youtubeBalance || 0;
          balanceField = 'youtubeBalance';
          break;
        case 'instagram':
          availableBalance = user.instagramBalance || 0;
          balanceField = 'instagramBalance';
          break;
        default:
          return res.status(400).json({ message: "Invalid withdrawal source" });
      }
      if (amount > availableBalance) {
        return res.status(400).json({
          message: `Insufficient balance. Available: ${availableBalance} Sh, Requested: ${amount} Sh`
        });
      }
      const fee = 50; // Fixed withdrawal fee
      const netAmount = amount - fee;
      // Clean phone number
      const cleanPhoneNumber = phoneNumber.replace(/[^0-9]/g, '');
      let finalPhoneNumber = cleanPhoneNumber;
      // Ensure proper format for M-Pesa
      if (paymentMethod.toLowerCase().includes('pesa') || paymentMethod.toLowerCase().includes('mpesa')) {
        if (!finalPhoneNumber.startsWith('254')) {
          if (finalPhoneNumber.startsWith('0')) {
            finalPhoneNumber = '254' + finalPhoneNumber.substring(1);
          } else if (finalPhoneNumber.startsWith('7') || finalPhoneNumber.startsWith('1')) {
            finalPhoneNumber = '254' + finalPhoneNumber;
          }
        }
        if (finalPhoneNumber.length !== 12) {
          return res.status(400).json({
            message: "Invalid phone number format for M-Pesa. Should be 12 digits starting with 254."
          });
        }
      }
      try {
        // Create withdrawal record as pending
        const withdrawalData = insertWithdrawalSchema.parse({
          userId,
          source,
          amount,
          fee,
          status: 'pending',
          paymentMethod,
          phoneNumber: finalPhoneNumber
        });
        const withdrawal = await storage.createWithdrawal(withdrawalData);
        // Initiate B2C payment if M-Pesa
        if (paymentMethod.toLowerCase().includes('pesa') || paymentMethod.toLowerCase().includes('mpesa')) {
          try {
            const { initiateB2CPayment } = await import("./mpesa.js");
            console.log(`[WITHDRAWAL] Initiating B2C payment: ${netAmount} to ${finalPhoneNumber}`);
            const b2cResponse = await initiateB2CPayment(finalPhoneNumber, netAmount, `Withdrawal from ${source}`);
            if (b2cResponse && b2cResponse.ResponseCode === '0') {
              console.log(`[WITHDRAWAL] B2C initiated successfully: ${b2cResponse.ConversationID}`);
              // Update withdrawal with B2C details
              await storage.updateWithdrawal(withdrawal.id, {
                status: 'processing',
                mpesaConversationId: b2cResponse.ConversationID,
                mpesaOriginatorConversationId: b2cResponse.OriginatorConversationID
              });
              // Deduct from user balance immediately since B2C was initiated
              const balanceUpdate: any = {};
              balanceUpdate[balanceField] = availableBalance - amount;
              await storage.updateUser(userId, balanceUpdate);
              // Create negative earning to record the withdrawal
              await storage.createEarning({
                userId,
                source,
                amount: -amount,
                description: `Withdrawal via ${paymentMethod} (Fee: ${fee} Sh)`
              });
              return res.status(201).json({
                success: true,
                message: "Withdrawal initiated successfully. You will receive the money shortly.",
                withdrawal: {
                  ...withdrawal,
                  status: 'processing'
                }
              });
            } else {
              console.error(`[WITHDRAWAL] B2C failed:`, b2cResponse);
              // Update withdrawal status to failed
              await storage.updateWithdrawal(withdrawal.id, {
                status: 'failed',
                failureReason: b2cResponse?.ResponseDescription || 'B2C payment initiation failed'
              });
              return res.status(500).json({
                success: false,
                message: "Failed to initiate withdrawal. Please try again later.",
                error: b2cResponse?.ResponseDescription || 'Payment service unavailable'
              });
            }
          } catch (b2cError) {
            console.error(`[WITHDRAWAL] B2C error:`, b2cError);
            // Update withdrawal status to failed
            await storage.updateWithdrawal(withdrawal.id, {
              status: 'failed',
              failureReason: 'Payment service error'
            });
            return res.status(500).json({
              success: false,
              message: "Payment service temporarily unavailable. Please try again later."
            });
          }
        } else {
          // For non-M-Pesa payments, mark as completed immediately (manual processing)
          await storage.updateWithdrawal(withdrawal.id, {
            status: 'completed'
          });
          // Deduct from user balance
          const balanceUpdate: any = {};
          balanceUpdate[balanceField] = availableBalance - amount;
          await storage.updateUser(userId, balanceUpdate);
          // Create negative earning to record the withdrawal
          await storage.createEarning({
            userId,
            source,
            amount: -amount,
            description: `Withdrawal via ${paymentMethod} (Fee: ${fee} Sh)`
          });
          return res.status(201).json({
            success: true,
            message: "Withdrawal request submitted successfully. Processing will be done manually.",
            withdrawal: {
              ...withdrawal,
              status: 'completed'
            }
          });
        }
      } catch (error) {
        console.error("Withdrawal creation error:", error);
        return res.status(500).json({ message: "Failed to create withdrawal record" });
      }
    } catch (error) {
      console.error("Withdrawal error:", error);
      return res.status(500).json({ message: "Failed to process withdrawal" });
    }
  });

  // Get available tasks
  app.get("/api/available-tasks", async (_req, res) => {
    try {
      const tasks = await storage.getAvailableTasks();
      return res.json(tasks);
    } catch (error) {
      return res.status(500).json({ message: "Failed to get available tasks" });
    }
  });

  // Get user tasks (for cooldown checking)
  app.get("/api/user/tasks", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const userId = req.user.id;
      const tasks = await storage.getTasksByUserId(userId);
      return res.json(tasks);
    } catch (error) {
      return res.status(500).json({ message: "Failed to get tasks" });
    }
  });

  // M-Pesa Callback Route
  app.post("/api/mpesa/callback", async (req, res) => {
    try {
      console.log("M-Pesa Callback Received:");
      console.log("Headers:", JSON.stringify(req.headers, null, 2));
      console.log("Body:", JSON.stringify(req.body, null, 2));

      // Parse the callback data
      const callbackData = req.body.Body?.stkCallback;

      if (!callbackData) {
        console.error("Malformed M-Pesa callback data received.");
        return res.status(400).json({ ResultCode: 1, ResultDesc: "Malformed callback data" });
      }

      const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = callbackData;

      console.log(`Callback for MerchantRequestID: ${MerchantRequestID}, CheckoutRequestID: ${CheckoutRequestID}`);
      console.log(`ResultCode: ${ResultCode}, ResultDesc: ${ResultDesc}`);

      // Get the transaction record
      const transaction = await storage.getMpesaTransactionByCheckoutId(CheckoutRequestID);
      if (!transaction) {
        console.error(`No transaction found for CheckoutRequestID: ${CheckoutRequestID}`);
        return res.status(400).json({ ResultCode: 1, ResultDesc: "No transaction found for this request" });
      }

      // Update transaction status
      await storage.updateMpesaTransaction(transaction.id, {
        status: ResultCode === 0 ? 'completed' : 'failed',
        resultCode: ResultCode,
        resultDesc: ResultDesc,
        mpesaReceiptNumber: CallbackMetadata?.Item?.find((item: any) => item.Name === 'MpesaReceiptNumber')?.Value
      });

      if (ResultCode === 0) {
        // Payment was successful
        console.log("Payment successful. Processing activation...");
        
        // Extract and validate paid amount from CallbackMetadata
        let paidAmount = null;
        if (CallbackMetadata && Array.isArray(CallbackMetadata.Item)) {
          const amountItem = CallbackMetadata.Item.find((item: any) => item.Name === 'Amount');
          if (amountItem) paidAmount = amountItem.Value;
        }
        
        if (paidAmount === null) {
          console.error("Could not extract paid amount from CallbackMetadata");
          return res.status(400).json({ ResultCode: 1, ResultDesc: "Could not extract paid amount" });
        }
        
        if (Number(paidAmount) !== Number(transaction.amount)) {
          console.error(`Paid amount (${paidAmount}) does not match expected amount (${transaction.amount}) for CheckoutRequestID: ${CheckoutRequestID}`);
          await storage.updateMpesaTransaction(transaction.id, { status: 'failed', resultDesc: 'Amount mismatch' });
          return res.status(400).json({ ResultCode: 1, ResultDesc: "Amount mismatch" });
        }
        
        const userIdToActivate = pendingActivationsMap.get(CheckoutRequestID);
        if (userIdToActivate) {
          console.log(`Found pending activation for UserID: ${userIdToActivate} with CheckoutRequestID: ${CheckoutRequestID}`);
          try {
            // Activate the user
            const updatedUser = await storage.updateUser(userIdToActivate, { isActivated: true });
            if (updatedUser) {
              console.log(`User ${userIdToActivate} successfully activated.`);
              // Process referral rewards now that user is activated
              await processReferralRewards(userIdToActivate);
              // Remove from pending map
              pendingActivationsMap.delete(CheckoutRequestID);
            } else {
              console.error(`Failed to update user ${userIdToActivate} to activated status in storage.`);
            }
          } catch (storageError) {
            console.error(`Error updating user ${userIdToActivate} in storage:`, storageError);
          }
        } else {
          console.warn(`No pending activation found for CheckoutRequestID: ${CheckoutRequestID}. User might have already been activated or ID not tracked.`);
        }
        
        console.log("CallbackMetadata:", JSON.stringify(CallbackMetadata, null, 2));
        
        return res.status(200).json({ 
          ResultCode: 0, 
          ResultDesc: "Callback received and processed successfully",
          MpesaReceiptNumber: CallbackMetadata?.Item?.find((item: any) => item.Name === 'MpesaReceiptNumber')?.Value
        });
      } else {
        // Payment failed or was cancelled
        console.error(`Payment failed. ResultCode: ${ResultCode}, ResultDesc: ${ResultDesc}`);
        
        try {
          const userId = pendingActivationsMap.get(CheckoutRequestID);
          if (userId) {
            await storage.updateUser(userId, { 
              isActivated: false,
              accountBalance: 0
            });
            console.log(`User ${userId} payment failed, status updated`);
            // Remove from pending map
            pendingActivationsMap.delete(CheckoutRequestID);
          }
        } catch (updateError) {
          console.error(`Failed to update user status after payment failure:`, updateError);
        }
        
        return res.status(200).json({ 
          ResultCode: ResultCode, 
          ResultDesc: "Callback received; payment not successful.",
          MpesaReceiptNumber: CallbackMetadata?.Item?.find((item: any) => item.Name === 'MpesaReceiptNumber')?.Value
        });
      }
    } catch (e) {
      const error = e as Error;
      console.error("M-Pesa callback error:", error);
      return res.status(500).json({ 
        ResultCode: 1, 
        ResultDesc: "Failed to process callback",
        error: error.message
      });
    }
  });

// Helper function to process referral rewards after activation
async function processReferralRewards(activatedUserId: number) {
  try {
    console.log(`[REFERRAL_REWARDS] Processing rewards for activated user: ${activatedUserId}`);
    // Find all referrals where this user was referred
    const referrals = await storage.getReferralsByReferredId(activatedUserId);
    
    for (const referral of referrals) {
      if (!referral.isActive) {
        console.log(`[REFERRAL_REWARDS] Processing level ${referral.level} referral for referrer: ${referral.referrerId}`);
        
        // Get referrer info
        const referrer = await storage.getUser(referral.referrerId);
        if (!referrer) {
          console.error(`[REFERRAL_REWARDS] Referrer not found: ${referral.referrerId}`);
          continue;
        }
        
        let rewardAmount = 0;
        
        if (referral.level === 1) {
          // Level 1 referral rewards
          const referrerReferrals = await storage.getReferralsByReferrerId(referral.referrerId);
          const activeDirectReferrals = referrerReferrals.filter((r: any) => r.level === 1 && r.isActive);
          
          if (activeDirectReferrals.length === 0) {
            rewardAmount = 300; // First referral
          } else {
            rewardAmount = 270; // Additional referrals
          }
        } else if (referral.level === 2) {
          // Level 2 referral rewards (fixed amount)
          rewardAmount = 150; // Level 2 referral reward
          console.log(`[LEVEL2-REWARD] Processing level 2 reward for referrerId=${referral.referrerId}, referredId=${referral.referredId}`);
        }
        
        if (rewardAmount > 0) {
          console.log(`[REFERRAL_REWARDS] Reward amount: ${rewardAmount} for level ${referral.level} referrer: ${referrer.username}`);
          
          // Update referral record
          await storage.updateReferral(referral.id, {
            isActive: true,
            amount: rewardAmount
          });
          
          // Create earning record
          await storage.createEarning({
            userId: referrer.id,
            source: 'referral',
            amount: rewardAmount,
            description: `Level ${referral.level} referral reward for user activation`
          });
          
          // Update referrer's account balance
          const currentBalance = referrer.accountBalance || 0;
          await storage.updateUser(referrer.id, {
            accountBalance: currentBalance + rewardAmount
          });
          
          console.log(`[REFERRAL_REWARDS] Level ${referral.level} reward processed: ${rewardAmount} for referrer: ${referrer.username}`);
        }
      }
    }
  } catch (error) {
    console.error(`[REFERRAL_REWARDS] Error processing rewards for user ${activatedUserId}:`, error);
  }
}
  const httpServer = createServer(app);
  return httpServer;
}