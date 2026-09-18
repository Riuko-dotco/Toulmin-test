import { createTutorialGuideStory, tutorialExampleFacts, tutorialExampleArgument } from "./story";
import { Proposition } from "../../../core/proposition";
import { Argument } from "../../../core/argument";
import { Fact } from "../../../core/fact";
import { Scene } from "../../../core/scene";
import { deriveFacts } from "../../deductions";
import { checkSceneConstraints } from "../../constraintsCheck";
import { evaluateReasoning } from "../../reasoningCheck";
import { checkStoryGoal } from "../../goalCheck";

let failures = 0;

function check(condition: boolean, label: string): void {
    if (condition) {
        console.log(`[ok]   ${label}`);
    } else {
        failures += 1;
        console.error(`[FAIL] ${label}`);
    }
}

const story = createTutorialGuideStory();

const expectedElementIds = [
    "explorador",
    "ayudante",
    "patio",
    "jardin",
    "casa",
    "pista",
    "mapa",
    "llave-perdida",
    "caja",
    "entrar",
    "salir",
    "tomar",
];
const availableIds = story.availableElements.map((element) => element.id);

check(
    story.availableElements.length === 12,
    "availableElements contiene todos los elementos (12)"
);
check(
    expectedElementIds.every((id) => availableIds.includes(id)),
    "availableElements incluye todos los ids esperados"
);

// Conteo por tipo: 2 character, 3 location, 2 evidence, 2 object, 3 action
const byType = (type: string): number =>
    story.availableElements.filter((element) => element.type === type).length;
check(byType("character") === 2, "hay 2 character (Explorador, Ayudante)");
check(byType("location") === 3, "hay 3 location (Patio, Jardín, Casa)");
check(byType("evidence") === 2, "hay 2 evidence (Pista, Mapa)");
check(byType("object") === 2, "hay 2 object (Llave perdida, Caja)");
check(byType("action") === 3, "hay 3 action (Entrar, Salir, Tomar)");

const expectedSceneIds = ["explorador", "patio", "pista", "llave-perdida", "caja", "entrar"];
const sceneIds = story.scene.getElements().map((element) => element.id);

check(
    sceneIds.join(",") === expectedSceneIds.join(","),
    "la configuración inicial se colocó correctamente"
);
check(story.scene.isComplete(), "scene.isComplete() devuelve true");
check(sceneIds.length === 6, "getElements() devuelve 6 elementos");

// La escena base deja objetivos para el modal de acciones:
// Patio (location → Entrar/Salir) + Pista/Llave/Caja (evidence/object → Tomar)
const sceneTypes = new Set(story.scene.getElements().map((element) => element.type));
check(
    sceneTypes.has("location") &&
        (sceneTypes.has("object") || sceneTypes.has("evidence")),
    "la escena base tiene objetivos para Entrar/Salir (location) y Tomar (object/evidence)"
);

check(
    story.relationships.length >= 2 &&
        story.relationships.every(
            (relationship) =>
                Boolean(relationship.source) &&
                relationship.type.length > 0 &&
                Boolean(relationship.target)
        ),
    "las relaciones existen (al menos 2) y tienen source/type/target"
);

check(
    tutorialExampleFacts.every(
        (fact) => fact.statement.length > 0 && fact.involvedElements.length > 0
    ),
    "los hechos de ejemplo representan afirmaciones con elementos involucrados"
);

check(Boolean(story.goal), "la historia tiene un Goal");
check(story.constraints.length === 1, "la historia tiene exactamente 1 Constraint");
check(story.rules.length >= 2, "la historia tiene al menos 2 Rules");

check(
    tutorialExampleArgument.data.length > 0 &&
        tutorialExampleArgument.data.every(
            (fact) => fact instanceof Fact && fact.statement.length > 0
        ),
    "el Argument de ejemplo contiene Facts como data"
);

const derivedFacts = deriveFacts(story.scene, story.relationships, story.rules);
check(
    derivedFacts.some((fact) => fact.statement === "Explorador está en Patio."),
    "presente_en deriva: Explorador está en Patio."
);
check(
    derivedFacts.some((fact) => fact.statement === "Llave perdida se encontró en Caja."),
    "encontrado_en deriva: Llave perdida se encontró en Caja."
);
check(
    derivedFacts.length >= 2,
    "el motor deriva al menos 2 Facts distintos en la escena base"
);

const baseChecks = checkSceneConstraints(
    story.scene,
    story.relationships,
    story.constraints
);
check(baseChecks.length === 1, "hay exactamente 1 condición definida");
check(
    baseChecks.every((check) => check.satisfied),
    "el constraint pasa en la escena base (COMPROBAR ESCENA sin fricción)"
);

const emptyChecks = checkSceneConstraints(
    new Scene(),
    story.relationships,
    story.constraints
);
check(
    emptyChecks.some((check) => !check.satisfied),
    "el constraint puede fallar en una escena vacía"
);

// ── Goal permisivo: resolver directo del resolver ──
const simpleClaim: Proposition = { statement: "La llave está en la caja." };
const simpleArgument = new Argument("arg-simple", simpleClaim, [derivedFacts[0]]);
const directOk = story.goal.resolvesWhen?.({
    claim: simpleClaim,
    argument: simpleArgument,
    derivedFacts,
    relationships: story.relationships,
    scene: story.scene,
});
check(
    typeof directOk === "object" && directOk !== null && (directOk as { resolved: boolean }).resolved === true,
    "un claim simple no vacío con al menos 1 dato resuelve (resolved: true)"
);

const emptyClaimArg = new Argument("arg-vacio", { statement: "   " }, [derivedFacts[0]]);
const directEmpty = story.goal.resolvesWhen?.({
    claim: emptyClaimArg.claim,
    argument: emptyClaimArg,
    derivedFacts,
    relationships: story.relationships,
    scene: story.scene,
});
check(
    typeof directEmpty === "object" && directEmpty !== null && (directEmpty as { resolved: boolean }).resolved === false,
    "un claim vacío no resuelve (resolved: false, mensaje amable)"
);

const noDataArg = new Argument("arg-sin-datos", { statement: "La llave está en la caja." });
const directNoData = story.goal.resolvesWhen?.({
    claim: noDataArg.claim,
    argument: noDataArg,
    derivedFacts,
    relationships: story.relationships,
    scene: story.scene,
});
check(
    typeof directNoData === "object" && directNoData !== null && (directNoData as { resolved: boolean }).resolved === false,
    "un claim sin datos no resuelve (resolved: false, mensaje amable)"
);

// ── Goal permisivo de punta a punta (checkStoryGoal) ──
const fullArgument = new Argument(
    "arg-tutorial-completo",
    { statement: "La llave perdida está en la caja del patio." },
    [derivedFacts[0]],
    { statement: "Las pistas de la escena muestran dónde buscar." },
    [],
    "possible",
    []
);
const fullEval = evaluateReasoning(fullArgument, derivedFacts);
check(
    fullEval.structurallyValid,
    "un razonamiento tutorial completo es estructuralmente válido"
);
const goalResolved = checkStoryGoal({
    story,
    scene: story.scene,
    derivedFacts,
    argument: fullArgument,
    reasoningCheck: fullEval,
    constraintChecks: baseChecks,
});
check(goalResolved.resolved, "el objetivo tutorial se cumple con claim + 1 dato");

if (failures > 0) {
    console.error(`${failures} validación(es) fallaron`);
    throw new Error(`Fallaron ${failures} validaciones del caso tutorial-guide`);
}

console.log("Toda la validación del caso 'Guía de práctica' pasó.");
