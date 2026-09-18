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
import { Proposition } from "../../../core/proposition";
import { Argument } from "../../../core/argument";

const ana = new Character(
    "ana",
    "Ana",
    "estudiante de décimo grado",
    "student",
    null,
    ["observant", "curious"]
);

const carlos = new Character(
    "carlos",
    "Carlos",
    "estudiante de décimo grado",
    "student",
    null,
    ["competitive", "nervous"]
);

const profesor = new Character(
    "profesor",
    "Profesor",
    "profesor encargado del salón",
    "teacher",
    null,
    ["responsible"]
);

const salon = new Location(
    "salon",
    "Salón",
    "salón donde estaba guardado el trofeo"
);

const pasillo = new Location(
    "pasillo",
    "Pasillo",
    "pasillo frente al salón"
);

const trofeo = new StoryObject(
    "trofeo",
    "Trofeo",
    "trofeo de la escuela que desapareció"
);

const camara = new StoryObject(
    "camara",
    "Cámara",
    "cámara de seguridad ubicada frente al salón"
);

const huella = new Evidence(
    "huella",
    "Huella",
    "huella encontrada cerca del lugar donde estaba el trofeo"
);

const grabacionCamara = new Evidence(
    "grabacion-camara",
    "Grabación de cámara",
    "grabación de la cámara de seguridad del pasillo"
);

const entrar = new Action("entrar", "Entrar", "entrar al salón");
const salir = new Action("salir", "Salir", "salir del salón");
const tomar = new Action("tomar", "Tomar", "tomar un objeto");

const availableElements: IStoryElement[] = [
    ana,
    carlos,
    profesor,
    salon,
    pasillo,
    trofeo,
    camara,
    huella,
    grabacionCamara,
    entrar,
    salir,
    tomar,
];

const storyRelationships: Relationship[] = [
    new Relationship(ana, "present_at", salon),
    new Relationship(carlos, "present_at", pasillo),
    new Relationship(ana, "has_access", trofeo),
    new Relationship(camara, "records", pasillo),
    new Relationship(huella, "found_at", salon),
];

const storyRules: Rule[] = [
    new Rule(
        "present-at-rule",
        "Quien está presente en un lugar, estuvo en ese lugar.",
        "present_at",
        (source, target) =>
            new Fact(`${source.name} estuvo en ${target.name}.`, [source, target])
    ),
    new Rule(
        "has-access-rule",
        "Quien tiene acceso a un objeto, tuvo acceso a ese objeto.",
        "has_access",
        (source, target) =>
            new Fact(`${source.name} tenía acceso a ${target.name}.`, [source, target])
    ),
    new Rule(
        "found-at-rule",
        "Una evidencia encontrada en un lugar fue hallada allí.",
        "found_at",
        (source, target) =>
            new Fact(`${source.name} fue encontrada en ${target.name}.`, [source, target])
    ),
    new Rule(
        "records-rule",
        "Lo que capta una cámara queda registrado en ella.",
        "records",
        (source, target) =>
            new Fact(`${source.name} registró ${target.name}.`, [source, target])
    ),
];

export const mysteryExampleFacts: Fact[] = [
    new Fact("Ana estuvo en el salón.", [ana, salon]),
    new Fact("Carlos estuvo en el pasillo.", [carlos, pasillo]),
    new Fact("La huella fue encontrada en el salón.", [huella, salon]),
];

const storyConstraints: Constraint[] = [
    new Constraint(
        "trophy-required",
        "required",
        "El trofeo debe estar presente.",
        { elementId: "trofeo" },
        "El trofeo está presente.",
        "Falta el trofeo."
    ),
    new Constraint(
        "evidence-required",
        "evidence",
        "Debe aparecer al menos una evidencia.",
        {},
        "Hay una evidencia disponible.",
        "Falta la evidencia necesaria."
    ),
    new Constraint(
        "evidence-found-at-relation",
        "relationship",
        "Una evidencia debe estar relacionada con un lugar de la escena.",
        { relationshipType: "found_at" },
        "Hay una evidencia relacionada con el salón.",
        "Falta una evidencia relacionada con un lugar."
    ),
];

const characters = [ana, carlos, profesor];

const mysteryGoal = new Goal(
    "mystery-goal",
    "Determinar qué ocurrió con el trofeo y si existe evidencia suficiente para atribuir la acción a un personaje.",
    ({ claim, argument }) => {
        const failure = {
            resolved: false,
            message:
                "El razonamiento está bien construido, pero no hay pruebas suficientes para determinar quién tomó el trofeo.",
        };
        if (claim === null || claim.statement.trim() === "" || argument === null) {
            return failure;
        }
        const text = claim.statement.toLowerCase();
        if (!text.includes("trofeo")) {
            return failure;
        }
        const mentionedCharacters = characters.filter((character) =>
            text.includes(character.name.toLowerCase())
        );
        if (mentionedCharacters.length !== 1) {
            return failure;
        }
        const character = mentionedCharacters[0];
        const supported =
            argument.data.length > 0 &&
            argument.data.some((fact) =>
                fact.involvedElements.some(
                    (element) => element.id === character.id
                )
            );
        return supported ? { resolved: true } : failure;
    }
);

export const mysteryExampleArgument: Argument = new Argument(
    "mystery-argument-ana",
    { statement: "Ana pudo haber tomado el trofeo." },
    [mysteryExampleFacts[0], mysteryExampleFacts[2]],
    { statement: "Una persona que estuvo en el salón pudo haber tomado el trofeo." },
    [],
    "possible",
    [mysteryExampleFacts[1]]
);

function createScene(): Scene {
    const scene = new Scene();
    scene.place(ana, 1);
    scene.place(salon, 2);
    scene.place(trofeo, 3);
    scene.place(huella, 4);
    scene.place(camara, 5);
    scene.place(salir, 6);
    return scene;
}

export function createMysteryStory(): Story {
    return new Story({
        id: "mystery-robo",
        title: "El misterio del robo",
        context:
            "El silencio del salón solo se quiebra por el brillo ausente del trofeo. Alguien lo tomó durante el recreo. Las huellas hablan, la cámara observa, pero la verdad se filtra entre las pistas. ¿Quién lo robó?",
        availableElements,
        scene: createScene(),
        relationships: storyRelationships,
        rules: storyRules,
        constraints: storyConstraints,
        goal: mysteryGoal,
    });
}