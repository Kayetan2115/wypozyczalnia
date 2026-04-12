import { VercelRequest, VercelResponse } from '@vercel/node';
import connectDB, { Rental } from '../../src/lib/mongodb';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await connectDB();
  res.setHeader('Content-Type', 'application/json');

  try {
    if (req.method === 'GET') {
      const rentals = await Rental.find({}).sort({ createdAt: -1 });
      return res.status(200).json(rentals);
    } 
    
    if (req.method === 'POST') {
      const rental = new Rental(req.body);
      await rental.save();
      return res.status(201).json(rental);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
