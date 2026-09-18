import { Argument } from "../core/argument";
import { Fact } from "../core/fact";

export interface ReasoningCheckItem {
    readonly label: string;
    readonly ok: boolean;
}

export interface ReasoningEvaluation {
    readonly structurallyValid: boolean;
    readonly checks: readonly ReasoningCheckItem[];
    readonly claim: string | null;
    readonly dataCount: number;
    readonly hasWarrant: boolean;
    readonly qualifier: string | null;
}

export function factsEqual(a: Fact, b: Fact): boolean {
    if (a.statement !== b.statement) {
        return false;
    }
    const aIds = a.involvedElements.map((element) => element.id).sort().join(",");
    const bIds = b.involvedElements.map((element) => element.id).sort().join(",");
    return aIds === bIds;
}

export function isFactAvailable(fact: Fact, available: readonly Fact[]): boolean {
    return available.some((candidate) => factsEqual(candidate, fact));
}

export function evaluateReasoning(
    argument: Argument | null,
    availableFacts: readonly Fact[]
): ReasoningEvaluation {
    const claim = argument?.claim ?? null;
    const dataCount = argument?.data.length ?? 0;
    const hasWarrant = (argument?.warrant ?? null) !== null;
    const allDataAvailable =
        dataCount > 0 &&
        (argument?.data ?? []).every((fact) => isFactAvailable(fact, availableFacts));

    const checks: ReasoningCheckItem[] = [
        {
            label: "Hay una afirmación sobre lo ocurrido.",
            ok: claim !== null && claim.statement.trim() !== "",
        },
        {
            label: "Hay pruebas que respaldan la afirmación.",
            ok: dataCount > 0,
        },
        {
            label: "Hay una explicación que conecta las pruebas con la afirmación.",
            ok: hasWarrant,
        },
        {
            label: "Las pruebas utilizadas están disponibles.",
            ok: allDataAvailable,
        },
        {
            label: "No se usan pruebas inexistentes.",
            ok: allDataAvailable,
        },
    ];

    return {
        structurallyValid: checks.every((check) => check.ok),
        checks,
        claim: claim?.statement ?? null,
        dataCount,
        hasWarrant,
        qualifier: argument?.qualifier ?? null,
    };
}