import axios, { AxiosError } from "axios";

const CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET;
const BUSINESS_SHORT_CODE = process.env.MPESA_BUSINESS_SHORT_CODE;
const PASS_KEY = process.env.MPESA_PASS_KEY;
const CALLBACK_URL = process.env.MPESA_CALLBACK_URL;
const ACCOUNT_REFERENCE = process.env.MPESA_ACCOUNT_REFERENCE || "MoneyQash"; // Default if not set

function getTimestamp() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}${hour}${minute}${second}`;
}

async function getAccessToken() {
  try {
    if (!CONSUMER_KEY || !CONSUMER_SECRET) {
      console.error("M-Pesa Consumer Key or Secret is not defined in .env file.");
      throw new Error("M-Pesa API credentials not configured.");
    }
    const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString(
      "base64",
    );
    console.log("Attempting to get access token...");
    const response = await axios.get(
      "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials", // Updated to Sandbox URL
      {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      },
    );
    console.log("Access token received successfully");
    return response.data.access_token;
  } catch (err) {
    const error = err as AxiosError;
    console.error(
      "Error getting access token:",
      error.response?.data || error.message || err,
    );
    throw new Error("Failed to get access token");
  }
}

export async function initiateSTKPush(phoneNumber: string, amount: number) {
  try {
    // Validate phone number format
    if (!phoneNumber.match(/^254[0-9]{9}$/)) {
      throw new Error(
        "Invalid phone number format. Must start with 254 followed by 9 digits",
      );
    }
    if (!BUSINESS_SHORT_CODE || !PASS_KEY || !CALLBACK_URL) {
      console.error("M-Pesa Business Short Code, Pass Key, or Callback URL is not defined in .env file.");
      throw new Error("M-Pesa configuration incomplete.");
    }

    console.log(
      "Initiating STK push for phone:",
      phoneNumber,
      "amount:",
      amount,
    );
    const accessToken = await getAccessToken();
    const timestamp = getTimestamp();
    const password = Buffer.from(
      `${BUSINESS_SHORT_CODE}${PASS_KEY}${timestamp}`,
    ).toString("base64");

    const response = await axios.post(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest", // Updated to Sandbox URL
      {
        BusinessShortCode: BUSINESS_SHORT_CODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline", // Updated Transaction Type
        Amount: amount,
        PartyA: phoneNumber, // This is the customer's phone number
        PartyB: BUSINESS_SHORT_CODE, // For PayBill, PartyB is the PayBill number
        PhoneNumber: phoneNumber, // Customer's phone number initiating the transaction
        CallBackURL: CALLBACK_URL,
        AccountReference: ACCOUNT_REFERENCE, // Updated Account Reference
        TransactionDesc: "Payment of X", // Updated Transaction Description
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    console.log("STK Push Response:", response.data);
    return response.data;
  } catch (err) {
    const error = err as AxiosError;
    console.error("STK Push Error:", error.response?.data || error.message || err);
    throw new Error("Failed to initiate payment. Please try again.");
  }
}
