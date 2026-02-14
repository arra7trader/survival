import { NextResponse } from 'next/server';
import { getTradeHistory } from '@/lib/portfolio';

export async function GET() {
    try {
        const trades = await getTradeHistory(100);
        return NextResponse.json({ trades });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
