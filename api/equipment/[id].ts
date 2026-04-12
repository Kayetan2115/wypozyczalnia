import { VercelRequest, VercelResponse } from '@vercel/node';
import connectDB, { Equipment } from '../../src/lib/mongodb';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await connectDB();
  res.setHeader('Content-Type', 'application/json');
  const { id } = req.query;

  try {
    if (req.method === 'PUT') {
      const item = await Equipment.findByIdAndUpdate(id, req.body, { new: true });
      if (!item) return res.status(404).json({ error: 'Equipment not found' });
      return res.status(200).json(item);
    }

    if (req.method === 'DELETE') {
      const item = await Equipment.findByIdAndDelete(id);
      if (!item) return res.status(404).json({ error: 'Equipment not found' });
      return res.status(200).json({ message: 'Equipment deleted' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
