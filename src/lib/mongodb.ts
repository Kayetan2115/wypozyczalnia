import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const MONGODB_URI = process.env.MONGODB_URI?.trim();

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 15000, // Increased timeout for DNS resolution
      connectTimeoutMS: 15000,
      family: 4, // Force IPv4 to bypass DNS SRV resolution issues on Vercel
      maxPoolSize: 10,
    };

    const connectWithRetry = async (retries = 5): Promise<typeof mongoose> => {
      try {
        console.log(`Attempting MongoDB connection (Retries left: ${retries})...`);
        // Using the URI from process.env directly to ensure it's fresh
        return await mongoose.connect(process.env.MONGODB_URI!, opts);
      } catch (err) {
        if (retries > 0) {
          console.warn('MongoDB connection failed, retrying in 3s...', err);
          await new Promise(resolve => setTimeout(resolve, 3000));
          return connectWithRetry(retries - 1);
        }
        throw err;
      }
    };

    cached.promise = connectWithRetry().then((mongoose) => {
      console.log('MongoDB Connected successfully');
      return mongoose;
    }).catch(err => {
      console.error('CRITICAL: MongoDB Connection Failed after all retries:', err);
      throw err;
    });
  }
  
  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

// Interfaces
export interface IUser extends mongoose.Document {
  username: string;
  password: string;
  name: string;
  role: 'admin' | 'seller';
  email?: string;
  comparePassword: (password: string) => Promise<boolean>;
}

export interface IEquipment extends mongoose.Document {
  name: string;
  type: string;
  status: 'available' | 'rented' | 'broken';
  hourlyRate: number;
  issueDescription?: string;
}

export interface IRental extends mongoose.Document {
  equipmentId: string;
  equipmentName: string;
  startTime: Date;
  endTime?: Date;
  plannedDuration: number;
  customerPhone?: string;
  deposit: boolean;
  sellerId: string;
  sellerName: string;
  status: 'active' | 'completed';
  totalAmount?: number;
  overtimeMinutes?: number;
  paymentMethod?: 'cash' | 'card';
}

export interface IReport extends mongoose.Document {
  sellerId: string;
  sellerName: string;
  date: Date;
  cashTotal: number;
  cardTotal: number;
  notes?: string;
}

// Schemas
const userSchema = new mongoose.Schema<IUser>({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['admin', 'seller'], required: true },
  email: String
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err as Error);
  }
});

userSchema.methods.comparePassword = async function(candidatePassword: string) {
  return bcrypt.compare(candidatePassword, this.password);
};

const equipmentSchema = new mongoose.Schema<IEquipment>({
  name: String,
  type: String,
  status: { type: String, enum: ['available', 'rented', 'broken'], default: 'available' },
  hourlyRate: Number,
  issueDescription: String
}, { timestamps: true });

const rentalSchema = new mongoose.Schema<IRental>({
  equipmentId: String,
  equipmentName: String,
  startTime: Date,
  endTime: Date,
  plannedDuration: Number,
  customerPhone: String,
  deposit: Boolean,
  sellerId: String,
  sellerName: String,
  status: { type: String, enum: ['active', 'completed'], default: 'active' },
  totalAmount: Number,
  overtimeMinutes: Number,
  paymentMethod: { type: String, enum: ['cash', 'card'] }
}, { timestamps: true });

const reportSchema = new mongoose.Schema<IReport>({
  sellerId: String,
  sellerName: String,
  date: Date,
  cashTotal: Number,
  cardTotal: Number,
  notes: String
}, { timestamps: true });

export const User = (mongoose.models.User as mongoose.Model<IUser>) || mongoose.model<IUser>('User', userSchema);
export const Equipment = (mongoose.models.Equipment as mongoose.Model<IEquipment>) || mongoose.model<IEquipment>('Equipment', equipmentSchema);
export const Rental = (mongoose.models.Rental as mongoose.Model<IRental>) || mongoose.model<IRental>('Rental', rentalSchema);
export const Report = (mongoose.models.Report as mongoose.Model<IReport>) || mongoose.model<IReport>('Report', reportSchema);

export default connectDB;
