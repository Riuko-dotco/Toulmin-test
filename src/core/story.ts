import { IStoryElement } from "./IStoryElement";
import { Scene } from "./scene";
import { Relationship } from "./relationship";
import { Rule } from "./rule";
import { Constraint } from "./constraint";
import { Goal } from "./goal";

export interface StoryConfig {
    id: string;
    title: string;
    context: string;
    availableElements: IStoryElement[];
    scene: Scene;
    relationships?: Relationship[];
    rules?: Rule[];
    constraints?: Constraint[];
    goal: Goal;
}

export class Story {
    readonly id: string;
    readonly title: string;
    readonly context: string;
    readonly availableElements: readonly IStoryElement[];
    readonly scene: Scene;
    readonly relationships: readonly Relationship[];
    readonly rules: readonly Rule[];
    readonly constraints: readonly Constraint[];
    readonly goal: Goal;

    constructor(config: StoryConfig) {
        this.id = config.id;
        this.title = config.title;
        this.context = config.context;
        this.availableElements = config.availableElements;
        this.scene = config.scene;
        this.relationships = config.relationships ?? [];
        this.rules = config.rules ?? [];
        this.constraints = config.constraints ?? [];
        this.goal = config.goal;
    }
}