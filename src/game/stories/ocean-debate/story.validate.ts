import { createOceanDebateStory, oceanDebateExampleFacts, oceanDebateExampleArgument, consumidor, empresa, oceano, estudioOnu, fragmentosPlastico, botella, redesPesca } from "./story";
import { Evidence } from "../../../core/evidence";
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

const story = createOceanDebateStory();

const expectedElementIds = [
    "consumidor",
    "empresa",
    "oceano",
    "ciudad-rio",
    "costa",
    "estudio-onu",
    "fragmentos-plastico",
    "redes-pesca",
    "botella",
    "bolsa-plastica",
    "reducir-consumo",
    "regular-produccion",
];
const availableIds = story.availableElements.map((element) => element.id);

check(
    story.availableElements.length === expectedElementIds.length,
    "availableElements contiene todos los elementos (12)"
);
check(
    expectedElementIds.every((id) => availableIds.includes(id)),
    "availableElements incluye todos los ids esperados"
);

function sceneRejectsSlot(slot: number): boolean {
    const element = story.scene.get(1);
    if (!element) return false;
    try {
        story.scene.place(element, slot);
        return false;
    } catch (error) {
        return error instanceof RangeError;
    }
}

check(sceneRejectsSlot(7), "la escena rechaza el slot 7 (solo 6 slots)");
check(sceneRejectsSlot(0), "la escena rechaza el slot 0");

const expectedSceneIds = ["consumidor", "empresa", "oceano", "estudio-onu", "botella", "fragmentos-plastico"];
const sceneIds = story.scene.getElements().map((element) => element.id);

check(
    sceneIds.join(",") === expectedSceneIds.join(","),
    "la configuración inicial se colocó correctamente"
);
check(story.scene.isComplete(), "scene.isComplete() devuelve true");
check(sceneIds.length === 6, "getElements() devuelve 6 elementos");

check(
    story.relationships.length >= 1 &&
        story.relationships.every(
            (relationship) =>
                Boolean(relationship.source) &&
                relationship.type.length > 0 &&
                Boolean(relationship.target)
        ),
    "las relaciones se pueden crear y tienen source/type/target"
);

check(
    oceanDebateExampleFacts.every(
        (fact) => fact.statement.length > 0 && fact.involvedElements.length > 0
    ),
    "los hechos representan afirmaciones con elementos involucrados"
);

check(Boolean(story.goal), "la historia tiene un Goal");
check(story.constraints.length >= 1, "la historia tiene al menos una Constraint");
check(story.rules.length >= 1, "la historia tiene al menos una Rule");

check(
    oceanDebateExampleArgument.data.length > 0 &&
        oceanDebateExampleArgument.data.every(
            (fact) => fact instanceof Fact && fact.statement.length > 0
        ),
    "el Argument puede contener varios Fact como data"
);
check(
    oceanDebateExampleArgument.warrant !== null &&
        oceanDebateExampleArgument.warrant.statement.length > 0,
    "el Argument puede tener warrant"
);
check(
    oceanDebateExampleArgument.backing !== null &&
        Array.isArray(oceanDebateExampleArgument.backing),
    "el Argument puede tener backing (vacío por defecto)"
);
check(
    oceanDebateExampleArgument.qualifier !== null &&
        ["certain", "probable", "possible", "unlikely"].includes(
            oceanDebateExampleArgument.qualifier
        ),
    "el Argument puede tener qualifier"
);
check(
    Array.isArray(oceanDebateExampleArgument.rebuttal) &&
        oceanDebateExampleArgument.rebuttal.length > 0,
    "el Argument puede tener rebuttal"
);

const exampleClaim: Proposition = { statement: "Debemos reducir los residuos plásticos para proteger el océano." };
check(exampleClaim.statement.length > 0, "se puede crear una Proposition");
check(oceanDebateExampleArgument.claim.statement.length > 0, "el Argument contiene un claim");

const incompleteArgument = new Argument("arg-incompleto", exampleClaim);
check(
    incompleteArgument.data.length === 0 &&
        incompleteArgument.warrant === null &&
        incompleteArgument.qualifier === null &&
        incompleteArgument.backing.length === 0 &&
        incompleteArgument.rebuttal.length === 0,
    "se puede representar un argumento incompleto (claim sin data/warrant)"
);
check(
    incompleteArgument instanceof Argument,
    "un argumento incompleto puede existir sin ser evaluado"
);

const derivedFacts = deriveFacts(story.scene, story.relationships, story.rules);
check(
    derivedFacts.some((fact) => fact.statement.includes("genera") && fact.statement.includes("como residuo")),
    "una regla genera_residuo produce un hecho a partir de una relación"
);
check(
    derivedFacts.some((fact) => fact.statement.includes("afecta")),
    "una regla afecta_a produce un hecho a partir de una relación"
);
check(
    derivedFacts.some((fact) => fact.statement.includes("respalda")),
    "una regla respalda produce un hecho a partir de una relación"
);
check(derivedFacts.length >= 2, "el motor obtiene varios hechos de la escena del caso base");

const baseChecks = checkSceneConstraints(
    story.scene,
    story.relationships,
    story.constraints
);
check(baseChecks.length >= 1, "las condiciones de la historia están definidas");
check(
    baseChecks.every((check) => check.satisfied),
    "una condición se cumple en la escena base"
);

const emptyScene = new Scene();
const emptyChecks = checkSceneConstraints(
    emptyScene,
    story.relationships,
    story.constraints
);
check(
    emptyChecks.some((check) => !check.satisfied),
    "una condición puede fallar"
);

const incompleteEval = evaluateReasoning(incompleteArgument, derivedFacts);
check(
    !incompleteEval.structurallyValid,
    "un razonamiento incompleto es detectado"
);

const fullArgument = new Argument(
    "arg-ocean",
    { statement: "Debemos reducir los residuos plásticos para proteger el océano." },
    [oceanDebateExampleFacts[0], oceanDebateExampleFacts[1]],
    { statement: "Reducir los residuos plásticos es esencial para proteger el océano." },
    [],
    "possible",
    []
);
const fullEval = evaluateReasoning(fullArgument, derivedFacts);
check(
    fullEval.structurallyValid,
    "un razonamiento con pruebas válidas se acepta estructuralmente"
);

const goalWithoutData = checkStoryGoal({
    story,
    scene: story.scene,
    derivedFacts,
    argument: incompleteArgument,
    reasoningCheck: incompleteEval,
    constraintChecks: baseChecks,
});
check(
    !goalWithoutData.resolved,
    "una conclusión sin pruebas suficientes no resuelve la historia"
);

const goalResolved = checkStoryGoal({
    story,
    scene: story.scene,
    derivedFacts,
    argument: fullArgument,
    reasoningCheck: fullEval,
    constraintChecks: baseChecks,
});
check(goalResolved.resolved, "el objetivo se cumple con suficiente soporte");
check(
    goalResolved.verdictId === "reduccion-prioritaria",
    "el objetivo con reducción clasifica como reduccion-prioritaria"
);

// ── Test 2: utilidad-plastico ──
const utilityClaim: Proposition = { statement: "El plástico es útil en medicina y transporte, pero debemos gestionar mejor los residuos." };
const utilityArgument = new Argument(
    "arg-utilidad",
    utilityClaim,
    [oceanDebateExampleFacts[0], oceanDebateExampleFacts[1]],
    { statement: "El plástico tiene utilidad en contextos específicos." },
    [],
    "possible",
    []
);
const utilityEval = evaluateReasoning(utilityArgument, derivedFacts);
const utilityGoal = checkStoryGoal({
    story,
    scene: story.scene,
    derivedFacts,
    argument: utilityArgument,
    reasoningCheck: utilityEval,
    constraintChecks: baseChecks,
});
check(utilityGoal.resolved, "la utilidad del plástico resuelve el objetivo");
check(
    utilityGoal.verdictId === "utilidad-plastico",
    "el claim con utilidad clasifica como utilidad-plastico"
);

// ── Test 3: parcial (sin Empresa en escena) ──
const sceneWithoutEmpresa = new Scene();
sceneWithoutEmpresa.place(consumidor, 1);
sceneWithoutEmpresa.place(redesPesca, 2);
sceneWithoutEmpresa.place(oceano, 3);
sceneWithoutEmpresa.place(estudioOnu, 4);
sceneWithoutEmpresa.place(botella, 5);
sceneWithoutEmpresa.place(fragmentosPlastico, 6);
const partialClaim: Proposition = { statement: "El consumidor debe asumir la responsabilidad y cada uno debe hacer su parte para reducir los residuos." };
const partialArgument = new Argument(
    "arg-parcial",
    partialClaim,
    [oceanDebateExampleFacts[0], oceanDebateExampleFacts[1]],
    { statement: "Los consumidores deben reducir su impacto." },
    [],
    "possible",
    []
);
const partialEval = evaluateReasoning(partialArgument, derivedFacts);
const partialChecks = checkSceneConstraints(
    sceneWithoutEmpresa,
    story.relationships,
    story.constraints,
    { reasoningCheck: partialEval }
);
const partialGoal = checkStoryGoal({
    story,
    scene: sceneWithoutEmpresa,
    derivedFacts,
    argument: partialArgument,
    reasoningCheck: partialEval,
    constraintChecks: partialChecks,
});
check(partialGoal.resolved, "la postura parcial resuelve el objetivo");
check(partialGoal.verdictId === "parcial", "el claim solo de consumidor clasifica como parcial");
check(
    partialGoal.message.includes("no puede recaer exclusivamente"),
    "el mensaje de parcial explica que la responsabilidad no es solo del consumidor"
);

// ── Test 4: default (sin palabras clave) ──
const neutralClaim: Proposition = { statement: "Hoy hace un lindo día en la playa." };
const neutralArgument = new Argument(
    "arg-neutral",
    neutralClaim,
    [oceanDebateExampleFacts[0], oceanDebateExampleFacts[1]],
    { statement: "El clima es agradable." },
    [],
    "possible",
    []
);
const neutralEval = evaluateReasoning(neutralArgument, derivedFacts);
const neutralGoal = checkStoryGoal({
    story,
    scene: story.scene,
    derivedFacts,
    argument: neutralArgument,
    reasoningCheck: neutralEval,
    constraintChecks: baseChecks,
});
check(!neutralGoal.resolved, "un claim sin palabras clave no resuelve la historia");
check(
    neutralGoal.verdictId === undefined,
    "un claim sin palabras clave no asigna ningún verdictId"
);

// ── Test 5: raíz sin tilde — "Reduccion de plasticos" ──
const rootClaim: Proposition = { statement: "Reduccion de plasticos" };
const rootArgument = new Argument(
    "arg-raiz",
    rootClaim,
    [oceanDebateExampleFacts[0], oceanDebateExampleFacts[1]],
    { statement: "La reducción de plásticos es prioritaria." },
    [],
    "possible",
    []
);
const rootEval = evaluateReasoning(rootArgument, derivedFacts);
const rootGoal = checkStoryGoal({
    story,
    scene: story.scene,
    derivedFacts,
    argument: rootArgument,
    reasoningCheck: rootEval,
    constraintChecks: baseChecks,
});
check(rootGoal.resolved, "el claim 'Reduccion de plasticos' resuelve el objetivo");
check(
    rootGoal.verdictId === "reduccion-prioritaria",
    "la raíz 'reduc' clasifica como reduccion-prioritaria sin tilde"
);

if (failures > 0) {
    console.error(`${failures} validación(es) fallaron`);
    throw new Error(`Fallaron ${failures} validaciones del caso ocean-debate`);
}

console.log("Toda la validación del caso 'Los mares no son vertederos' pasó.");
