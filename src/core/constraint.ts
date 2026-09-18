export type ConstraintKind =
    | "required"
    | "forbidden"
    | "order"
    | "relationship"
    | "evidence"
    | "argument"
    | "contradiction";

export interface ConstraintParameters {
    readonly elementId?: string;
    readonly relationshipType?: string;
    readonly sourceId?: string;
    readonly targetId?: string;
    readonly beforeId?: string;
    readonly afterId?: string;
}

export class Constraint {
    readonly id: string;
    readonly kind: ConstraintKind;
    readonly description: string;
    readonly parameters: ConstraintParameters;
    readonly messageIfMet: string | null;
    readonly messageIfFailed: string | null;

    constructor(
        id: string,
        kind: ConstraintKind,
        description: string,
        parameters: ConstraintParameters = {},
        messageIfMet: string | null = null,
        messageIfFailed: string | null = null
    ) {
        if (!id || id.length === 0) {
            throw new Error("Constraint id must not be empty");
        }

        this.id = id;
        this.kind = kind;
        this.description = description;
        this.parameters = parameters;
        this.messageIfMet = messageIfMet;
        this.messageIfFailed = messageIfFailed;
    }
}