import { Request, Response } from 'express';
import User from '../models/User.model';

export const getMe = (req: Request, res: Response): void => {
  // req.user is populated by requireAuth middleware
  res.status(200).json({ user: req.user });
};

export const demoLogin = async (req: Request, res: Response): Promise<void> => {
  if (process.env.NODE_ENV === 'production') {
    res.status(403).json({ message: 'Demo login not allowed in production' });
    return;
  }

  const targetEmail = 'demo@applyiq.com';
  
  // Since we use Better Auth, we need to log in using the demo user's password.
  // We assume the seed script sets the password to 'DemoUser123!'
  const dummyPassword = 'DemoUser123!';

  try {
    // We delegate the actual login to Better Auth
    const { auth } = await import('../config/better-auth');
    
    // We create a mocked request object for Better Auth to parse headers (important for setting cookies)
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') headers.set(key, value);
    }
    
    // Call better auth's internal API to sign in and set the cookie
    const signInResult = await auth.api.signInEmail({
      body: {
        email: targetEmail,
        password: dummyPassword
      },
      headers,
      asResponse: true
    });
    
    if (signInResult instanceof Response) {
      // Proxy the headers (especially Set-Cookie) back to Express res
      signInResult.headers.forEach((value, key) => {
        res.append(key, value);
      });
      const data = await signInResult.json();
      res.status(signInResult.status).json(data);
    } else {
      res.status(200).json(signInResult);
    }
  } catch (error: any) {
    console.error('Demo login failed with Better Auth:', error);
    res.status(500).json({ message: 'Demo login failed' });
  }
};


