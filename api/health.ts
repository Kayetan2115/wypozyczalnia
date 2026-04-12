import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json({ 
    status: 'ok', 
    message: 'API is working',
    env: {
      hasMongo: !!process.env.MONGODB_URI,
      nodeEnv: process.env.NODE_ENV
    }
  });
}
