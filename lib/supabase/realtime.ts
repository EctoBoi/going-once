export type BroadcastRecord = Record<string, unknown>;

export type BroadcastChange = {
    eventType: string | null;
    record: BroadcastRecord;
    oldRecord: BroadcastRecord;
};

function asRecord(value: unknown): BroadcastRecord {
    return value && typeof value === "object" ? (value as BroadcastRecord) : {};
}

function unwrapPayload(payload: unknown): BroadcastRecord {
    const direct = asRecord(payload);
    const nested = asRecord(direct.payload);

    if (nested.record || nested.old_record || nested.new || nested.old || nested.eventType || nested.operation) {
        return nested;
    }

    return direct;
}

export function extractBroadcastChange(payload: unknown): BroadcastChange {
    const data = unwrapPayload(payload);

    return {
        eventType: typeof data.eventType === "string" ? data.eventType : typeof data.operation === "string" ? data.operation : null,
        record: asRecord(data.record ?? data.new),
        oldRecord: asRecord(data.old_record ?? data.old),
    };
}
