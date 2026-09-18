import { IStoryElement, StoryElementTypes } from "../core/IStoryElement";

export class Character implements IStoryElement {
    readonly id: string;
    readonly type: StoryElementTypes = "character";

    readonly name: string;
    readonly description: string;
    readonly pngUrl: string | null;

    // Character-specific data
    readonly role: string;
    readonly traits: string[];

    // Dynamic narrative properties
    readonly properties: Map<string, unknown>;

    constructor(
        id: string,
        name: string,
        description: string,
        role: string,
        pngUrl: string | null = null,
        traits: string[] = [],
        properties: Map<string, unknown> = new Map()
    ) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.pngUrl = pngUrl;

        this.role = role;
        this.traits = traits;
        this.properties = properties;
    }
}