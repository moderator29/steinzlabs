import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { arkhamAPI } from '@/lib/arkham/api';

const entityIdSchema = z.string().trim().min(1).max(200);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ entityId: string }> }
) {
  try {
    const { entityId } = await params;
    const parsed = entityIdSchema.safeParse(entityId);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid entity ID' }, { status: 400 });
    }

    const data = await arkhamAPI.getEntity(parsed.data);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Arkham entity fetch failed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch entity' },
      { status: 500 }
    );
  }
}
