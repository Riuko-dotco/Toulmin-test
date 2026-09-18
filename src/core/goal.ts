import { Argument } from "./argument";
import { Fact } from "./fact";
import { Proposition } from "./proposition";
import { Relationship } from "./relationship";
import { Scene } from "./scene";

export interface GoalContext {
    readonly claim: Proposition | null;
    readonly argument: Argument | null;
    readonly derivedFacts: readonly Fact[];
    readonly relationships: readonly Relationship[];
    readonly scene: Scene;
}

export type GoalVerdict =
    | boolean
    | { resolved: boolean; verdictId?: string; message?: string };

export type GoalResolver = (context: GoalContext) => GoalVerdict;

export class Goal {
    readonly id: string;
    readonly description: string;
    readonly resolvesWhen: GoalResolver | null;

    constructor(
        id: string,
        description: string,
        resolvesWhen: GoalResolver | null = null
    ) {
        if (!id || id.length === 0) {
            throw new Error("Goal id must not be empty");
        }

        this.id = id;
        this.description = description;
        this.resolvesWhen = resolvesWhen;
    }
}