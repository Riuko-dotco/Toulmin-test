import { createMysteryStory } from "./story";
import { Scene } from "../../../core/scene";
import { Fact } from "../../../core/fact";
import { Argument } from "../../../core/argument";
import { Story } from "../../../core/story";
import { Goal } from "../../../core/goal";
import { deriveFacts } from "../../deductions";
import { checkSceneConstraints } from "../../constraintsCheck";
import { evaluateReasoning } from "../../reasoningCheck";
import { checkStoryGoal } from "../../goalCheck";

// Verificación de generalización del motor de escena:
// la misma información y las mismas formas deben obtenerse
// con cualquier personaje/elemento, no solo con Ana.

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
const byId = new Map(story.availableElements.map((element) => [element.id, element]));

function buildScene(ids: string[]): Scene {
    const scene = new Scene();
    ids.forEach((id, index) => {
        const element = byId.get(id);
        if (!element) {
            throw new Error(`Elemento desconocido de la historia: ${id}`);
        }
        scene.place(element, index + 1);
    });
    return scene;
}

function statements(facts: readonly Fact[]): string[] {
    return facts.map((fact) => fact.statement);
}

const ANA_SCENE_IDS = ["ana", "salon", "trofeo", "huella", "camara", "salir"];
const CARLOS_SCENE_IDS = ["carlos", "pasillo", "trofeo", "huella", "salon", "camara"];

// 1. La escena existente con Ana sigue funcionando.
const anaScene = buildScene(ANA_SCENE_IDS);
const anaFacts = deriveFacts(anaScene, story.relationships, story.rules);
check(
    statements(anaFacts).includes("Ana estuvo en Salón."),
    "la escena de Ana deriva sus hechos (caso existente)"
);
const anaChecks = checkSceneConstraints(anaScene, story.relationships, story.constraints);
check(
    anaChecks.length === 3 && anaChecks.every((c) => c.satisfied),
    "la escena de Ana cumple las 3 condiciones"
);

// 2. La escena equivalente con Carlos evalúa toda su información.
const carlosScene = buildScene(CARLOS_SCENE_IDS);
const carlosFacts = deriveFacts(carlosScene, story.relationships, story.rules);
check(
    statements(carlosFacts).includes("Carlos estuvo en Pasillo."),
    "la escena de Carlos deriva el hecho de presencia"
);
check(
    statements(carlosFacts).includes("Cámara registró Pasillo."),
    "la escena de Carlos deriva el hecho de la cámara"
);
check(
    statements(carlosFacts).includes("Huella fue encontrada en Salón."),
    "la escena de Carlos deriva el hecho de la evidencia"
);
check(
    !statements(carlosFacts).some((s) => s.includes("Ana")),
    "la escena de Carlos no filtra información de la escena por defecto"
);
const carlosChecks = checkSceneConstraints(carlosScene, story.relationships, story.constraints);
check(
    carlosChecks.length === 3 && carlosChecks.every((c) => c.satisfied),
    "la escena de Carlos cumple las 3 condiciones"
);
check(
    carlosChecks.map((c) => c.constraint.id).join(",") ===
        anaChecks.map((c) => c.constraint.id).join(","),
    "Ana y Carlos reciben las mismas condiciones en el mismo orden"
);

// 3. Ningún otro elemento de la historia desaparece.
const allIds = story.availableElements.map((element) => element.id);
check(allIds.length === 12, "la historia expone sus 12 elementos");
const firstHalf = buildScene(allIds.slice(0, 6));
const secondHalf = buildScene(allIds.slice(6, 12));
const roundTripped = [...firstHalf.getElements(), ...secondHalf.getElements()].map(
    (element) => element.id
).sort();
check(
    roundTripped.join(",") === [...allIds].sort().join(","),
    "los 12 elementos se colocan y recuperan sin pérdidas"
);
check(
    firstHalf.getElements().every((element, index) => element.id === allIds[index]),
    "cada espacio conserva el elemento colocado"
);

// 4. La validación sigue usando las reglas existentes (hechos con sus elementos por id).
const carlosPresence = carlosFacts.find(
    (fact) => fact.statement === "Carlos estuvo en Pasillo."
);
check(
    carlosPresence !== undefined &&
        carlosPresence.involvedElements.map((element) => element.id).sort().join(",") ===
            "carlos,pasillo",
    "los hechos de Carlos los produce la regla con sus elementos involucrados"
);

// 5. La UI recibe el mismo tipo de información con cualquier personaje.
function shapeOk(facts: readonly Fact[]): boolean {
    return facts.every(
        (fact) =>
            fact.statement.length > 0 &&
            fact.involvedElements.length > 0 &&
            fact.involvedElements.every((element) => element.id.length > 0)
    );
}
check(shapeOk(anaFacts) && shapeOk(carlosFacts), "mismo tipo de hechos con Ana y con Carlos");
const INTERNAL_TOKENS = /trophy-required|found_at|present_at|has_access|records|elementId|relationshipType/;
check(
    [...anaChecks, ...carlosChecks].every(
        (c) => typeof c.satisfied === "boolean" && c.message.length > 0 && !INTERNAL_TOKENS.test(c.message)
    ),
    "los mensajes al jugador no exponen nombres internos"
);

// 6. Paridad de decisión: el objetivo se resuelve igual con Carlos que con Ana.
function resolveFor(name: string, claimText: string, facts: Fact[], scene: Scene): boolean {
    const data = facts.filter((fact) =>
        fact.involvedElements.some((element) => element.id === name)
    );
    const arg = new Argument(
        `arg-${name}`,
        { statement: claimText },
        data,
        { statement: "Quien estuvo en el lugar pudo haber tomado el trofeo." },
        [],
        "possible",
        []
    );
    const reasoning = evaluateReasoning(arg, facts);
    const checks = checkSceneConstraints(scene, story.relationships, story.constraints);
    return checkStoryGoal({
        story,
        scene,
        derivedFacts: facts,
        argument: arg,
        reasoningCheck: reasoning,
        constraintChecks: checks,
    }).resolved;
}
check(
    resolveFor("ana", "Ana pudo haber tomado el trofeo.", anaFacts, anaScene),
    "el objetivo se resuelve con Ana y sus pruebas"
);
check(
    resolveFor("carlos", "Carlos tomó el trofeo.", carlosFacts, carlosScene),
    "el objetivo se resuelve igual con Carlos y sus pruebas"
);

// 7. El GoalContext recibe la escena evaluada (no la escena por defecto).
let capturedScene: Scene | null = null;
const probeStory = new Story({
    id: "probe",
    title: "probe",
    context: "probe",
    availableElements: [],
    scene: new Scene(),
    goal: new Goal("probe-goal", "probe", (context) => {
        capturedScene = context.scene;
        return true;
    }),
});
checkStoryGoal({
    story: probeStory,
    scene: carlosScene,
    derivedFacts: [],
    argument: null,
    reasoningCheck: evaluateReasoning(null, []),
    constraintChecks: [],
});
check(
    capturedScene === carlosScene,
    "el objetivo recibe la escena del jugador, no la escena por defecto"
);

if (failures > 0) {
    console.error(`${failures} validación(es) fallaron`);
    throw new Error(`Fallaron ${failures} validaciones del motor de escena`);
}

console.log("Toda la validación de generalización del motor de escena pasó.");
