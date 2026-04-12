import { VercelRequest, VercelResponse } from '@vercel/node';
import connectDB, { Rental, Report, Equipment } from '../src/lib/mongodb';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await connectDB();
    // 1. Delete all rentals
    await Rental.deleteMany({});
    
    // 2. Delete all reports
    await Report.deleteMany({});
    
    // 3. Reset all equipment status to available
    await Equipment.updateMany({}, { status: 'available', issueDescription: '' });

    return res.status(200).json({ 
      message: 'Statystyki zostały pomyślnie zresetowane. Wszystkie wypożyczenia i raporty zostały usunięte, a sprzęt ustawiony jako dostępny.' 
    });
  } catch (error: any) {
    console.error('Reset Stats Error:', error);
    return res.status(500).json({ error: error.message || 'Wystąpił błąd podczas resetowania statystyk' });
  }
}
