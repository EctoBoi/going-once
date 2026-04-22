export function roundDownOnePlaceOver(value: number): number {
    if (value <= 0) return 0;
    const abs = Math.abs(value);
    const exp = Math.floor(Math.log10(abs));
    const digits = exp + 1;
    const multiplier = Math.pow(10, digits - 2);
    const rounded = Math.floor(value / multiplier) * multiplier;
    return Math.round(rounded * 100) / 100;
}

export function roundUpOnePlaceOver(value: number): number {
    if (value <= 0) return 0;
    const abs = Math.abs(value);
    const exp = Math.floor(Math.log10(abs));
    const digits = exp + 1;
    const multiplier = Math.pow(10, digits - 2);
    const rounded = Math.ceil(value / multiplier) * multiplier;
    return Math.round(rounded * 100) / 100;
}

export default roundDownOnePlaceOver;

export function formatMoney(value: number): string {
    if (!isFinite(value)) return "0";
    const rounded = Math.round(value * 100) / 100;
    const cents = Math.round(Math.abs(rounded) * 100) % 100;
    if (cents === 0) {
        return new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(rounded);
    }
    return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(rounded);
}
