import { createMysteryStory, mysteryExampleFacts, mysteryExampleArgument } from "./story";
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

const story = createMysteryStory();

const expectedElementIds = [
    "ana",
    "carlos",
    "profesor",
    "salon",
    "pasillo",
    "trofeo",
    "camara",
    "huella",
    "grabacion-camara",
    "entrar",
    "salir",
    "tomar",
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
    if (!element) {
        return false;
    }
    try {
        story.scene.place(element, slot);
        return false;
    } catch (error) {
        return error instanceof RangeError;
    }
}

check(sceneRejectsSlot(7), "la escena rechaza el slot 7 (solo 6 slots)");
check(sceneRejectsSlot(0), "la escena rechaza el slot 0");

const expectedSceneIds = ["ana", "salon", "trofeo", "huella", "camara", "salir"];
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
    mysteryExampleFacts.every(
        (fact) => fact.statement.length > 0 && fact.involvedElements.length > 0
    ),
    "los hechos representan afirmaciones con elementos involucrados"
);

check(Boolean(story.goal), "la historia tiene un Goal");
check(story.constraints.length >= 1, "la historia tiene al menos una Constraint");
check(story.rules.length >= 1, "la historia tiene al menos una Rule");

check(
    mysteryExampleArgument.data.length > 0 &&
        mysteryExampleArgument.data.every(
            (fact) => fact instanceof Fact && fact.statement.length > 0
        ),
    "el Argument puede contener varios Fact como data"
);
check(
    mysteryExampleArgument.warrant !== null &&
        mysteryExampleArgument.warrant.statement.length > 0,
    "el Argument puede tener warrant"
);
check(
    mysteryExampleArgument.backing !== null &&
        Array.isArray(mysteryExampleArgument.backing),
    "el Argument puede tener backing (vacío por defecto)"
);
check(
    mysteryExampleArgument.qualifier !== null &&
        ["certain", "probable", "possible", "unlikely"].includes(
            mysteryExampleArgument.qualifier
        ),
    "el Argument puede tener qualifier"
);
check(
    Array.isArray(mysteryExampleArgument.rebuttal) &&
        mysteryExampleArgument.rebuttal.length > 0,
    "el Argument puede tener rebuttal"
);

const exampleClaim: Proposition = {
    statement: "Ana pudo haber tomado el trofeo.",
};
check(exampleClaim.statement.length > 0, "se puede crear una Proposition");
check(
    mysteryExampleArgument.claim.statement.length > 0,
    "el Argument contiene un claim"
);

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
    derivedFacts.some((fact) => fact.statement === "Ana estuvo en Salón.") &&
        derivedFacts.some((fact) => fact.statement.includes("acceso a Trofeo")),
    "una regla puede producir un hecho a partir de una relación"
);
check(
    derivedFacts.length >= 3,
    "el motor obtiene varios hechos de la escena del caso base"
);

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

const emptyChecks = checkSceneConstraints(
    new Scene(),
    story.relationships,
    story.constraints
);
check(
    emptyChecks.some((check) => !check.satisfied),
    "una condición puede fallar"
);

const incomplete = new Argument("arg-sin-pruebas", {
    statement: "Ana pudo haber tomado el trofeo.",
});
const incompleteEval = evaluateReasoning(incomplete, derivedFacts);
check(
    !incompleteEval.structurallyValid &&
        incompleteEval.checks.some((check) => !check.ok),
    "un razonamiento incompleto es detectado"
);

const fullArgument = new Argument(
    "arg-ana",
    { statement: "Ana pudo haber tomado el trofeo." },
    derivedFacts.filter((fact) => fact.statement.includes("Ana")),
    { statement: "Quien estuvo en el lugar y tenía acceso pudo tomarlo." },
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
    argument: incomplete,
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

const carlosArgument = new Argument(
    "arg-carlos",
    { statement: "Carlos tomó el trofeo." },
    derivedFacts,
    { statement: "Quien estuvo cerca pudo tomarlo." },
    [],
    "possible",
    []
);
const carlosEval = evaluateReasoning(carlosArgument, derivedFacts);
const goalCarlos = checkStoryGoal({
    story,
    scene: story.scene,
    derivedFacts,
    argument: carlosArgument,
    reasoningCheck: carlosEval,
    constraintChecks: baseChecks,
});
check(
    !goalCarlos.resolved && carlosEval.structurallyValid,
    "una conclusión bien construida pero sin pruebas relacionadas no resuelve el objetivo"
);

if (failures > 0) {
    console.error(`${failures} validación(es) fallaron`);
    throw new Error(`Fallaron ${failures} validaciones del caso misterio`);
}

console.log("Toda la validación del caso 'El misterio del robo' pasó.");