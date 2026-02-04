import { CognitoJwtVerifier } from "aws-jwt-verify";
import { Request, Response, NextFunction } from "express";
import logger from '../utils/logger';

let verifier: any;

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    // If auth is not configured, skip (or fail safe, but for migration flexibility we warn)
    if (!process.env.COGNITO_USER_POOL_ID || !process.env.COGNITO_CLIENT_ID) {
        logger.warn("Cognito environment variables (COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID) not set. Skipping auth check.");
        return next();
    }

    if (!verifier) {
        try {
            verifier = CognitoJwtVerifier.create({
                userPoolId: process.env.COGNITO_USER_POOL_ID,
                tokenUse: "id", // Use ID token for authentication
                clientId: process.env.COGNITO_CLIENT_ID,
            });
        } catch (error: any) {
            logger.error("Failed to create JWT verifier:", error.message);
            return next();
        }
    }

    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            res.status(401).json({ error: "No authorization header provided" });
            return;
        }

        const token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : authHeader;
        const payload = await verifier.verify(token);

        // Enforce single-email restriction
        const allowedEmail = process.env.ALLOWED_EMAIL;
        if (allowedEmail && payload.email !== allowedEmail) {
            logger.warn(`Unauthorized access attempt from: ${payload.email}`);
            res.status(403).json({ error: "Access denied. Unauthorized user." });
            return;
        }

        (req as any).user = payload;
        next();
    } catch (err: any) {
        logger.error("Token verification failed:", err.message);
        res.status(401).json({ error: "Invalid token" });
    }
};
