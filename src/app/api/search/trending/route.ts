import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export interface TrendingItem {
  symbol: string;
  name: string;
  count: number;
}

export async function GET() {
  try {
    const db = await getDb();
    const since = new Date(Date.now() - 60 * 60 * 1000); // last 1 hour

    const results = await db.collection('searches').aggregate([
      { $match: { searchedAt: { $gte: since } } },
      { $group: { _id: '$symbol', name: { $last: '$name' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $project: { _id: 0, symbol: '$_id', name: 1, count: 1 } },
    ]).toArray();

    return NextResponse.json(results);
  } catch {
    return NextResponse.json([]);
  }
}
