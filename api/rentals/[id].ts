import { VercelRequest, VercelResponse } from '@vercel/node';
import connectDB, { Rental } from '../../src/lib/mongodb';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await connectDB();
  res.setHeader('Content-Type', 'application/json');
  const { id } = req.query;

  try {
    if (req.method === 'PUT') {
      const rental = await Rental.findByIdAndUpdate(id, req.body, { new: true });
      if (!rental) return res.status(404).json({ error: 'Rental not found' });
      return res.status(200).json(rental);
    }

    if (req.method === 'DELETE') {
      const rental = await Rental.findByIdAndDelete(id);
      if (!rental) return res.status(404).json({ error: 'Rental not found' });
      return res.status(200).json({ message: 'Rental deleted' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
