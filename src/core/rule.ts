import { IStoryElement, StoryElementTypes } from "./IStoryElement";
import { Fact } from "./fact";

export type FactFactory = (
    source: IStoryElement,
    target: IStoryElement,
    relationshipType: string
) => Fact;

export class Rule {
    readonly id: string;
    readonly description: string;
    readonly relationshipType: string;
    readonly sourceType: StoryElementTypes | null;
    readonly targetType: StoryElementTypes | null;
    readonly produces: FactFactory;

    constructor(
        id: string,
        description: string,
        relationshipType: string,
        produces: FactFactory,
        sourceType: StoryElementTypes | null = null,
        targetType: StoryElementTypes | null = null
    ) {
        if (!id || id.length === 0) {
            throw new Error("Rule id must not be empty");
        }
        if (!relationshipType || relationshipType.length === 0) {
            throw new Error("Rule relationshipType must not be empty");
        }
        if (typeof produces !== "function") {
            throw new Error("Rule produces must be a function");
        }

        this.id = id;
        this.description = description;
        this.relationshipType = relationshipType;
        this.produces = produces;
        this.sourceType = sourceType;
        this.targetType = targetType;
    }
}