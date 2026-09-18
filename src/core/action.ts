import { IStoryElement, StoryElementTypes } from "./IStoryElement";

export class Action implements IStoryElement {
    readonly id: string;
    readonly type: StoryElementTypes = "action";

    readonly name: string;
    readonly description: string;
    readonly pngUrl: string | null;

    constructor(
        id: string,
        name: string,
        description: string,
        pngUrl: string | null = null
    ) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.pngUrl = pngUrl;
    }
}