import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    // Parse the request body to get the CAPTCHA token
    const { token } = await req.json();

    // Log the received token for debugging
    console.log('Received CAPTCHA Token:', token);

    // Check if the token is missing
    if (!token) {
      console.error('CAPTCHA token is missing');
      return NextResponse.json(
        { success: false, error: 'CAPTCHA token is required' },
        { status: 400 }
      );
    }

    // Verify the CAPTCHA token with Turnstile API
    const secretKey = process.env.TURNSTILE_SECRET_KEY; // Your Turnstile secret key in .env.local
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: secretKey,
        response: token,
      }),
    });

    const data = await response.json();

    // Log Turnstile response for debugging
    console.log('Turnstile Response:', data);

    // Handle unsuccessful verification
    if (!data.success) {
      console.error('CAPTCHA verification failed:', data['error-codes']);
      return NextResponse.json(
        { success: false, errors: data['error-codes'] },
        { status: 400 }
      );
    }

    // Return success if CAPTCHA verification passes
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    // Log any unexpected errors
    console.error('Error in CAPTCHA verification:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
