export type StoryElementTypes = "character" | "evidence" | "action" | "location" | "object"; 

export interface IStoryElement {
    readonly id : string;
    readonly type : StoryElementTypes;
    readonly name : string;
    readonly description: string; 
    readonly pngUrl : string | null;
}