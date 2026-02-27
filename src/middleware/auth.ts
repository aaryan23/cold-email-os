import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

function makeToken(password: string): string {
  return crypto
    .createHmac('sha256', 'cold-email-os-gamic')
    .update(password)
    .digest('hex');
}

export function login(password: string): string {
  if (password !== env.ADMIN_PASSWORD) throw new Error('Invalid password');
  return makeToken(password);
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.replace('Bearer ', '').trim();
  if (!token || token !== makeToken(env.ADMIN_PASSWORD)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}
