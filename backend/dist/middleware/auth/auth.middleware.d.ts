/**
 * ADALAT360 - Authentication Middleware
 * JWT verification, RBAC enforcement, case-scope validation
 */
import { Request, Response, NextFunction } from 'express';
import { AccessTokenPayload, UserRole, PermissionLevel } from '../../models/auth.js';
declare global {
    namespace Express {
        interface Request {
            auth?: AccessTokenPayload;
            user?: AccessTokenPayload;
            sessionId?: string;
            caseScope?: {
                case_id: string;
                role_in_case: string;
                permissions: string[];
            }[];
            allCasesAccess?: boolean;
        }
    }
}
export declare function authenticate(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function optionalAuthenticate(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function requireRole(...allowedRoles: UserRole[]): (req: Request, res: Response, next: NextFunction) => void;
export declare function requireAnyRole(...allowedRoles: UserRole[]): (req: Request, res: Response, next: NextFunction) => void;
export declare function requireAllRoles(...requiredRoles: UserRole[]): (req: Request, res: Response, next: NextFunction) => void;
export declare function requirePermission(...permissions: PermissionLevel[]): (req: Request, res: Response, next: NextFunction) => void;
export declare function requireCaseAccess(caseIdParam?: string): (req: Request, res: Response, next: NextFunction) => void;
export declare function requireCasePermission(caseIdParam?: string, ...permissions: PermissionLevel[]): (req: Request, res: Response, next: NextFunction) => void;
export declare function requireOwnershipOrPermission(resourceUserIdParam?: string, fallbackPermission?: PermissionLevel): (req: Request, res: Response, next: NextFunction) => void;
export declare function requireMfa(req: Request, res: Response, next: NextFunction): void;
export declare function userRateLimit(maxRequests: number, windowMs: number, keyPrefix?: string): (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void;
export declare function securityHeaders(req: Request, res: Response, next: NextFunction): void;
export declare function allowedIps(...allowedIPs: string[]): (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.middleware.d.ts.map