import { VercelRequest, VercelResponse } from '@vercel/node';
import connectDB, { Equipment } from '../../src/lib/mongodb';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json');

  try {
    await connectDB();
    if (req.method === 'GET') {
      const equipment = await Equipment.find({});
      return res.status(200).json(equipment);
    } 
    
    if (req.method === 'POST') {
      const item = new Equipment(req.body);
      await item.save();
      return res.status(201).json(item);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
