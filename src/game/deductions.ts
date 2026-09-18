import { Scene } from "../core/scene";
import { Relationship } from "../core/relationship";
import { Rule } from "../core/rule";
import { Fact } from "../core/fact";

export function deriveFacts(
    scene: Scene,
    relationships: readonly Relationship[],
    rules: readonly Rule[]
): Fact[] {
    const present = new Set(scene.getElements().map((element) => element.id));
    const facts: Fact[] = [];

    for (const relationship of relationships) {
        if (
            !present.has(relationship.source.id) ||
            !present.has(relationship.target.id)
        ) {
            continue;
        }
        for (const rule of rules) {
            if (rule.relationshipType !== relationship.type) {
                continue;
            }
            if (
                rule.sourceType !== null &&
                rule.sourceType !== relationship.source.type
            ) {
                continue;
            }
            if (
                rule.targetType !== null &&
                rule.targetType !== relationship.target.type
            ) {
                continue;
            }
            facts.push(rule.produces(relationship.source, relationship.target, relationship.type));
        }
    }

    return facts;
}