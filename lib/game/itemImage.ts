export function getItemImageSrc(itemName: string) {
    return `/items/${encodeURIComponent(itemName)}.jpg`;
}
