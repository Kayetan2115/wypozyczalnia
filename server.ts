import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Helper to wrap Vercel-style handlers for Express
  const vercelToExpress = (handler: any) => async (req: any, res: any) => {
    try {
      await handler(req, res);
    } catch (error: any) {
      console.error('API Error:', error);
      res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  };

  // API Routes
  const healthHandler = await import('./api/health.ts').then(m => m.default);
  const loginHandler = await import('./api/login.ts').then(m => m.default);
  const resetStatsHandler = await import('./api/reset-stats.ts').then(m => m.default);
  const usersIndexHandler = await import('./api/users/index.ts').then(m => m.default);
  const usersIdHandler = await import('./api/users/[id].ts').then(m => m.default);
  const equipmentIndexHandler = await import('./api/equipment/index.ts').then(m => m.default);
  const equipmentIdHandler = await import('./api/equipment/[id].ts').then(m => m.default);
  const rentalsIndexHandler = await import('./api/rentals/index.ts').then(m => m.default);
  const rentalsIdHandler = await import('./api/rentals/[id].ts').then(m => m.default);
  const reportsIndexHandler = await import('./api/reports/index.ts').then(m => m.default);

  app.all('/api/health', vercelToExpress(healthHandler));
  app.all('/api/login', vercelToExpress(loginHandler));
  app.all('/api/reset-stats', vercelToExpress(resetStatsHandler));
  
  app.all('/api/users', vercelToExpress(usersIndexHandler));
  app.all('/api/users/:id', vercelToExpress(usersIdHandler));
  
  app.all('/api/equipment', vercelToExpress(equipmentIndexHandler));
  app.all('/api/equipment/:id', vercelToExpress(equipmentIdHandler));
  
  app.all('/api/rentals', vercelToExpress(rentalsIndexHandler));
  app.all('/api/rentals/:id', vercelToExpress(rentalsIdHandler));
  
  app.all('/api/reports', vercelToExpress(reportsIndexHandler));

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
