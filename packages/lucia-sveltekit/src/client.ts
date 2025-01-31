import { LuciaError } from "./utils/error.js";
import { Writable } from "svelte/store";

export const signOut = async () => {
    const response = await fetch("/api/auth/logout", {
        method: "POST",
    });
    if (response.ok) return { error: null };
    let result;
    try {
        result = await response.json();
    } catch (e) {
        console.error(e);
        throw new LuciaError("UNKNOWN_ERROR");
    }
    throw new LuciaError(result.message);
};

export const autoRefreshTokens = (
    session: Writable<App.Session>,
    onError: (error: LuciaError) => void
) => {
    let accessToken: string;
    let refreshToken: string;
    const storesUnsubscribe = session.subscribe((val) => {
        if (!val.lucia) return;
        accessToken = val.lucia.access_token;
        refreshToken = val.lucia.refresh_token;
    });
    const interval = setInterval(() => {
        if (!accessToken || !refreshToken) return;
        const tokenData = getJwtPayload(accessToken);
        const currentTime = new Date().getTime();
        if (!tokenData) {
            clearInterval(interval);
            return onError(new LuciaError("AUTH_INVALID_ACCESS_TOKEN"));
        }
        if (!tokenData.exp) {
            clearInterval(interval);
            return onError(new LuciaError("AUTH_INVALID_ACCESS_TOKEN"));
        }
        if (currentTime + 60 * 1000 > tokenData.exp * 1000) {
            refresh();
        }
    }, 5000);
    const refresh = async () => {
        try {
            const result = await refreshTokens(refreshToken);
            refreshToken = result.refresh_token;
            accessToken = result.access_token;
        } catch (e) {
            const error = e as LuciaError;
            return onError(new LuciaError(error.message as any));
        }
        session.update((val) => {
            if (!val.lucia) return val;
            val.lucia.access_token = accessToken;
            val.lucia.refresh_token;
            return val;
        });
    };
    const unsubscribe = () => {
        storesUnsubscribe();
        clearInterval(interval);
    };
    return unsubscribe;
};

const getJwtPayload = (token: string) => {
    return JSON.parse(window.atob(token.split(".")[1]));
};

const refreshTokens = async (refreshToken: string) => {
    const response = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${refreshToken}`,
        },
    });
    if (!response.ok) {
        let result;
        try {
            result = await response.json();
        } catch (e) {
            console.error(e);
            throw new LuciaError("UNKNOWN_ERROR");
        }
        throw new LuciaError(result.message);
    }
    const result = await response.json();
    return {
        refresh_token: result.refresh_token,
        access_token: result.access_token,
    };
};
