import { User } from "../../types.js";
import { createAccessToken, createFingerprintToken, createRefreshToken } from "../../utils/auth.js";
import { hash } from "../../utils/crypto.js";
import {
    AccessToken,
    FingerprintToken,
    RefreshToken,
} from "../../utils/token.js";
import { Context } from "../index.js";

export type CreateUser = (
    authId: string,
    identifier: string,
    options: {
        password?: string;
        user_data?: Record<string, any>;
    }
) => Promise<{
    user: User;
    access_token: AccessToken;
    refresh_token: RefreshToken;
    fingerprint_token: FingerprintToken;
    cookies: string[];
}>;

export const createUserFunction = (context: Context) => {
    const createUser: CreateUser = async (authId, identifier, options) => {
        const identifierToken = `${authId}:${identifier}`;
        const userId = context.generateUserId();
        const fingerprintToken = createFingerprintToken(context);
        const userData = options.user_data || {};
        const user = {
            user_id: userId,
            ...userData,
        };
        const refreshToken = await createRefreshToken(
            user.user_id,
            fingerprintToken.value,
            context
        );
        const encryptedRefreshToken = refreshToken.encrypt();
        const hashedPassword = options.password
            ? await hash(options.password)
            : null;

        await context.adapter.createUser(userId, {
            identifier_token: identifierToken,
            hashed_password: hashedPassword,
            user_data: userData,
        });
        await context.adapter.saveRefreshToken(refreshToken.value, userId);
        const accessToken = await createAccessToken(
            user,
            fingerprintToken.value,
            context
        );
        const accessTokenCookie = accessToken.createCookie();
        const encryptedRefreshTokenCookie =
            encryptedRefreshToken.createCookie();
        const fingerprintTokenCookie = fingerprintToken.createCookie();
        return {
            user,
            access_token: accessToken,
            refresh_token: refreshToken,
            fingerprint_token: fingerprintToken,
            encrypted_refresh_token: encryptedRefreshToken,
            cookies: [
                accessTokenCookie,
                encryptedRefreshTokenCookie,
                fingerprintTokenCookie,
            ],
        };
    };
    return createUser;
};
