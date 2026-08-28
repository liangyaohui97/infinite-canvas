export function proxyApiUrl(url: string) {
    return `/__api/proxy?url=${encodeURIComponent(url)}`;
}

export function proxyRemoteApiUrl(url: string) {
    return /^https?:/i.test(url) ? proxyApiUrl(url) : url;
}
