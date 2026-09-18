import { Fact } from "./fact";
import { Proposition } from "./proposition";

export type ToulminQualifier =
    | "certain"
    | "probable"
    | "possible"
    | "unlikely";

export class Argument {
    readonly id: string;
    readonly claim: Proposition;
    readonly data: readonly Fact[];
    readonly warrant: Proposition | null;
    readonly backing: readonly Fact[];
    readonly qualifier: ToulminQualifier | null;
    readonly rebuttal: readonly Fact[];

    constructor(
        id: string,
        claim: Proposition,
        data: readonly Fact[] = [],
        warrant: Proposition | null = null,
        backing: readonly Fact[] = [],
        qualifier: ToulminQualifier | null = null,
        rebuttal: readonly Fact[] = []
    ) {
        if (!id || id.length === 0) {
            throw new Error("Argument id must not be empty");
        }
        if (!claim) {
            throw new Error("Argument claim is required");
        }

        this.id = id;
        this.claim = claim;
        this.data = data;
        this.warrant = warrant;
        this.backing = backing;
        this.qualifier = qualifier;
        this.rebuttal = rebuttal;
    }
}