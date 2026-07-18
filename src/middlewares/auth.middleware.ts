import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.model';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

/**
 * requireAuth:
 * Verifies JWT token from httpOnly cookie.
 * 
 * Security Decision: We use httpOnly, secure cookies for JWT instead of 
 * localStorage to prevent XSS (Cross-Site Scripting) attacks from accessing the token.
 */
export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = req.cookies?.token;

    if (!token) {
      res.status(401).json({ message: 'Unauthorized, no token provided' });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: string };
    
    // Attach user to request, excluding sensitive fields
    const user = await User.findById(decoded.userId).select('-passwordHash');
    
    if (!user) {
      res.status(401).json({ message: 'Unauthorized, user not found' });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Unauthorized, token invalid' });
  }
};

/**
 * requireRole:
 * Authorization middleware to check if the authenticated user has a specific role.
 */
export const requireRole = (role: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || req.user.role !== role) {
      res.status(403).json({ message: 'Forbidden, insufficient permissions' });
      return;
    }
    next();
  };
};
