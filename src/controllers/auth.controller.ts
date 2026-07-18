import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import User from '../models/User.model';

// Validation schemas
const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

/**
 * Set HTTP-only cookie
 * Security Decision: JWTs are stored in cookies with httpOnly: true to mitigate XSS risks.
 * secure: true is used in production to ensure tokens are only sent over HTTPS.
 * sameSite: strict prevents CSRF attacks.
 */
const setTokenCookie = (res: Response, userId: string) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET as string, { expiresIn: '7d' });
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = registerSchema.parse(req.body);
    
    const existingUser = await User.findOne({ email: parsed.email });
    if (existingUser) {
      res.status(400).json({ message: 'Email already in use' });
      return;
    }

    // Security Decision: We hash passwords using bcrypt before saving. 
    // This ensures that even in the event of a database breach, plain text passwords remain secure.
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(parsed.password, salt);

    const user = await User.create({
      name: parsed.name,
      email: parsed.email,
      passwordHash,
      role: 'job_seeker'
    });

    setTokenCookie(res, user._id as string);

    // Security Decision: Do not send passwordHash in the API response.
    const userResponse = { id: user._id, name: user.name, email: user.email, role: user.role };
    res.status(201).json({ message: 'User registered', user: userResponse });
  } catch (error: any) {
    res.status(400).json({ message: 'Registration failed', error: error.errors || error.message });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = loginSchema.parse(req.body);
    
    const user = await User.findOne({ email: parsed.email });
    if (!user || !user.passwordHash) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    const isMatch = await bcrypt.compare(parsed.password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    setTokenCookie(res, user._id as string);

    const userResponse = { id: user._id, name: user.name, email: user.email, role: user.role };
    res.status(200).json({ message: 'Logged in', user: userResponse });
  } catch (error: any) {
    res.status(400).json({ message: 'Login failed', error: error.errors || error.message });
  }
};

export const logout = (req: Request, res: Response): void => {
  res.clearCookie('token');
  res.status(200).json({ message: 'Logged out' });
};

export const getMe = (req: Request, res: Response): void => {
  // req.user is populated by requireAuth middleware, sans password
  res.status(200).json({ user: req.user });
};

export const demoLogin = async (req: Request, res: Response): Promise<void> => {
  // Security Decision: Prevent usage of demo login in production to avoid unauthorized access.
  if (process.env.NODE_ENV === 'production') {
    res.status(403).json({ message: 'Demo login not allowed in production' });
    return;
  }

  // Security Decision: Strictly hardcode the email to prevent any body injection.
  const targetEmail = 'demo@applyiq.com';

  const user = await User.findOne({ email: targetEmail });
  if (!user) {
    res.status(404).json({ message: 'Demo user not found. Run seed script first.' });
    return;
  }

  // Security Decision: Ensure the demo user does not possess elevated permissions.
  if (user.role === 'admin') {
    res.status(403).json({ message: 'Demo user cannot have admin privileges.' });
    return;
  }

  setTokenCookie(res, user._id as string);
  
  const userResponse = { id: user._id, name: user.name, email: user.email, role: user.role };
  res.status(200).json({ message: 'Demo logged in', user: userResponse });
};

export const googleLogin = (req: Request, res: Response): void => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/auth/google/callback`;
  const scope = 'email profile';
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${encodeURIComponent(scope)}`;
  res.redirect(authUrl);
};

export const googleCallback = async (req: Request, res: Response): Promise<void> => {
  const code = req.query.code as string;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/auth/google/callback`;

  if (!code) {
    res.status(400).json({ message: 'Authorization code missing' });
    return;
  }

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId || '',
        client_secret: clientSecret || '',
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
      console.error('Token error:', tokenData);
      res.redirect(`${process.env.FRONTEND_ORIGIN || 'http://localhost:3000'}/login?error=GoogleAuthFailed`);
      return;
    }

    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    
    const profileData = await profileResponse.json();
    if (!profileResponse.ok || !profileData.email) {
      console.error('Profile error:', profileData);
      res.redirect(`${process.env.FRONTEND_ORIGIN || 'http://localhost:3000'}/login?error=GoogleProfileFailed`);
      return;
    }

    let user = await User.findOne({ email: profileData.email });
    if (!user) {
      user = await User.create({
        name: profileData.name || 'Google User',
        email: profileData.email,
        avatarUrl: profileData.picture,
        role: 'job_seeker',
        passwordHash: null,
      });
    }

    setTokenCookie(res, user._id as string);
    res.redirect(`${process.env.FRONTEND_ORIGIN || 'http://localhost:3000'}/dashboard`);
    
  } catch (error) {
    console.error('Google OAuth error:', error);
    res.redirect(`${process.env.FRONTEND_ORIGIN || 'http://localhost:3000'}/login?error=GoogleAuthFailed`);
  }
};
