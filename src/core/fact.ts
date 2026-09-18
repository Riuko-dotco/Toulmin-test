import { IStoryElement } from "./IStoryElement";

export class Fact {
    readonly statement: string;
    readonly involvedElements: readonly IStoryElement[];

    constructor(
        statement: string,
        involvedElements: readonly IStoryElement[] = []
    ) {
        this.statement = statement;
        this.involvedElements = involvedElements;
    }
}