import { Scene } from "../core/scene";
import { Constraint, ConstraintKind } from "../core/constraint";
import { Relationship } from "../core/relationship";
import { ReasoningEvaluation } from "./reasoningCheck";

export interface ConstraintCheck {
    readonly constraint: Constraint;
    readonly satisfied: boolean;
    readonly message: string;
}

export interface ConstraintCheckContext {
    readonly reasoningCheck: ReasoningEvaluation | null;
}

const DEFAULT_MESSAGES: Record<ConstraintKind, { met: string; failed: string }> = {
    required: {
        met: "El elemento requerido está presente.",
        failed: "Falta un elemento requerido.",
    },
    forbidden: {
        met: "Los elementos prohibidos están ausentes.",
        failed: "Se encontró un elemento prohibido.",
    },
    order: {
        met: "El orden de los elementos es el correcto.",
        failed: "El orden de los elementos no es el correcto.",
    },
    relationship: {
        met: "Existe la relación requerida.",
        failed: "Falta la relación requerida.",
    },
    evidence: {
        met: "Hay evidencia disponible.",
        failed: "Falta la evidencia necesaria.",
    },
    argument: {
        met: "El razonamiento cumple la condición.",
        failed: "La condición de razonamiento no se cumple.",
    },
    contradiction: {
        met: "No se detectan contradicciones evidentes.",
        failed: "Se detecta una contradicción.",
    },
};

export function checkSceneConstraints(
    scene: Scene,
    relationships: readonly Relationship[],
    constraints: readonly Constraint[],
    context: ConstraintCheckContext = { reasoningCheck: null }
): ConstraintCheck[] {
    const present = new Set(scene.getElements().map((element) => element.id));
    const reasonedValid = context.reasoningCheck?.structurallyValid ?? false;

    return constraints.map((constraint) => {
        const params = constraint.parameters;
        let satisfied = false;

        switch (constraint.kind) {
            case "required":
                satisfied =
                    params.elementId !== undefined &&
                    present.has(params.elementId);
                break;
            case "forbidden":
                satisfied =
                    params.elementId === undefined ||
                    !present.has(params.elementId);
                break;
            case "order":
                if (params.beforeId !== undefined && params.afterId !== undefined) {
                    const elements = scene.getElements();
                    const before = elements.findIndex(
                        (element) => element.id === params.beforeId
                    );
                    const after = elements.findIndex(
                        (element) => element.id === params.afterId
                    );
                    satisfied = before !== -1 && after !== -1 && before < after;
                }
                break;
            case "relationship":
                satisfied = relationships.some(
                    (relationship) =>
                        relationship.type === params.relationshipType &&
                        present.has(relationship.source.id) &&
                        present.has(relationship.target.id) &&
                        (params.sourceId === undefined ||
                            relationship.source.id === params.sourceId) &&
                        (params.targetId === undefined ||
                            relationship.target.id === params.targetId)
                );
                break;
            case "evidence":
                if (params.elementId !== undefined) {
                    satisfied = present.has(params.elementId);
                } else {
                    satisfied = scene
                        .getElements()
                        .some((element) => element.type === "evidence");
                }
                break;
            case "argument":
                satisfied = reasonedValid;
                break;
            case "contradiction":
                satisfied = true;
                break;
        }

        const message = satisfied
            ? (constraint.messageIfMet ?? DEFAULT_MESSAGES[constraint.kind].met)
            : (constraint.messageIfFailed ?? DEFAULT_MESSAGES[constraint.kind].failed);

        return { constraint, satisfied, message };
    });
}