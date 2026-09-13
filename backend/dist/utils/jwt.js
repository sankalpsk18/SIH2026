"use strict";
/**
 * ADALAT360 - JWT Utilities
 * Token generation, verification, and management
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAccessToken = generateAccessToken;
exports.generateRefreshToken = generateRefreshToken;
exports.generateMfaPendingToken = generateMfaPendingToken;
exports.verifyAccessToken = verifyAccessToken;
exports.verifyRefreshToken = verifyRefreshToken;
exports.verifyMfaToken = verifyMfaToken;
exports.decodeToken = decodeToken;
exports.extractTokenFromHeader = extractTokenFromHeader;
exports.extractTokenFromCookie = extractTokenFromCookie;
exports.getTokenExpiry = getTokenExpiry;
exports.isTokenNearExpiry = isTokenNearExpiry;
exports.checkTokenRevocation = checkTokenRevocation;
exports.revokeToken = revokeToken;
exports.generateTokenPair = generateTokenPair;
const jwt = __importStar(require("jsonwebtoken"));
const uuid_1 = require("uuid");
const index_js_1 = require("../config/index.js");
// ============================================================================
// TOKEN GENERATION
// ============================================================================
function generateAccessToken(payload) {
    const now = Math.floor(Date.now() / 1000);
    const expiry = now + parseDuration(index_js_1.config.jwt.accessTokenExpiry);
    const tokenPayload = {
        ...payload,
        type: 'access',
        iat: now,
        exp: expiry,
        iss: index_js_1.config.jwt.issuer,
        aud: index_js_1.config.jwt.audience,
    };
    return jwt.sign(tokenPayload, index_js_1.config.jwt.secret, {
        algorithm: 'HS256',
        jwtid: (0, uuid_1.v4)(),
    });
}
function generateRefreshToken(payload) {
    const now = Math.floor(Date.now() / 1000);
    const expiry = now + parseDuration(index_js_1.config.jwt.refreshTokenExpiry);
    const tokenPayload = {
        ...payload,
        type: 'refresh',
        iat: now,
        exp: expiry,
        iss: index_js_1.config.jwt.issuer,
        aud: index_js_1.config.jwt.audience,
    };
    return jwt.sign(tokenPayload, index_js_1.config.jwt.refreshSecret, {
        algorithm: 'HS256',
        jwtid: (0, uuid_1.v4)(),
    });
}
function generateMfaPendingToken(payload) {
    const now = Math.floor(Date.now() / 1000);
    // MFA tokens expire in 5 minutes
    const expiry = now + 300;
    const tokenPayload = {
        ...payload,
        pending_mfa: true,
        type: 'mfa_pending',
        iat: now,
        exp: expiry,
        iss: index_js_1.config.jwt.issuer,
        aud: index_js_1.config.jwt.audience,
    };
    return jwt.sign(tokenPayload, index_js_1.config.jwt.secret, {
        algorithm: 'HS256',
        jwtid: (0, uuid_1.v4)(),
    });
}
function verifyAccessToken(token) {
    try {
        const payload = jwt.verify(token, index_js_1.config.jwt.secret, {
            algorithms: ['HS256'],
            issuer: index_js_1.config.jwt.issuer,
            audience: index_js_1.config.jwt.audience,
        });
        if (payload.type !== 'access') {
            return { valid: false, error: 'Invalid token type' };
        }
        return { valid: true, payload };
    }
    catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return { valid: false, error: 'Token expired', expired: true };
        }
        if (error instanceof jwt.JsonWebTokenError) {
            return { valid: false, error: error.message };
        }
        return { valid: false, error: 'Token verification failed' };
    }
}
function verifyRefreshToken(token) {
    try {
        const payload = jwt.verify(token, index_js_1.config.jwt.refreshSecret, {
            algorithms: ['HS256'],
            issuer: index_js_1.config.jwt.issuer,
            audience: index_js_1.config.jwt.audience,
        });
        if (payload.type !== 'refresh') {
            return { valid: false, error: 'Invalid token type' };
        }
        return { valid: true, payload };
    }
    catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return { valid: false, error: 'Token expired', expired: true };
        }
        if (error instanceof jwt.JsonWebTokenError) {
            return { valid: false, error: error.message };
        }
        return { valid: false, error: 'Token verification failed' };
    }
}
function verifyMfaToken(token) {
    try {
        const payload = jwt.verify(token, index_js_1.config.jwt.secret, {
            algorithms: ['HS256'],
            issuer: index_js_1.config.jwt.issuer,
            audience: index_js_1.config.jwt.audience,
        });
        if (payload.type !== 'mfa_pending' || !payload.pending_mfa) {
            return { valid: false, error: 'Invalid MFA token' };
        }
        return { valid: true, payload };
    }
    catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return { valid: false, error: 'MFA token expired', expired: true };
        }
        if (error instanceof jwt.JsonWebTokenError) {
            return { valid: false, error: error.message };
        }
        return { valid: false, error: 'MFA token verification failed' };
    }
}
// ============================================================================
// TOKEN DECODING (without verification - for debugging/logging)
// ============================================================================
function decodeToken(token) {
    try {
        return jwt.decode(token);
    }
    catch {
        return null;
    }
}
// ============================================================================
// TOKEN EXTRACTION
// ============================================================================
function extractTokenFromHeader(authHeader) {
    if (!authHeader)
        return null;
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
        return null;
    }
    return parts[1];
}
function extractTokenFromCookie(cookies, cookieName) {
    if (!cookies)
        return null;
    const cookieArray = cookies.split(';');
    for (const cookie of cookieArray) {
        const [name, value] = cookie.trim().split('=');
        if (name === cookieName) {
            return value;
        }
    }
    return null;
}
// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
function parseDuration(duration) {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) {
        // Default to 15 minutes
        return 15 * 60;
    }
    const value = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
        case 's': return value;
        case 'm': return value * 60;
        case 'h': return value * 60 * 60;
        case 'd': return value * 60 * 60 * 24;
        default: return 15 * 60;
    }
}
function getTokenExpiry(token) {
    const decoded = decodeToken(token);
    if (!decoded || !decoded.exp)
        return null;
    return new Date(decoded.exp * 1000);
}
function isTokenNearExpiry(token, thresholdMinutes = 5) {
    const expiry = getTokenExpiry(token);
    if (!expiry)
        return true;
    const now = new Date();
    const diffMinutes = (expiry.getTime() - now.getTime()) / (1000 * 60);
    return diffMinutes <= thresholdMinutes;
}
// This will be implemented in the session service with Redis
async function checkTokenRevocation(_tokenId, _tokenType) {
    // Implemented in session service
    return { isRevoked: false };
}
async function revokeToken(_tokenId, _tokenType, _reason) {
    // Implemented in session service
}
function generateTokenPair(userId, email, role, department, caseIds, permissions, sessionId) {
    const accessToken = generateAccessToken({
        sub: userId,
        email,
        role,
        department,
        case_ids: caseIds,
        permissions,
        session_id: sessionId,
    });
    const refreshToken = generateRefreshToken({
        sub: userId,
        session_id: sessionId,
    });
    const expiry = parseDuration(index_js_1.config.jwt.accessTokenExpiry);
    return {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: expiry,
        token_type: 'Bearer',
    };
}
//# sourceMappingURL=jwt.js.map