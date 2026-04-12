import { VercelRequest, VercelResponse } from '@vercel/node';
import connectDB, { User } from '../../src/lib/mongodb';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json');
  const { id } = req.query;

  try {
    await connectDB();
    if (req.method === 'PUT') {
      const updates = { ...req.body };
      if (updates.password) {
        const user = await User.findById(id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        user.password = updates.password;
        if (updates.name) user.name = updates.name;
        if (updates.role) user.role = updates.role;
        if (updates.email) user.email = updates.email;
        
        await user.save();
        const userResponse = user.toObject();
        delete userResponse.password;
        return res.status(200).json(userResponse);
      }

      const user = await User.findByIdAndUpdate(id, updates, { new: true }).select('-password');
      if (!user) return res.status(404).json({ error: 'User not found' });
      return res.status(200).json(user);
    }

    if (req.method === 'DELETE') {
      const user = await User.findByIdAndDelete(id);
      if (!user) return res.status(404).json({ error: 'User not found' });
      return res.status(200).json({ message: 'User deleted' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
