import {
    createAccessToken,
    createRefreshToken,
    getAccountFromDatabaseData,
} from "../utils/auth.js";
import { LuciaError } from "../utils/error.js";
import { AccessToken, RefreshToken } from "../utils/token.js";
import { Context } from "./index.js";

export type RefreshTokens = (
    refreshToken: string,
    fingerprintToken: string
) => Promise<{
    access_token: AccessToken;
    refresh_token: RefreshToken;
}>;
export const refreshTokensFunction = (context: Context) => {
    const refreshAccessToken: RefreshTokens = async (
        refreshTokenValue,
        fingerprintToken
    ) => {
        const refreshToken = new RefreshToken(refreshTokenValue, context);
        let userId: string;
        try {
            userId = await refreshToken.userId(fingerprintToken);
        } catch (e) {
            if (refreshToken.value && !fingerprintToken) {
                await context.adapter.deleteRefreshToken(refreshToken.value);
            }
            throw e;
        }
        const databaseData = await context.adapter.getUserFromRefreshToken(
            refreshToken.value
        );
        if (!databaseData) {
            await context.adapter.deleteUserRefreshTokens(userId);
            throw new LuciaError("AUTH_INVALID_REFRESH_TOKEN");
        }
        const newRefreshToken = await createRefreshToken(
            userId,
            fingerprintToken,
            context
        );
        await Promise.all([
            context.adapter.deleteRefreshToken(refreshToken.value),
            context.adapter.saveRefreshToken(newRefreshToken.value, userId),
        ]);
        const account = getAccountFromDatabaseData(databaseData);
        const accessToken = await createAccessToken(
            account.user,
            fingerprintToken,
            context
        );
        return {
            access_token: accessToken,
            refresh_token: newRefreshToken,
        };
    };
    return refreshAccessToken;
};
