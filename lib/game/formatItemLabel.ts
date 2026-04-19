type ItemLabelInput = {
    description?: string | null;
    category?: string | null;
};

export function formatItemLabel({ description, category }: ItemLabelInput) {
    const normalizedDescription = description?.trim();
    const normalizedCategory = category?.trim();

    if (normalizedDescription && normalizedCategory) {
        return `${normalizedDescription} (${normalizedCategory})`;
    }

    return normalizedDescription ?? normalizedCategory ?? "";
}