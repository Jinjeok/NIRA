export const RUNTIME_CODENAMES = {
    bot: {
        key: 'bot',
        codeName: 'Kan Saete Kuyashiiwa',
        localizedName: '감이 좋아서 분해',
    },
    scheduler: {
        key: 'scheduler',
        codeName: 'MILABO',
        localizedName: null,
    },
    admin: {
        key: 'admin',
        codeName: 'Hanaichi Monnme',
        localizedName: '하나이치몬메',
    },
};

export function runtimeLabel(key) {
    const runtime = RUNTIME_CODENAMES[key];
    if (!runtime) return key;
    return runtime.localizedName
        ? `${runtime.codeName} (${runtime.localizedName})`
        : runtime.codeName;
}
