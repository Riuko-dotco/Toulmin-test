import { Character } from "../../../core/character";
import { Action } from "../../../core/action";
import { Evidence } from "../../../core/evidence";
import { Location } from "../../../core/location";
import { StoryObject } from "../../../core/storyObject";
import { Scene } from "../../../core/scene";
import { Story } from "../../../core/story";
import { Relationship } from "../../../core/relationship";
import { Rule } from "../../../core/rule";
import { Fact } from "../../../core/fact";
import { Constraint } from "../../../core/constraint";
import { Goal } from "../../../core/goal";
import { IStoryElement } from "../../../core/IStoryElement";
import { Argument } from "../../../core/argument";

// ── Personajes: tono neutral y amable ──
const explorador = new Character(
    "explorador",
    "Explorador",
    "estudiante curioso que organiza la búsqueda en el patio",
    "student",
    null,
    ["curious", "kind"]
);

const ayudante = new Character(
    "ayudante",
    "Ayudante",
    "compañera amable que ayuda a buscar por el jardín",
    "student",
    null,
    ["helpful", "patient"]
);

// ── Lugares ──
const patio = new Location(
    "patio",
    "Patio",
    "patio de la escuela donde se perdió algo"
);

const jardin = new Location(
    "jardin",
    "Jardín",
    "jardín tranquilo junto al patio"
);

const casa = new Location(
    "casa",
    "Casa",
    "casita del patio donde se guardan los juegos"
);

// ── Evidencias ──
const pista = new Evidence(
    "pista",
    "Pista",
    "nota amable con una pista sobre lo perdido"
);

const mapa = new Evidence(
    "mapa",
    "Mapa",
    "mapa dibujado a mano del patio y el jardín"
);

// ── Objetos ──
const llavePerdida = new StoryObject(
    "llave-perdida",
    "Llave perdida",
    "llave pequeña que se perdió en el patio"
);

const caja = new StoryObject(
    "caja",
    "Caja",
    "caja de juegos donde suelen guardarse las cosas"
);

// ── Acciones (ids canónicos: el modal de UI los reconoce) ──
const entrar = new Action("entrar", "Entrar", "entrar a un lugar");
const salir = new Action("salir", "Salir", "salir de un lugar");
const tomar = new Action("tomar", "Tomar", "tomar un objeto");

const availableElements: IStoryElement[] = [
    explorador,
    ayudante,
    patio,
    jardin,
    casa,
    pista,
    mapa,
    llavePerdida,
    caja,
    entrar,
    salir,
    tomar,
];

const storyRelationships: Relationship[] = [
    new Relationship(explorador, "presente_en", patio),
    new Relationship(ayudante, "presente_en", jardin),
    new Relationship(llavePerdida, "encontrado_en", caja),
];

const storyRules: Rule[] = [
    new Rule(
        "presente-en-rule",
        "Quien está presente en un lugar, estuvo en ese lugar.",
        "presente_en",
        (source, target) =>
            new Fact(`${source.name} está en ${target.name}.`, [source, target])
    ),
    new Rule(
        "encontrado-en-rule",
        "Lo que se encuentra en un lugar, fue hallado allí.",
        "encontrado_en",
        (source, target) =>
            new Fact(`${source.name} se encontró en ${target.name}.`, [source, target])
    ),
];

export const tutorialExampleFacts: Fact[] = [
    new Fact("Explorador está en Patio.", [explorador, patio]),
    new Fact("Llave perdida se encontró en Caja.", [llavePerdida, caja]),
];

const storyConstraints: Constraint[] = [
    new Constraint(
        "evidence-required",
        "evidence",
        "Debe haber al menos una evidencia (Pista o Mapa) en la escena.",
        {},
        "Hay una evidencia en la escena. ¡Buen trabajo!",
        "Agrega la Pista o el Mapa a la escena para continuar."
    ),
];

// Intencionalmente permisivo: es un ejercicio guiado, no un caso real.
// Resuelve con cualquier conclusión no vacía respaldada por ≥1 dato.
const tutorialGoal = new Goal(
    "tutorial-guide-goal",
    "Practicar cada mecánica: armar la escena, derivar hechos y construir una conclusión respaldada por evidencia.",
    ({ claim, argument }) => {
        if (
            claim !== null &&
            claim.statement.trim() !== "" &&
            argument !== null &&
            argument.data.length > 0
        ) {
            return {
                resolved: true,
                message:
                    "¡Felicidades! Has construido una conclusión respaldada por evidencia.",
            };
        }
        return {
            resolved: false,
            message:
                "¡Buen intento! Escribe una conclusión y elige al menos una prueba para completar la práctica.",
        };
    }
);

export const tutorialExampleArgument: Argument = new Argument(
    "tutorial-argument-ejemplo",
    { statement: "La llave perdida está en la caja del patio." },
    [tutorialExampleFacts[0], tutorialExampleFacts[1]],
    { statement: "Las pistas de la escena muestran dónde buscar." },
    [],
    "possible",
    []
);

function createScene(): Scene {
    const scene = new Scene();
    scene.place(explorador, 1);
    scene.place(patio, 2);
    scene.place(pista, 3);
    scene.place(llavePerdida, 4);
    scene.place(caja, 5);
    scene.place(entrar, 6);
    return scene;
}

export function createTutorialGuideStory(): Story {
    return new Story({
        id: "tutorial-guide",
        title: "Guía de práctica: lo perdido en el patio",
        context:
            "Se perdió algo en el patio de la escuela y nadie está en problemas: es solo una práctica. Arma la escena, prueba las acciones Entrar, Salir y Tomar, comprueba la escena y construye tu primera conclusión con pruebas. Aquí no se puede perder.",
        availableElements,
        scene: createScene(),
        relationships: storyRelationships,
        rules: storyRules,
        constraints: storyConstraints,
        goal: tutorialGoal,
    });
}
