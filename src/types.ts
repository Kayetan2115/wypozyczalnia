export type UserRole = 'admin' | 'seller';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  username?: string;
  password?: string;
  doc_type: 'user';
}

export type EquipmentType = 'Kajak' | 'Rower wodny' | 'Deska SUP' | 'Fleatcher' | 'Perkoz' | 'Alfa';
export type EquipmentStatus = 'available' | 'rented' | 'broken';

export interface Equipment {
  id: string;
  name: string;
  type: EquipmentType;
  hourlyRate: number;
  status: EquipmentStatus;
  issueDescription?: string;
  doc_type: 'equipment';
}

export type RentalStatus = 'active' | 'completed';
export type PaymentMethod = 'cash' | 'card';

export interface Rental {
  id: string;
  equipmentId: string;
  equipmentName: string;
  startTime: string;
  endTime?: string;
  totalAmount?: number;
  paymentMethod?: PaymentMethod;
  deposit: boolean;
  customerPhone?: string;
  plannedDuration: number; // in hours
  overtimeMinutes?: number;
  sellerId: string;
  sellerName: string;
  status: RentalStatus;
  doc_type: 'rental';
}

export interface ShiftReport {
  id: string;
  sellerId: string;
  sellerName: string;
  date: string;
  cashTotal: number;
  cardTotal: number;
  notes?: string;
  doc_type: 'report';
}
