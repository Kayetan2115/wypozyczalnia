import { VercelRequest, VercelResponse } from '@vercel/node';
import connectDB, { User } from '../../src/lib/mongodb';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await connectDB();
  res.setHeader('Content-Type', 'application/json');

  try {
    if (req.method === 'GET') {
      const users = await User.find({}).select('-password');
      return res.status(200).json(users);
    } 
    
    if (req.method === 'POST') {
      const { username, password, name, role, email } = req.body;
      const existingUser = await User.findOne({ username: username.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({ error: 'Użytkownik o takim loginie już istnieje' });
      }

      const user = new User({
        username: username.toLowerCase(),
        password,
        name,
        role,
        email
      });
      await user.save();
      
      const userResponse = user.toObject();
      delete userResponse.password;
      return res.status(201).json(userResponse);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
