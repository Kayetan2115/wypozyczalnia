import { VercelRequest, VercelResponse } from '@vercel/node';
import connectDB, { User } from '../src/lib/mongodb';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set JSON header immediately
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Connect inside try-catch to handle connection errors gracefully
    await connectDB();

    const { username, password } = req.body;
    
    // Bootstrap: If no users exist, create a default admin
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      const defaultAdmin = new User({
        username: 'admin',
        password: 'swopr',
        name: 'Administrator Systemu',
        role: 'admin',
        email: 'admin@swopr.local'
      });
      await defaultAdmin.save();
      console.log('Default admin created');
    }

    const user = await User.findOne({ username: username.toLowerCase() });
    
    if (!user) {
      return res.status(401).json({ error: 'Nieprawidłowy login lub hasło' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Nieprawidłowy login lub hasło' });
    }

    const userResponse = user.toObject();
    delete userResponse.password;
    return res.status(200).json(userResponse);
  } catch (error: any) {
    console.error('Login Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
