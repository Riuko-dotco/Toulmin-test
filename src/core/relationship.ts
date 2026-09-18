import { IStoryElement } from "./IStoryElement";

export class Relationship {
    readonly source: IStoryElement;
    readonly type: string;
    readonly target: IStoryElement;

    constructor(source: IStoryElement, type: string, target: IStoryElement) {
        this.source = source;
        this.type = type;
        this.target = target;
    }
}