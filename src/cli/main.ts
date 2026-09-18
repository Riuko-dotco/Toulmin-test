import { createInterface } from "node:readline";
import { stdin as input, stdout as output } from "node:process";

import { createMysteryStory } from "../game/stories/mystery/story";
import { deriveFacts } from "../game/deductions";
import { checkSceneConstraints } from "../game/constraintsCheck";
import { evaluateReasoning } from "../game/reasoningCheck";
import { checkStoryGoal } from "../game/goalCheck";

import { Scene } from "../core/scene";
import { Fact } from "../core/fact";
import { Proposition } from "../core/proposition";
import { Argument, ToulminQualifier } from "../core/argument";
import { IStoryElement } from "../core/IStoryElement";
import { Relationship } from "../core/relationship";
import { Story } from "../core/story";

const rl = createInterface({ input, output });

const queuedLines: string[] = [];
const pendingResolvers: ((line: string) => void)[] = [];
let closed = false;

rl.on("line", (line) => {
    const resolver = pendingResolvers.shift();
    if (resolver) {
        resolver(line);
    } else {
        queuedLines.push(line);
    }
});

rl.on("close", () => {
    closed = true;
    for (const resolver of pendingResolvers) {
        resolver("");
    }
    pendingResolvers.length = 0;
});

function question(promptText: string): Promise<string> {
    output.write(`${promptText}\n> `);
    const queued = queuedLines.shift();
    if (queued !== undefined) {
        return Promise.resolve(queued);
    }
    if (closed) {
        return Promise.resolve("");
    }
    return new Promise((resolve) => pendingResolvers.push(resolve));
}

const LINE = "=".repeat(44);

function header(title: string): void {
    console.log(`\n${LINE}\n        ${title.toUpperCase()}\n${LINE}`);
}

function subheader(title: string): void {
    console.log(`\n${title.toUpperCase()}\n${"-".repeat(30)}`);
}

async function ask(promptText: string): Promise<string> {
    return (await question(promptText)).trim();
}

function throwIfClosed(): void {
    if (closed) {
        throw new Error("Fin de la entrada: no hay más líneas disponibles.");
    }
}

const QUALIFIER_LABELS: Record<ToulminQualifier, string> = {
    certain: "Cierto",
    probable: "Probable",
    possible: "Posible",
    unlikely: "Poco probable",
};

function certaintyLabel(qualifier: ToulminQualifier | null): string {
    return qualifier === null ? "Sin indicar" : QUALIFIER_LABELS[qualifier];
}

function showStory(story: Story): void {
    header(story.title);
    console.log(`\n${story.context}`);
    console.log("\nDebes construir una escena utilizando 6 elementos.");
}

function showAvailableElements(elements: readonly IStoryElement[]): void {
    header("ELEMENTOS DISPONIBLES");
    elements.forEach((element, index) => {
        console.log(` ${index + 1}. ${element.name}`);
    });
}

async function selectSceneElements(story: Story): Promise<Scene> {
    header("SELECCIONAR ELEMENTOS");
    const elements = story.availableElements;
    const scene = new Scene();
    const selected = new Set<string>();
    let slot = 1;

    while (slot <= 6) {
        const line = await ask(
            `Elige el elemento para la casilla ${slot} (número del 1 al ${elements.length}):`
        );
        throwIfClosed();
        if (!/^\d+$/.test(line)) {
            console.log(`Entrada no válida. Introduce un número del 1 al ${elements.length}.`);
            continue;
        }
        const option = Number(line);
        if (option < 1 || option > elements.length) {
            console.log("Entrada no válida. Selecciona un elemento de la lista.");
            continue;
        }
        const element = elements[option - 1];
        if (selected.has(element.id)) {
            console.log("Ese elemento ya fue seleccionado. Elige otro.");
            continue;
        }
        scene.place(element, slot);
        selected.add(element.id);
        slot += 1;
    }

    return scene;
}

function showScene(scene: Scene): void {
    header("ESCENA");
    scene.getElements().forEach((element, index) => {
        console.log(`[${index + 1}] ${element.name}`);
    });
}

function showRelationships(relationships: readonly Relationship[]): void {
    header("RELACIONES");
    relationships.forEach(({ source, type, target }) => {
        console.log(`${source.name} → ${type} → ${target.name}`);
    });
}

function showDerivedFacts(facts: readonly Fact[]): void {
    header("LO QUE SE SABE");
    if (facts.length === 0) {
        console.log("Aún no hay información suficiente en la escena.");
        return;
    }
    facts.forEach((fact) => {
        console.log(`✓ ${fact.statement}`);
    });
}

function showFacts(facts: readonly Fact[]): void {
    if (facts.length === 0) {
        console.log("(No hay información disponible)");
        return;
    }
    facts.forEach((fact, index) => {
        console.log(`${index + 1}. ${fact.statement}`);
    });
}

function parseSelection(line: string, max: number): number[] | null {
    const indices: number[] = [];
    for (const token of line.split(/[\s,]+/)) {
        if (!/^\d+$/.test(token)) {
            return null;
        }
        const option = Number(token);
        if (option < 1 || option > max || indices.includes(option)) {
            return null;
        }
        indices.push(option);
    }
    return indices.length > 0 ? indices : null;
}

async function selectFactsSection(
    title: string,
    instruction: string,
    facts: readonly Fact[]
): Promise<Fact[]> {
    subheader(title);
    console.log(instruction);
    showFacts(facts);

    while (true) {
        const line = await ask(
            "Escribe los números separados por espacio, o vacío para ninguno:"
        );
        throwIfClosed();
        if (line === "") {
            return [];
        }
        const indices = parseSelection(line, facts.length);
        if (indices === null) {
            console.log("Entrada no válida. Elige números de la lista.");
            continue;
        }
        return indices.map((index) => facts[index - 1]);
    }
}

const CERTAINTY_OPTIONS: readonly (ToulminQualifier | null)[] = [
    "certain",
    "probable",
    "possible",
    "unlikely",
    null,
];

async function selectCertainty(): Promise<ToulminQualifier | null> {
    subheader("NIVEL DE CERTEZA");
    CERTAINTY_OPTIONS.forEach((qualifier, index) => {
        console.log(`${index + 1}. ${certaintyLabel(qualifier)}`);
    });

    while (true) {
        const line = await ask("¿Qué tan segura es tu conclusión?");
        throwIfClosed();
        if (!/^\d+$/.test(line)) {
            console.log(`Entrada no válida. Elige una opción del 1 al ${CERTAINTY_OPTIONS.length}.`);
            continue;
        }
        const option = Number(line);
        if (option < 1 || option > CERTAINTY_OPTIONS.length) {
            console.log(`Entrada no válida. Elige una opción del 1 al ${CERTAINTY_OPTIONS.length}.`);
            continue;
        }
        return CERTAINTY_OPTIONS[option - 1];
    }
}

async function buildArgument(facts: readonly Fact[]): Promise<Argument> {
    header("CONSTRUIR RAZONAMIENTO");

    let claimText = "";
    subheader("¿QUÉ OCURRIÓ?");
    while (claimText === "") {
        claimText = await ask("Escribe tu conclusión en una frase (obligatorio):");
        if (closed && claimText === "") {
            throw new Error("stdin cerrado: no se pudo leer la conclusión.");
        }
        if (claimText === "") {
            console.log("La conclusión no puede estar vacía.");
        }
    }
    const claim: Proposition = { statement: claimText };

    const data = await selectFactsSection(
        "PRUEBAS",
        "Selecciona la información que respalda tu conclusión. Puedes dejarlo vacío.",
        facts
    );

    subheader("EXPLICACIÓN");
    const warrantText = await ask(
        "¿Qué conecta esas pruebas con tu conclusión? (vacío para omitir):"
    );
    const warrant: Proposition | null =
        warrantText === "" ? null : { statement: warrantText };

    const backing = await selectFactsSection(
        "FUNDAMENTO",
        "Selecciona información que respalde tu explicación. Puedes dejarlo vacío.",
        facts
    );

    const qualifier = await selectCertainty();

    const rebuttal = await selectFactsSection(
        "OBJECIONES",
        "Selecciona información que pueda debilitar tu conclusión. Puedes dejarlo vacío.",
        facts
    );

    return new Argument(
        "cli-argument",
        claim,
        data,
        warrant,
        backing,
        qualifier,
        rebuttal
    );
}

function showArgument(argument: Argument): void {
    subheader("TU RAZONAMIENTO");
    console.log(`Conclusión:\n${argument.claim.statement}`);

    console.log("\nPruebas:");
    if (argument.data.length === 0) {
        console.log("- (ninguna)");
    }
    argument.data.forEach((fact) => console.log(`- ${fact.statement}`));

    console.log("\nExplicación:");
    console.log(argument.warrant?.statement ?? "- (sin explicación)");

    console.log("\nFundamento:");
    if (argument.backing.length === 0) {
        console.log("- (ninguno)");
    }
    argument.backing.forEach((fact) => console.log(`- ${fact.statement}`));

    console.log(`\nNivel de certeza:\n${certaintyLabel(argument.qualifier)}`);

    console.log("\nObjeciones:");
    if (argument.rebuttal.length === 0) {
        console.log("- (ninguna)");
    }
    argument.rebuttal.forEach((fact) => console.log(`- ${fact.statement}`));
}

function showConstraintChecks(checks: readonly { satisfied: boolean; message: string }[]): void {
    header("COMPROBAR ESCENA");
    checks.forEach((check) => {
        console.log(`${check.satisfied ? "✓" : "✗"} ${check.message}`);
    });
}

function showReasoningCheck(checks: readonly { ok: boolean; label: string }[]): void {
    header("COMPROBAR RAZONAMIENTO");
    checks.forEach((check) => {
        console.log(`${check.ok ? "✓" : "✗"} ${check.label}`);
    });
}

function showGoalCheck(
    checks: readonly { ok: boolean; label: string }[],
    verdict: string
): void {
    header("COMPROBAR OBJETIVO");
    checks.forEach((check) => {
        console.log(`${check.ok ? "✓" : "✗"} ${check.label}`);
    });
    console.log(`\n${verdict}`);
}

async function main(): Promise<void> {
    const story = createMysteryStory();

    showStory(story);
    showAvailableElements(story.availableElements);

    const scene = await selectSceneElements(story);
    showScene(scene);
    showRelationships(story.relationships);

    const derivedFacts = deriveFacts(scene, story.relationships, story.rules);
    showDerivedFacts(derivedFacts);

    const argument = await buildArgument(derivedFacts);
    showArgument(argument);

    const reasoningCheck = evaluateReasoning(argument, derivedFacts);
    showReasoningCheck(reasoningCheck.checks);

    const constraintChecks = checkSceneConstraints(
        scene,
        story.relationships,
        story.constraints,
        { reasoningCheck }
    );
    showConstraintChecks(constraintChecks);

    const goalResult = checkStoryGoal({
        story,
        scene,
        derivedFacts,
        argument,
        reasoningCheck,
        constraintChecks,
    });
    showGoalCheck(goalResult.checks, goalResult.verdict);

    header("RESULTADO");
    console.log(`\nConclusión:\n${argument.claim.statement}`);
    console.log(`\nNivel de certeza:\n${certaintyLabel(argument.qualifier)}`);
    console.log(`\nHistoria:\n${goalResult.resolved ? "RESUELTA" : "NO RESUELTA"}`);
    console.log(`\n${goalResult.message}`);
}

main()
    .then(() => rl.close())
    .catch((error) => {
        console.error(error);
        rl.close();
        process.exitCode = 1;
    });