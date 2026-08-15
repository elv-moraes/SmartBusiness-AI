import { UserRole } from '../generated/prisma/enums';

export interface JwtPayload {
  sub: string;
  companyId: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}
