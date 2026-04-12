import { VercelRequest, VercelResponse } from '@vercel/node';
import connectDB, { Report } from '../../src/lib/mongodb.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json');

  try {
    await connectDB();
    if (req.method === 'GET') {
      const reports = await Report.find({}).sort({ date: -1 });
      return res.status(200).json(reports);
    } 
    
    if (req.method === 'POST') {
      const report = new Report(req.body);
      await report.save();
      return res.status(201).json(report);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
