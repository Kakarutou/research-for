import { getDb } from './mongodb';

export interface User {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  rfcBalance: number;
  role: "admin" | "user";
  emailVerified: boolean;
  emailVerifyCode?: string;
  emailVerifyExpiry?: string;
  attendanceDates: string[];
  todayBet?: { date: string; market: string; side: "long" | "short"; amount: number };
  createdAt: string;
}

export async function readUsers(): Promise<User[]> {
  const db = await getDb();
  return db.collection<User>('users').find().toArray();
}

export async function writeUsers(users: User[]): Promise<void> {
  const db = await getDb();
  const col = db.collection<User>('users');
  await col.deleteMany({});
  if (users.length > 0) await col.insertMany(users);
}

export async function findByEmail(email: string): Promise<User | null> {
  const db = await getDb();
  return db.collection<User>('users').findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });
}

export async function findById(id: string): Promise<User | null> {
  const db = await getDb();
  return db.collection<User>('users').findOne({ id });
}

export async function findByUsername(username: string): Promise<User | null> {
  const db = await getDb();
  return db.collection<User>('users').findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
}

export async function createUser(data: Omit<User, 'id' | 'rfcBalance' | 'createdAt' | 'attendanceDates' | 'role'>): Promise<User> {
  const db = await getDb();
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  const user: User = {
    ...data,
    role: adminEmail && data.email.toLowerCase() === adminEmail ? "admin" : "user",
    id: crypto.randomUUID(),
    rfcBalance: 300,
    attendanceDates: [],
    createdAt: new Date().toISOString(),
  };
  await db.collection<User>('users').insertOne(user);
  return user;
}

export async function updateUser(id: string, updates: Partial<User>): Promise<User | null> {
  const db = await getDb();
  const result = await db.collection<User>('users').findOneAndUpdate(
    { id },
    { $set: updates },
    { returnDocument: 'after' }
  );
  return result ?? null;
}

export async function deleteUser(id: string): Promise<void> {
  const db = await getDb();
  await db.collection<User>('users').deleteOne({ id });
}
