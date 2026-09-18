import { IStoryElement } from "./IStoryElement";

export const SCENE_SLOT_COUNT = 6;

export class Scene {
    private readonly slots: (IStoryElement | null)[];

    constructor(initial: readonly (IStoryElement | null)[] = []) {
        if (initial.length > SCENE_SLOT_COUNT) {
            throw new RangeError(
                `Scene cannot hold more than ${SCENE_SLOT_COUNT} elements. Received: ${initial.length}`
            );
        }
        this.slots = Array.from(
            { length: SCENE_SLOT_COUNT },
            (_, index) => initial[index] ?? null
        );
    }

    place(element: IStoryElement, slot: number): void {
        this.assertValidSlot(slot);
        this.slots[slot - 1] = element;
    }

    remove(slot: number): void {
        this.assertValidSlot(slot);
        this.slots[slot - 1] = null;
    }

    get(slot: number): IStoryElement | null {
        this.assertValidSlot(slot);
        return this.slots[slot - 1];
    }

    isFilled(slot: number): boolean {
        return this.get(slot) !== null;
    }

    isComplete(): boolean {
        return this.slots.every((element) => element !== null);
    }

    getElements(): IStoryElement[] {
        return this.slots.filter(
            (element): element is IStoryElement => element !== null
        );
    }

    private assertValidSlot(slot: number): void {
        if (!Number.isInteger(slot) || slot < 1 || slot > SCENE_SLOT_COUNT) {
            throw new RangeError(
                `Slot must be an integer between 1 and ${SCENE_SLOT_COUNT}. Received: ${slot}`
            );
        }
    }
}