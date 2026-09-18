import { Story } from "../core/story";
import { Scene } from "../core/scene";
import { Fact } from "../core/fact";
import { Argument } from "../core/argument";
import { GoalVerdict } from "../core/goal";
import { isFactAvailable, ReasoningEvaluation } from "./reasoningCheck";
import { ConstraintCheck } from "./constraintsCheck";

export interface GoalCheckItem {
    readonly label: string;
    readonly ok: boolean;
}

export interface GoalResult {
    readonly resolved: boolean;
    readonly verdictId?: string;
    readonly checks: readonly GoalCheckItem[];
    readonly verdict: string;
    readonly message: string;
}

function normalizeGoalVerdict(raw: GoalVerdict): {
    resolved: boolean;
    verdictId?: string;
    message?: string;
} {
    if (typeof raw === "boolean") {
        return { resolved: raw };
    }
    return raw;
}

export interface GoalCheckInput {
    readonly story: Story;
    readonly scene: Scene;
    readonly derivedFacts: readonly Fact[];
    readonly argument: Argument | null;
    readonly reasoningCheck: ReasoningEvaluation;
    readonly constraintChecks: readonly ConstraintCheck[];
}

export function checkStoryGoal(input: GoalCheckInput): GoalResult {
    const { story, scene, derivedFacts, argument, reasoningCheck, constraintChecks } = input;

    const hasClaim =
        reasoningCheck.claim !== null && reasoningCheck.claim.trim() !== "";
    const dataAvailable = (argument?.data ?? []).every((fact) =>
        isFactAvailable(fact, derivedFacts)
    );
    const constraintsOk = constraintChecks.every((check) => check.satisfied);
    const qualifierOk = reasoningCheck.qualifier !== "unlikely";

    let supported = true;
    let supportedVerdictId: string | undefined;
    let supportedMessage: string | undefined;
    if (story.goal.resolvesWhen !== null) {
        const verdict = normalizeGoalVerdict(
            story.goal.resolvesWhen({
                claim: argument?.claim ?? null,
                argument,
                derivedFacts,
                relationships: story.relationships,
                scene,
            })
        );
        supported = verdict.resolved;
        supportedVerdictId = verdict.verdictId;
        supportedMessage = verdict.message;
    }

    const checks: GoalCheckItem[] = [
        {
            label: "Se construyó una conclusión sobre lo ocurrido.",
            ok: hasClaim,
        },
        {
            label: "La conclusión está respaldada por pruebas.",
            ok: reasoningCheck.dataCount > 0,
        },
        {
            label: "Las pruebas utilizadas están disponibles.",
            ok: dataAvailable,
        },
        {
            label: "Hay una explicación que conecta las pruebas con la conclusión.",
            ok: reasoningCheck.hasWarrant,
        },
        {
            label: "El nivel de certeza no descarta la conclusión.",
            ok: qualifierOk,
        },
        {
            label: "La escena cumple las condiciones de la historia.",
            ok: constraintsOk,
        },
        {
            label: "La conclusión está suficientemente respaldada para resolver la historia.",
            ok: supported,
        },
    ];

    const resolved = checks.every((check) => check.ok);

    let message: string;
    if (resolved) {
        message =
            supportedMessage ??
            "La conclusión está suficientemente respaldada por las pruebas.";
    } else if (!hasClaim) {
        message = "No se formuló una conclusión.";
    } else if (reasoningCheck.dataCount === 0) {
        message = "No hay pruebas suficientes para determinar qué ocurrió.";
    } else if (!supported) {
        message =
            supportedMessage ??
            "El razonamiento está bien construido, pero no hay pruebas suficientes para determinar qué ocurrió.";
    } else if (!constraintsOk) {
        message = "La escena no cumple las condiciones de la historia.";
    } else {
        message =
            "El razonamiento está bien construido, pero no hay pruebas suficientes para determinar qué ocurrió.";
    }

    return {
        resolved,
        verdictId: supportedVerdictId,
        checks,
        verdict: resolved ? "Historia resuelta." : "Historia no resuelta.",
        message,
    };
}