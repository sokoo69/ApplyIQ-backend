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

  const user = await User.findOne({ email: 'demo@applyiq.com' });
  if (!user) {
    res.status(404).json({ message: 'Demo user not found. Run seed script first.' });
    return;
  }

  setTokenCookie(res, user._id as string);
  
  const userResponse = { id: user._id, name: user.name, email: user.email, role: user.role };
  res.status(200).json({ message: 'Demo logged in', user: userResponse });
};
