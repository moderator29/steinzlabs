import { NextRequest, NextResponse } from 'next/server';
import { createSession, sessionCookieOptions } from '@/lib/auth';
import { handleApiError, apiErrorResponse } from '@/lib/errorHandler';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { privyToken } = body;

    if (!privyToken) {
      return apiErrorResponse(400, 'Missing authentication token');
    }

    const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    const privyAppSecret = process.env.PRIVY_APP_SECRET;

    if (!privyAppId || !privyAppSecret) {
      return apiErrorResponse(500, 'Auth configuration missing');
    }

    let verifiedUser: { userId: string; email?: string; walletAddress?: string } | null = null;

    try {
      const verifyRes = await fetch('https://auth.privy.io/api/v1/users/me', {
        headers: {
          'Authorization': `Bearer ${privyToken}`,
          'privy-app-id': privyAppId,
        },
      });

      if (!verifyRes.ok) {
        return apiErrorResponse(401, 'Invalid authentication token');
      }

      const userData = await verifyRes.json();
      const privyUserId = userData.id;

      if (!privyUserId) {
        return apiErrorResponse(401, 'Invalid user data from auth provider');
      }

      let email: string | undefined;
      let walletAddress: string | undefined;

      if (userData.linked_accounts) {
        for (const account of userData.linked_accounts) {
          if (account.type === 'email' && account.address) {
            email = account.address;
          }
          if ((account.type === 'wallet' || account.type === 'smart_wallet') && account.address) {
            walletAddress = account.address;
          }
        }
      }

      verifiedUser = { userId: privyUserId, email, walletAddress };
    } catch {
      return apiErrorResponse(401, 'Token verification failed');
    }

    if (!verifiedUser) {
      return apiErrorResponse(401, 'Authentication failed');
    }

    const sessionToken = await createSession({
      userId: verifiedUser.userId,
      privyId: verifiedUser.userId,
      email: verifiedUser.email,
      walletAddress: verifiedUser.walletAddress,
    });

    const cookieOpts = sessionCookieOptions();
    const response = NextResponse.json({ success: true, userId: verifiedUser.userId });
    response.cookies.set(cookieOpts.name, sessionToken, {
      httpOnly: cookieOpts.httpOnly,
      secure: cookieOpts.secure,
      sameSite: cookieOpts.sameSite,
      maxAge: cookieOpts.maxAge,
      path: cookieOpts.path,
    });

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
