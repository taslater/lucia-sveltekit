import { LuciaError } from "../utils/error.js";
import { Context } from "./index.js";
import cookie from "cookie";
import { User } from "../types.js";
import { AccessToken, FingerprintToken } from "../utils/token.js";

export type ValidateRequest = (request: Request) => Promise<User>;
export const validateRequestFunction = (context: Context) => {
    const validateRequest: ValidateRequest = async (request) => {
        const authorizationHeader = request.headers.get("Authorization") || "";
        const [tokenType, token] = authorizationHeader.split(" ");
        if (!tokenType || !token)
            throw new LuciaError("AUTH_INVALID_ACCESS_TOKEN");
        if (tokenType !== "Bearer")
            throw new LuciaError("AUTH_INVALID_ACCESS_TOKEN");
        if (!token) throw new LuciaError("AUTH_INVALID_ACCESS_TOKEN");
        const cookies = cookie.parse(request.headers.get("cookie") || "");
        const fingerprintToken = new FingerprintToken(
            cookies.fingerprint_token,
            context
        );
        const accessToken = new AccessToken(cookies.access_token, context);
        const user = await accessToken.user(fingerprintToken.value);
        return user;
    };
    return validateRequest;
};
