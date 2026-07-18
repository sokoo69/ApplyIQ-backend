import { Request, Response, NextFunction } from 'express';
import { auth } from '../config/better-auth';
import { db } from '../config/db';
import { ObjectId } from 'mongodb';

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
 * Verifies Better Auth session, then attaches role from MongoDB.
 */
export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Convert Express IncomingHttpHeaders → Web API Headers (Better Auth requires this)
    const webHeaders = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        value.forEach((v) => webHeaders.append(key, v));
      } else {
        webHeaders.set(key, value);
      }
    }

    const session = await auth.api.getSession({ headers: webHeaders });
    
    if (!session || !session.user) {
      res.status(401).json({ message: 'Unauthorized, no session' });
      return;
    }
    
    // Fetch role and resumeText from our users collection
    const dbUser = await db.collection('users').findOne(
      { _id: new ObjectId(session.user.id) },
      { projection: { role: 1, resumeText: 1 } }
    );

    // Attach user, role, and resumeText to request
    req.user = {
      ...session.user,
      role: dbUser?.role || 'job_seeker', // Default to job_seeker if not set
      resumeText: dbUser?.resumeText || '',
    };
    next();
  } catch (error) {
    res.status(401).json({ message: 'Unauthorized, session invalid' });
  }
};

/**
 * requireRole:
 * Authorization middleware to check if the authenticated user has a specific role.
 * Accepts a single role string or array of allowed roles.
 */
export const requireRole = (role: string | string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const allowedRoles = Array.isArray(role) ? role : [role];
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      res.status(403).json({ message: 'Forbidden, insufficient permissions' });
      return;
    }
    next();
  };
};
