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

export const consumidor = new Character(
    "consumidor",
    "Consumidor",
    "ciudadano que usa productos de un solo uso a diario",
    "citizen",
    null,
    ["daily-user", "concerned"]
);

export const empresa = new Character(
    "empresa",
    "Empresa",
    "fabricante de productos plásticos de un solo uso",
    "manufacturer",
    null,
    ["profit-driven", "large-scale"]
);

export const oceano = new Location(
    "oceano",
    "Océano",
    "océano asfixiado por residuos plásticos"
);

const ciudadRio = new Location(
    "ciudad-rio",
    "Ciudad-Río",
    "ciudad ribereña donde los residuos desembocan al mar"
);

const costa = new Location(
    "costa",
    "Costa",
    "litoral donde la tierra cede ante la marea de plástico"
);

export const estudioOnu = new Evidence(
    "estudio-onu",
    "Estudio ONU (De Bray, 2026)",
    "estudio de la ONU que alerta sobre la contaminación plástica en los océanos"
);

export const fragmentosPlastico = new Evidence(
    "fragmentos-plastico",
    "Fragmentos de plástico ingeridos",
    "fragmentos de plástico encontrados en el interior de fauna marina"
);

export const redesPesca = new Evidence(
    "redes-pesca",
    "Redes de pesca abandonadas",
    "redes de pesca fantasma que arrastran plástico por los océanos"
);

export const botella = new StoryObject(
    "botella",
    "Botella de un solo uso",
    "botella plástica descartada que tarda siglos en descomponerse"
);

const bolsaPlastica = new StoryObject(
    "bolsa-plastica",
    "Bolsa plástica",
    "bolsa de plástico que vuela de un vertedero al mar"
);

const reducirConsumo = new Action("reducir-consumo", "Reducir consumo", "reducir el consumo de plástico de un solo uso");
const regularProduccion = new Action("regular-produccion", "Regular producción", "regular la fabricación de plásticos desechables");

const availableElements: IStoryElement[] = [
    consumidor,
    empresa,
    oceano,
    ciudadRio,
    costa,
    estudioOnu,
    fragmentosPlastico,
    redesPesca,
    botella,
    bolsaPlastica,
    reducirConsumo,
    regularProduccion,
];

const storyRelationships: Relationship[] = [
    new Relationship(consumidor, "genera_residuo", botella),
    new Relationship(empresa, "genera_residuo", bolsaPlastica),
    new Relationship(ciudadRio, "desplaza_a", oceano),
    new Relationship(fragmentosPlastico, "afecta_a", oceano),
    new Relationship(estudioOnu, "respalda", oceano),
];

const storyRules: Rule[] = [
    new Rule(
        "genera-residuo-rule",
        "Quien genera un residuo lo produce como objeto de consumo.",
        "genera_residuo",
        (source, target) =>
            new Fact(`${source.name} genera ${target.name} como residuo.`, [source, target])
    ),
    new Rule(
        "desplaza-rule",
        "Los residuos se desplazan desde el punto de origen al océano.",
        "desplaza_a",
        (source, target) =>
            new Fact(`${source.name} desplaza residuos hacia ${target.name}.`, [source, target])
    ),
    new Rule(
        "afecta-rule",
        "Los fragmentos de plástico afectan directamente al océano.",
        "afecta_a",
        (source, target) =>
            new Fact(`${source.name} afecta a ${target.name}.`, [source, target])
    ),
    new Rule(
        "respalda-rule",
        "Un estudio respalda una afirmación sobre el océano.",
        "respalda",
        (source, target) =>
            new Fact(`${source.name} respalda la afirmación sobre ${target.name}.`, [source, target])
    ),
];

 const storyConstraints: Constraint[] = [
    new Constraint(
        "evidence-required",
        "evidence",
        "Debe haber evidencia de contaminación plástica presente.",
        {},
        "Hay evidencia de contaminación plástica en la escena.",
        "Falta evidencia de contaminación plástica."
    ),
    new Constraint(
        "relationship",
        "relationship",
        "Debe existir una relación de generación de residuos.",
        { relationshipType: "genera_residuo" },
        "Existe una relación de generación de residuos.",
        "Falta la relación de generación de residuos."
    ),
];

const characters = [consumidor, empresa];

function normalizeSpanish(text: string): string {
    return text
        .toLowerCase()
        .replace(/á/g, "a")
        .replace(/é/g, "e")
        .replace(/í/g, "i")
        .replace(/ó/g, "o")
        .replace(/ú/g, "u")
        .replace(/ñ/g, "n");
}

const oceanDebateGoal = new Goal(
    "ocean-debate-goal",
    "Determinar la postura sobre la contaminación plástica oceánica y si la responsabilidad es compartida.",
    ({ claim, argument, derivedFacts, relationships, scene }) => {
        const failure = {
            resolved: false,
            message:
                "El razonamiento está bien construido, pero el claim no se alinea con la evidencia ni los actores involucrados en la escena.",
        };
        if (claim === null || claim.statement.trim() === "" || argument === null) {
            return failure;
        }
        const text = normalizeSpanish(claim.statement);

        const presentElements = new Set(scene.getElements().map((e) => e.id));
        const presentNames = scene.getElements().map((e) => e.name.toLowerCase());

        const hasEstudioOnu = presentElements.has("estudio-onu");
        const hasConsumidor = presentNames.some((n) => n.includes("consumidor"));
        const hasEmpresa = presentNames.some((n) => n.includes("empresa"));
        const hasBothActors = hasConsumidor && hasEmpresa;
        const hasRespaldoEvidence = hasEstudioOnu;

        const reductionKeywords = [
            "reduc", "preven", "disminu", "cuidar", "proteg", "conserv",
        ];
        const utilityKeywords = [
            "ventaja", "utilid", "benefici", "bajo costo", "barato",
            "medic", "alimentari", "transport", "util",
        ];
        const partialKeywords = [
            "reduc", "responsab", "culpa", "consumidor", "cada uno",
        ];

        const hasReductionKeyword = reductionKeywords.some((kw) => text.includes(kw));
        const hasUtilityKeyword = utilityKeywords.some((kw) => text.includes(kw));
        const hasPartialKeyword = partialKeywords.some((kw) => text.includes(kw));

        if (hasReductionKeyword && hasRespaldoEvidence && hasBothActors) {
            return {
                resolved: true,
                verdictId: "reduccion-prioritaria",
                message:
                    "La reducción es prioritaria, pero la responsabilidad no puede recaer exclusivamente en los consumidores; las empresas también deben participar.",
            };
        }

        if (hasUtilityKeyword && hasRespaldoEvidence) {
            return {
                resolved: true,
                verdictId: "utilidad-plastico",
                message:
                    "La objeción sobre la utilidad del plástico es válida en contextos específicos como lo médico o alimentario, pero no justifica el consumo indiscriminado.",
            };
        }

        if (hasPartialKeyword && hasConsumidor && !hasEmpresa) {
            return {
                resolved: true,
                verdictId: "parcial",
                message:
                    "Esta responsabilidad no puede recaer exclusivamente en los consumidores; las empresas también deben participar.",
            };
        }

        return failure;
    }
);

export const oceanDebateExampleFacts: Fact[] = [
    new Fact("Fragmentos de plástico ingeridos afecta a Océano.", [fragmentosPlastico, oceano]),
    new Fact("Estudio ONU (De Bray, 2026) respalda la afirmación sobre Océano.", [estudioOnu, oceano]),
];

export const oceanDebateExampleArgument: Argument = new Argument(
    "ocean-debate-argument-reduccion",
    { statement: "Debemos reducir los residuos plásticos para proteger el océano." },
    [oceanDebateExampleFacts[0], oceanDebateExampleFacts[1]],
    { statement: "Reducir los residuos plásticos es esencial para proteger el océano." },
    [],
    "possible",
    [oceanDebateExampleFacts[1]]
);

function createScene(): Scene {
    const scene = new Scene();
    scene.place(consumidor, 1);
    scene.place(empresa, 2);
    scene.place(oceano, 3);
    scene.place(estudioOnu, 4);
    scene.place(botella, 5);
    scene.place(fragmentosPlastico, 6);
    return scene;
}

export function createOceanDebateStory(): Story {
    return new Story({
        id: "ocean-debate",
        title: "Los mares no son vertederos",
        context:
            "Los océanos se ahogan en plástico. Un estudio de la ONU (De Bray, 2026) alerta que los residuos plásticos matan fauna marina y penetran en la cadena alimenticia. El Consumidor y la Empresa comparten el escenario en una costa contaminada. ¿Quién asume la responsabilidad?",
        availableElements,
        scene: createScene(),
        relationships: storyRelationships,
        rules: storyRules,
        constraints: storyConstraints,
        goal: oceanDebateGoal,
    });
}
