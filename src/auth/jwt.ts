import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import { env } from '../env';

export type JwtPayload = {
  sub: string; // userId
  email: string;
};

export function signAccessToken(payload: JwtPayload) {
  return jwt.sign(payload, env.JWT_SECRET as Secret, {
    expiresIn: env.JWT_EXPIRES_IN
  } as SignOptions);
}

export function verifyAccessToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  return decoded as JwtPayload;
}
