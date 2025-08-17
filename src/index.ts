import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import cors from 'cors';
import { registerRoutes } from "./routes"; // Removed .js extension for CommonJS
import { serveStatic, log } from "./vite"; // Removed .js extension for CommonJS

const app = express();

// CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl requests)
    if (!origin) return callback(null, true);
    
    // Build allowed origins from environment variables
    const allowedOrigins = [
      process.env.FRONTEND_URL, // Main frontend URL from env
      process.env.VITE_APP_URL,  // App URL from env
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null, // Vercel preview URLs
      'https://www.moneyqash.online',
      'https://moneyqash.online',
      'https://frontend-moneyqash.vercel.app',
      'https://frontend-moneyqash-git-main-muturimwauras-projects.vercel.app',
      // Development URLs
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:4173'
    ].filter((url): url is string => typeof url === 'string' && url.length > 0);
    
    console.log('CORS checking origin:', origin, 'against allowed:', allowedOrigins);
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    console.log('CORS blocked origin:', origin);
    const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
    return callback(new Error(msg), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With', 
    'Accept', 
    'Origin',
    'Cache-Control',
    'Pragma'
  ]
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Root route for health check or welcome message
  app.get("/", (_req, res) => {
    res.send("API is running");
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Serve static files in production (if frontend is built and placed in public folder)
  // Remove the development/production check since we're not using Vite anymore
  serveStatic(app);

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000');
  const host = '0.0.0.0';
  server.listen(port, host, () => {
    log(`Server running at http://${host}:${port}`);
  });
})();