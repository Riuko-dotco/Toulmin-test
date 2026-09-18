import { createMysteryStory } from '../game/stories/mystery/story';
import { createOceanDebateStory } from '../game/stories/ocean-debate/story';
import { createTutorialGuideStory } from '../game/stories/tutorial-guide/story';
import { Scene, SCENE_SLOT_COUNT } from '../core/scene';
import { Story } from '../core/story';
import { checkSceneConstraints } from '../game/constraintsCheck';
import { evaluateReasoning } from '../game/reasoningCheck';
import { checkStoryGoal } from '../game/goalCheck';
import { deriveFacts } from '../game/deductions';
import { Argument, ToulminQualifier } from '../core/argument';
import { Fact } from '../core/fact';
import { IStoryElement } from '../core/IStoryElement';

type AppPhase = 'home' | 'intro' | 'scene' | 'reasoning' | 'result';

// Story catalog: navigation only. Each entry is a factory provided by
// GAME; the UI only reads generic Story fields (id/title/context).
// New stories are added here without touching any component.
interface StoryEntry {
    readonly create: () => Story;
    readonly isTutorial?: boolean;
}

const STORY_CATALOG: readonly StoryEntry[] = [
    { create: createTutorialGuideStory, isTutorial: true },
    { create: createMysteryStory },
    { create: createOceanDebateStory },
];

let dragGhost: HTMLElement | null = null;
let dragElementId: string | null = null;
let dragStartX = 0;
let dragStartY = 0;
let isDragging = false;
let suppressClick = false;
const DRAG_THRESHOLD_PX = 8;

export function mountMysteryUI(root: HTMLElement): void {
    let story: Story = createMysteryStory();
    let scene = new Scene();
    let phase: AppPhase = 'home';
    let selectedElementId: string | null = null;
    let argument: Argument | null = null;
    let constraintChecks: ReturnType<typeof checkSceneConstraints> = [];
    let reasoningEvaluation: ReturnType<typeof evaluateReasoning> | null = null;
    let goalResult: ReturnType<typeof checkStoryGoal> | null = null;

    /* ===== TUTORIAL COACHMARKS (UI only, no engine calls) =====
       Active ONLY when story.id === "tutorial-guide". The bubble never
       advances on its own click: it advances when the player performs the
       real expected action (place/remove/modal/overlay/step change).
       tutorialStep: 0 place · 1 remove · 2 action modal · 3 check scene ·
       4 overlay result · 5 reasoning (text follows reasonStep) ·
       6 result · -1 skipped/done (no bubble). */
    let tutorialStep = 0;
    let tutorialGraceTimer: number | null = null;
    const TUTORIAL_STORY_ID = 'tutorial-guide';
    const TUTORIAL_DONE = -1;
    const TUTORIAL_REMOVE_GRACE_MS = 6000;

    function isTutorialStory(): boolean {
        return story.id === TUTORIAL_STORY_ID;
    }

    function isTutorialActive(): boolean {
        return isTutorialStory() && tutorialStep !== TUTORIAL_DONE;
    }

    // The index.html already provides <main id="app"> as root; reuse it
    // instead of nesting a second #app inside.
    const app = root;

    function render(): void {
        resetDragState();
        app.innerHTML = '';
        switch (phase) {
            case 'home': renderHome(); break;
            case 'intro': renderIntro(); break;
            case 'scene': renderScene(); break;
            case 'reasoning': renderReasoning(); break;
            case 'result': renderResult(); break;
        }
        if (isTutorialActive()) {
            renderCoachmark();
        } else {
            removeCoachmarkNode();
        }
    }

    function resetDragState(): void {
        if (dragGhost && dragGhost.parentNode) {
            dragGhost.parentNode.removeChild(dragGhost);
        }
        dragGhost = null;
        dragElementId = null;
        isDragging = false;
        detachDragListeners();
        clearSlotHighlights();
    }

    function detachDragListeners(): void {
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
        document.removeEventListener('pointercancel', onPointerCancel);
    }

    function clearSlotHighlights(): void {
        document.querySelectorAll('.slot--drag-over').forEach((slot) => {
            slot.classList.remove('slot--drag-over');
        });
    }

    /* ===== SHARED ART (covers & sprites hook) =====
       If the engine provides `pngUrl`, the real image is shown;
       otherwise a generic placeholder (initial of the name) reserves
       the space. No assumptions about which element is rendered. */
    function artHTML(element: IStoryElement, modifier: string): string {
        const initial = (element.name.trim().charAt(0) || '✦').toUpperCase();
        const visual = element.pngUrl
            ? `<img class="art-frame__img" src="${element.pngUrl}" alt="" draggable="false" />`
            : `<span class="art-frame__field" aria-hidden="true"><span class="art-frame__initial">${escapeHtml(initial)}</span></span>`;
        return `<span class="art-frame ${modifier}">${visual}</span>`;
    }

    function coverHTML(current: Story): string {
        const initial = (current.title.trim().charAt(0) || '✦').toUpperCase();
        return `<span class="art-frame art-frame--cover" aria-hidden="true">
            <span class="art-frame__field art-frame__field--emblem">
                <span class="art-frame__rule"></span>
                <span class="art-frame__initial">${escapeHtml(initial)}</span>
                <span class="art-frame__sigil">✦</span>
            </span>
        </span>`;
    }

    /* ===== HOME / STORY LIBRARY ===== */
    function renderHome(): void {
        const catalog = STORY_CATALOG.map((entry) => ({ entry, story: entry.create() }));
        const tutorialItem = catalog.find(({ entry, story }) => entry.isTutorial === true || story.id === TUTORIAL_STORY_ID);
        const container = document.createElement('div');
        container.className = 'main home';
        container.innerHTML = `
            <p class="home-eyebrow">ARCHIVO DE CASOS</p>
            <h1 class="home-title">Biblioteca de investigaciones</h1>
            <p class="home-lede">Elige un caso del archivo para abrir su expediente y reconstruir lo ocurrido.</p>
            ${tutorialItem ? `
            <section class="home-tutorial" aria-label="Aprender a jugar">
                <h2 class="home-tutorial__title">¿Primera vez aquí?</h2>
                <p class="home-tutorial__text">Practica sin presión: coloca, quita, prueba acciones y razona con guía.</p>
                <button type="button" class="intro__start-btn home-tutorial__btn" data-tutorial-begin>APRENDER A JUGAR</button>
            </section>` : ''}
            <div class="home-progress" role="status">
                <div class="home-dots" aria-hidden="true">${catalog.map((_, i) => `<span class="home-dot${i === 0 ? ' home-dot--current' : ''}"></span>`).join('')}</div>
                <p class="home-count">Caso 1 de ${catalog.length}</p>
            </div>
            <div class="home-grid">
                ${catalog.map(({ story: item }, i) => `
                <article class="case-card" aria-labelledby="case-title-${i}">
                    ${coverHTML(item)}
                    <h2 class="case-card__title" id="case-title-${i}">${escapeHtml(item.title)}</h2>
                    <p class="case-card__desc">${escapeHtml(item.context)}</p>
                    <p class="case-card__meta">${item.availableElements.length} elementos · ${SCENE_SLOT_COUNT} espacios</p>
                    <button type="button" class="intro__start-btn case-card__begin" data-case="${i}" aria-label="Comenzar: ${escapeHtml(item.title)}">COMENZAR LA INVESTIGACIÓN</button>
                </article>`).join('')}
            </div>
        `;
        app.appendChild(container);
        container.querySelectorAll('[data-case]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const found = catalog[parseInt((btn as HTMLElement).dataset.case!, 10)];
                if (found) beginStory(found.entry);
            });
        });
        container.querySelector('[data-tutorial-begin]')?.addEventListener('click', () => {
            if (tutorialItem) beginStory(tutorialItem.entry);
        });
    }

    function beginStory(entry: StoryEntry): void {
        story = entry.create();
        scene = new Scene();
        selectedElementId = null;
        tutorialStep = 0;
        clearTutorialGraceTimer();
        removeCoachmarkNode();
        phase = 'intro';
        render();
    }

    /* ===== INTRO ===== */
    function renderIntro(): void {
        const container = document.createElement('div');
        container.className = 'intro';
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const countdown = prefersReducedMotion ? '' : '<span class="intro__countdown">(3s)</span>';
        const disabled = prefersReducedMotion ? false : true;
        container.innerHTML = `
            <h1 class="intro__title">${escapeHtml(story.title)}</h1>
            <p class="intro__context">${story.context}</p>
            <button class="intro__start-btn" ${disabled ? 'disabled' : ''}>COMENZAR ${countdown}</button>
        `;
        app.appendChild(container);

        const btn = container.querySelector('.intro__start-btn') as HTMLButtonElement | null;
        if (!btn) return;
        if (!prefersReducedMotion) {
            const countdownEl = container.querySelector('.intro__countdown') as HTMLElement | null;
            if (countdownEl) {
                let secondsLeft = 3;
                const timer = setInterval(() => {
                    secondsLeft--;
                    if (secondsLeft <= 0) {
                        clearInterval(timer);
                        btn.disabled = false;
                        btn.innerHTML = 'COMENZAR';
                    } else {
                        countdownEl.textContent = `(${secondsLeft}s)`;
                    }
                }, 1000);
            }
        }

        btn.addEventListener('click', () => {
            phase = 'scene';
            render();
        });
    }

    /* ===== SCENE ===== */
    function renderScene(): void {
        const container = document.createElement('div');
        container.className = 'main';

        const instructions = document.createElement('div');
        instructions.className = 'instructions';
        instructions.textContent = 'Toca un elemento y luego un espacio para colocarlo, o arrástralo hasta la escena. Usa × para quitar un elemento.';
        const libraryBack = document.createElement('button');
        libraryBack.type = 'button';
        libraryBack.className = 'library-back';
        libraryBack.textContent = '‹ Biblioteca';
        libraryBack.setAttribute('aria-label', 'Volver a la biblioteca de casos');
        libraryBack.addEventListener('click', () => {
            clearTutorialGraceTimer();
            removeCoachmarkNode();
            phase = 'home';
            render();
        });
        container.appendChild(libraryBack);
        container.appendChild(instructions);

        const sceneEl = document.createElement('div');
        sceneEl.className = 'scene';
        sceneEl.id = 'scene-grid';

        for (let i = 1; i <= 6; i++) {
            const slot = document.createElement('div');
            slot.className = 'slot';
            slot.dataset.slot = String(i);

            const element = scene.get(i);
            if (element) {
                slot.classList.add('slot--occupied');
                slot.innerHTML = `
                    <div class="element-in-slot">
                        <button type="button" class="slot__remove" aria-label="Quitar ${escapeHtml(element.name)} de la escena" title="Quitar de la escena">×</button>
                        ${artHTML(element, 'art-frame--slot')}
                        <span class="element-in-slot__label">${escapeHtml(element.name)}</span>
                    </div>
                `;
                slot.querySelector('.slot__remove')?.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    removeFromSlot(i);
                });
            } else {
                slot.innerHTML = `<div class="slot__placeholder"></div><span class="slot__name">Espacio ${i}</span>`;
            }

            slot.addEventListener('pointerdown', (e) => handleSlotPointerDown(e, i));

            sceneEl.appendChild(slot);
        }

        container.appendChild(sceneEl);

        const placedCount = scene.getElements().length;
        const actionsRow = document.createElement('div');
        actionsRow.className = 'scene-actions';
        actionsRow.innerHTML = `
            <span class="scene-counter">${placedCount} de 6 elementos en la escena</span>
            <button type="button" class="check-results__btn">COMPROBAR ESCENA</button>
        `;
        actionsRow.querySelector('button')!.addEventListener('click', () => {
            openSceneCheckOverlay();
        });
        container.appendChild(actionsRow);

        const footerEl = document.createElement('div');
        footerEl.className = 'footer';
        footerEl.innerHTML = `
            <div class="footer__title">Elementos Disponibles</div>
            <div class="footer__scroll" id="element-band"></div>
        `;
        container.appendChild(footerEl);

        app.appendChild(container);
        renderElementBand();
    }

    function renderElementBand(): void {
        const band = document.getElementById('element-band');
        if (!band) return;
        const previousScroll = band.scrollLeft;
        band.innerHTML = '';

        story.availableElements.forEach((element) => {
            const card = document.createElement('div');
            card.className = 'element-card';
            card.dataset.elementId = element.id;
            if (element.type === 'action') {
                card.classList.add('element-card--action');
            }
            if (selectedElementId === element.id) {
                card.classList.add('element-card--selected');
            }
            const alreadyInScene = scene.getElements().some(el => el.id === element.id);
            if (alreadyInScene && element.type !== 'action') {
                card.classList.add('element-card--placed');
            }
            card.innerHTML = `
                ${artHTML(element, 'art-frame--band')}
                <span class="element-card__label">${escapeHtml(element.name)}</span>
            `;

            if (alreadyInScene && element.type !== 'action') {
                card.addEventListener('click', () => {
                    showToast(`${element.name} ya está en la escena. Quítalo con × para moverlo.`);
                });
            } else {
                card.addEventListener('pointerdown', (e) => handleElementPointerDown(e, element));
                card.addEventListener('click', (e) => handleElementClick(e, element));
            }

            band.appendChild(card);
        });
        band.scrollLeft = previousScroll;
    }

    /* ===== DRAG & DROP ===== */
    // Drag only starts after the pointer moves beyond DRAG_THRESHOLD_PX.
    // A simple tap therefore reaches the click handler untouched, and a
    // horizontal swipe over the footer still scrolls the band (cards use
    // `touch-action: pan-x`, so only vertical movement reaches us).
    function handleElementPointerDown(e: PointerEvent, element: IStoryElement): void {
        if (phase !== 'scene') return;
        if (element.type === 'action') return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;

        dragElementId = element.id;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        isDragging = false;

        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', onPointerUp);
        document.addEventListener('pointercancel', onPointerCancel);
    }

    function createGhost(element: IStoryElement, x: number, y: number): void {
        removeGhostElement();
        dragGhost = document.createElement('div');
        dragGhost.className = 'drag-ghost';
        dragGhost.innerHTML = `
            ${artHTML(element, 'art-frame--band')}
            <span class="drag-ghost__label">${escapeHtml(element.name)}</span>
        `;
        document.body.appendChild(dragGhost);
        moveGhost(x, y);
    }

    function removeGhostElement(): void {
        if (dragGhost && dragGhost.parentNode) {
            dragGhost.parentNode.removeChild(dragGhost);
        }
        dragGhost = null;
    }

    function moveGhost(x: number, y: number): void {
        if (dragGhost) {
            dragGhost.style.left = x + 'px';
            dragGhost.style.top = y + 'px';
        }
    }

    function onPointerMove(e: PointerEvent): void {
        if (!dragElementId) return;
        if (!isDragging) {
            const moved = Math.hypot(e.clientX - dragStartX, e.clientY - dragStartY);
            if (moved < DRAG_THRESHOLD_PX) return;
            const element = story.availableElements.find((el) => el.id === dragElementId);
            if (!element) {
                resetDragState();
                return;
            }
            isDragging = true;
            // The click event that follows a drag must be ignored.
            suppressClick = true;
            createGhost(element, e.clientX, e.clientY);
        }
        moveGhost(e.clientX, e.clientY);
        highlightSlotAt(e.clientX, e.clientY);
    }

    function highlightSlotAt(x: number, y: number): void {
        document.querySelectorAll('.slot').forEach((slot) => {
            const rect = slot.getBoundingClientRect();
            const inside =
                x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
            if (inside && !slot.classList.contains('slot--occupied')) {
                slot.classList.add('slot--drag-over');
            } else {
                slot.classList.remove('slot--drag-over');
            }
        });
    }

    function onPointerUp(e: PointerEvent): void {
        detachDragListeners();
        clearSlotHighlights();
        const wasDragging = isDragging;
        const droppedId = dragElementId;
        dragElementId = null;
        isDragging = false;
        removeGhostElement();

        if (wasDragging && droppedId) {
            const slot = getSlotAtPoint(e.clientX, e.clientY);
            if (slot) {
                const slotIndex = parseInt((slot as HTMLElement).dataset.slot!, 10);
                const element = story.availableElements.find((el) => el.id === droppedId);
                if (element && placeElementInSlot(element, slotIndex)) {
                    selectedElementId = null;
                }
            }
            render();
        }
        // If a click follows this pointerup, the click handler consumes
        // suppressClick; otherwise it expires on its own.
        window.setTimeout(() => {
            suppressClick = false;
        }, 0);
    }

    function onPointerCancel(): void {
        resetDragState();
        suppressClick = false;
    }

    function handleSlotPointerDown(e: PointerEvent, slotIndex: number): void {
        if ((e.target as HTMLElement).closest('.slot__remove')) return;
        if (!selectedElementId) return;
        const element = story.availableElements.find(el => el.id === selectedElementId);
        if (!element) return;
        placeElementInSlot(element, slotIndex);
        selectedElementId = null;
        render();
    }

    function getSlotAtPoint(x: number, y: number): HTMLElement | null {
        const slots = document.querySelectorAll('.slot');
        for (const slot of slots) {
            const rect = slot.getBoundingClientRect();
            if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                return slot as HTMLElement;
            }
        }
        return null;
    }

    function placeElementInSlot(element: IStoryElement, slotIndex: number): boolean {
        const existing = scene.get(slotIndex);
        if (existing) return false;

        const sceneElements = scene.getElements().map(el => el.id);
        if (sceneElements.includes(element.id)) return false;

        if (scene.getElements().length >= 6) return false;

        scene.place(element, slotIndex);
        // Tutorial step 0 advances ONLY on a real successful placement.
        if (isTutorialActive() && tutorialStep === 0) {
            tutorialStep = 1;
            armTutorialRemoveGraceTimer();
        }
        return true;
    }

    function removeFromSlot(slotIndex: number): void {
        if (!scene.get(slotIndex)) return;
        scene.remove(slotIndex);
        // Tutorial step 1 advances ONLY on a real removal (grace timer
        // in armTutorialRemoveGraceTimer() covers players who skip it).
        if (isTutorialActive() && tutorialStep === 1) {
            tutorialStep = 2;
            clearTutorialGraceTimer();
        }
        render();
    }

    function firstEmptySlot(): number | null {
        for (let i = 1; i <= 6; i++) {
            if (!scene.get(i)) return i;
        }
        return null;
    }

    function showToast(message: string): void {
        document.querySelector('.toast')?.remove();
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        window.requestAnimationFrame(() => {
            toast.classList.add('toast--visible');
        });
        window.setTimeout(() => {
            toast.classList.remove('toast--visible');
            window.setTimeout(() => toast.remove(), 300);
        }, 2600);
    }

    /* ===== TUTORIAL COACHMARKS (floating bubbles, UI only) =====
       Same floating-node pattern as the drag ghost: a node on
       document.body positioned with getBoundingClientRect() of the
       pointed element plus a small CSS arrow. Look comes from the
       .coachmark* classes (glass tokens); only left/top live inline.
       Never rendered unless story.id === "tutorial-guide". */
    function clearTutorialGraceTimer(): void {
        if (tutorialGraceTimer !== null) {
            window.clearTimeout(tutorialGraceTimer);
            tutorialGraceTimer = null;
        }
    }

    function armTutorialRemoveGraceTimer(): void {
        if (!isTutorialActive()) return;
        clearTutorialGraceTimer();
        tutorialGraceTimer = window.setTimeout(() => {
            tutorialGraceTimer = null;
            if (isTutorialActive() && tutorialStep === 1 && phase === 'scene') {
                tutorialStep = 2;
                renderCoachmark();
            }
        }, TUTORIAL_REMOVE_GRACE_MS);
    }

    function skipTutorial(): void {
        tutorialStep = TUTORIAL_DONE;
        clearTutorialGraceTimer();
        removeCoachmarkNode();
        phase = 'home';
        render();
    }

    function removeCoachmarkNode(): void {
        document.querySelector('.coachmark')?.remove();
    }

    function repositionCoachmark(): void {
        const node = document.querySelector('.coachmark') as HTMLElement | null;
        if (!node || !isTutorialActive()) return;
        positionCoachmark(node, node.dataset.targetSelector ?? null);
    }

    function positionCoachmark(node: HTMLElement, selector: string | null): void {
        node.style.position = 'fixed';
        node.style.zIndex = '3000';
        node.classList.remove('coachmark--fallback', 'coachmark--above');
        const target = selector ? document.querySelector(selector) : null;
        if (!target) {
            node.classList.add('coachmark--fallback');
            node.style.left = '';
            node.style.top = '';
            return;
        }
        const rect = (target as HTMLElement).getBoundingClientRect();
        const width = Math.min(280, window.innerWidth - 24);
        let left = rect.left + rect.width / 2 - width / 2;
        left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
        const gap = 12;
        let top = rect.bottom + gap;
        if (top + 160 > window.innerHeight) {
            top = Math.max(12, rect.top - gap);
            node.classList.add('coachmark--above');
        }
        node.style.maxWidth = `${width}px`;
        node.style.left = `${left}px`;
        node.style.top = `${top}px`;
    }

    function tutorialReasonText(step: number): string {
        switch (step) {
            case 1: return 'Paso 1 · Conclusión: escribe en una frase qué crees que ocurrió.';
            case 2: return 'Paso 2 · Pruebas: toca las frases que el juego dedujo de tu escena.';
            case 3: return 'Paso 3 · Explicación: cuenta cómo esas pruebas llevan a tu conclusión.';
            case 4: return 'Paso 4 · Certeza: elige qué tan seguro estás.';
            default: return 'Paso 5 · Objeciones: marca lo que podría debilitar tu conclusión y comprueba.';
        }
    }

    function renderCoachmark(): void {
        if (!isTutorialActive()) {
            removeCoachmarkNode();
            return;
        }
        let selector: string | null = null;
        let text: string | null = null;
        if (phase === 'scene') {
            if (tutorialStep === 0) {
                selector = '#element-band .element-card';
                text = 'Arrastra este elemento al papiro, o tócalo y luego toca un espacio vacío.';
            } else if (tutorialStep === 1) {
                selector = '.slot--occupied';
                text = 'Toca la × para quitarlo si te equivocas.';
            } else if (tutorialStep === 2) {
                selector = '#element-band .element-card--action';
                text = 'Toca una acción para ver a qué elementos se puede aplicar.';
            } else if (tutorialStep === 3) {
                selector = '.scene-actions .check-results__btn';
                text = 'Cuando tu escena esté lista, compruébala aquí.';
            } else {
                return;
            }
        } else if (phase === 'reasoning' && tutorialStep === 5) {
            selector = '#reason-step';
            text = tutorialReasonText(reasonStep);
        } else if (phase === 'result' && tutorialStep === 6) {
            selector = '.verdict-page';
            text = '¡Lo lograste! Practicaste todo el ciclo. Vuelve a la Biblioteca y juega un caso real.';
        } else if (tutorialStep === 4) {
            // Overlay result stage (no render() cycle): informative only,
            // it goes away when the player continues to reasoning.
            selector = '.verify-box .verify-actions';
            text = 'Si todo va bien, continúa al razonamiento.';
        } else {
            return;
        }
        if (text === null) return;

        let node = document.querySelector('.coachmark') as HTMLElement | null;
        if (!node) {
            node = document.createElement('div');
            node.className = 'coachmark';
            node.setAttribute('role', 'status');
            document.body.appendChild(node);
        }
        node.dataset.targetSelector = selector ?? '';
        node.innerHTML = `
            <span class="coachmark__arrow" aria-hidden="true"></span>
            <p class="coachmark__text">${escapeHtml(text)}</p>
            <button type="button" class="coachmark__skip">Saltar tutorial</button>
        `;
        node.querySelector('.coachmark__skip')?.addEventListener('click', (ev) => {
            ev.stopPropagation();
            skipTutorial();
        });
        positionCoachmark(node, selector);
    }

    /* ===== CLICK HANDLER FOR ELEMENTS ===== */
    function handleElementClick(e: MouseEvent, element: IStoryElement): void {
        if (suppressClick) {
            suppressClick = false;
            return;
        }
        if (phase !== 'scene') return;
        if (element.type === 'action') {
            showActionModal(element);
            return;
        }

        selectedElementId = selectedElementId === element.id ? null : element.id;
        render();
    }

    /* ===== ACTION MODAL ===== */
    function showActionModal(action: IStoryElement): void {
        // Tutorial step 2 advances ONLY when the modal really opens.
        if (isTutorialActive() && tutorialStep === 2) {
            tutorialStep = 3;
            clearTutorialGraceTimer();
        }
        document.querySelector('.action-modal')?.remove();

        const modal = document.createElement('div');
        modal.className = 'action-modal';

        let options: IStoryElement[] = [];
        let question = '';
        if (action.id === 'tomar') {
            options = story.availableElements.filter(
                (el) => el.type === 'object' || el.type === 'evidence'
            );
            question = '¿Qué deseas tomar?';
        } else if (action.id === 'entrar' || action.id === 'salir') {
            options = story.availableElements.filter((el) => el.type === 'location');
            question = `¿De dónde deseas ${action.id === 'entrar' ? 'entrar' : 'salir'}?`;
        } else {
            options = story.availableElements.filter((el) => el.id !== action.id);
            question = `¿Con qué deseas combinar ${escapeHtml(action.name)}?`;
        }

        const buttonsHtml = options
            .map(
                (option) =>
                    `<button type="button" class="action-modal__btn" data-action-target="${option.id}">${option.name}</button>`
            )
            .join('');

        modal.innerHTML = `
            <div class="action-modal__box" role="dialog" aria-label="${escapeHtml(action.name)}">
                <h3 class="action-modal__title">${escapeHtml(action.name)}</h3>
                <p class="action-modal__text">${question}</p>
                <div class="action-modal__options">
                    ${buttonsHtml || '<span class="action-modal__empty">No hay opciones disponibles</span>'}
                </div>
                <button type="button" class="action-modal__close" data-close>Cerrar</button>
            </div>
        `;

        document.body.appendChild(modal);

        const close = (): void => {
            document.removeEventListener('keydown', onKey);
            modal.remove();
        };
        const onKey = (ev: KeyboardEvent): void => {
            if (ev.key === 'Escape') close();
        };
        document.addEventListener('keydown', onKey);
        modal.addEventListener('pointerdown', (ev) => {
            if (ev.target === modal) close();
        });
        modal.querySelector('[data-close]')!.addEventListener('click', close);

        modal.querySelectorAll('[data-action-target]').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = (btn as HTMLElement).dataset.actionTarget!;
                const target = story.availableElements.find(el => el.id === targetId);
                close();
                if (target) {
                    handleActionSelection(action, target);
                }
            });
        });
    }

    function handleActionSelection(action: IStoryElement, target: IStoryElement): void {
        const inScene = (id: string): boolean =>
            scene.getElements().some((el) => el.id === id);
        const actionIn = inScene(action.id);
        const targetIn = inScene(target.id);
        const placedNames: string[] = [];

        if (!actionIn) {
            const slot = firstEmptySlot();
            if (slot !== null) {
                scene.place(action, slot);
                placedNames.push(action.name);
            }
        }
        if (!targetIn) {
            const slot = firstEmptySlot();
            if (slot !== null) {
                scene.place(target, slot);
                placedNames.push(target.name);
            }
        }
        render();

        if (actionIn && targetIn) {
            showToast(`${action.name} → ${target.name} ya está en la escena.`);
        } else if (placedNames.length > 0) {
            showToast(`${action.name} → ${target.name} se añadió a la escena.`);
        } else {
            showToast('La escena está llena. Quita un elemento con × para añadir otro.');
        }
    }

    /* ===== SCENE CHECK OVERLAY (Etapa A) =====
       The scene stays mounted and visible underneath. The overlay first
       shows a brief "checking" state and then morphs into the result
       within the same window. All verdicts come from the engine. */
    function openSceneCheckOverlay(): void {
        if (phase !== 'scene') return;
        // Tutorial step 3 advances ONLY when the check really runs.
        const wasTutorialWaitingForCheck = isTutorialActive() && tutorialStep === 3;
        if (wasTutorialWaitingForCheck) {
            tutorialStep = 4;
            clearTutorialGraceTimer();
        }
        constraintChecks = checkSceneConstraints(scene, story.relationships, story.constraints);
        const satisfiedCount = constraintChecks.filter((c) => c.satisfied).length;
        const allOk = satisfiedCount === constraintChecks.length;

        const overlay = document.createElement('div');
        overlay.className = 'verify-overlay';
        overlay.innerHTML = `
            <div class="verify-box" role="dialog" aria-modal="true" aria-label="Comprobación de escena">
                <div class="verify-stage verify-stage--checking">
                    <p class="verify-kicker">COMPROBANDO</p>
                    <div class="verify-dots" aria-hidden="true"><span></span><span></span><span></span></div>
                </div>
                <div class="verify-stage verify-stage--result" hidden>
                    <div class="verify-icon ${allOk ? 'verify-icon--ok' : 'verify-icon--fail'}" aria-hidden="true">${allOk ? '✓' : '✕'}</div>
                    <h3 class="verify-title">${allOk ? 'ESCENA COMPROBADA' : 'ESCENA INCOMPLETA'}</h3>
                    <p class="verify-sub">${allOk ? 'La escena contiene los elementos necesarios para continuar.' : 'Todavía hay elementos que debes revisar.'}</p>
                    <p class="check-summary">${satisfiedCount} de ${constraintChecks.length} condiciones cumplidas.</p>
                    <ul class="verify-list">
                        ${constraintChecks.map((c) => `<li class="verify-item ${c.satisfied ? 'verify-item--ok' : 'verify-item--fail'}"><span aria-hidden="true">${c.satisfied ? '✓' : '✗'}</span> ${escapeHtml(c.message)}</li>`).join('')}
                    </ul>
                    <div class="verify-actions">
                        ${allOk ? '<button type="button" class="check-results__btn" data-continue>CONTINUAR AL RAZONAMIENTO</button>' : ''}
                        <button type="button" class="verify-back" data-close>VOLVER A LA ESCENA</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const box = overlay.querySelector('.verify-box')!;
        const checking = overlay.querySelector('.verify-stage--checking') as HTMLElement;
        const result = overlay.querySelector('.verify-stage--result') as HTMLElement;

        const close = (): void => {
            document.removeEventListener('keydown', onKey);
            overlay.remove();
        };
        const onKey = (ev: KeyboardEvent): void => {
            if (ev.key === 'Escape' && result.hidden === false) close();
        };
        document.addEventListener('keydown', onKey);
        overlay.addEventListener('pointerdown', (ev) => {
            if (ev.target === overlay && result.hidden === false) close();
        });
        overlay.querySelector('[data-close]')!.addEventListener('click', close);
        overlay.querySelector('[data-continue]')?.addEventListener('click', () => {
            close();
            removeCoachmarkNode();
            if (isTutorialActive() && tutorialStep === 4) {
                tutorialStep = 5;
            }
            phase = 'reasoning';
            render();
        });

        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.setTimeout(() => {
            checking.classList.add('is-leaving');
            window.setTimeout(() => {
                checking.hidden = true;
                result.hidden = false;
                result.classList.add('is-entering');
                box.classList.add(allOk ? 'verify-box--ok' : 'verify-box--fail');
                // The overlay is not a render(): refresh the step-4 bubble
                // once the result stage is visible.
                if (isTutorialActive() && tutorialStep === 4) {
                    renderCoachmark();
                }
            }, reduceMotion ? 0 : 240);
        }, reduceMotion ? 350 : 1150);
    }

    function escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    /* ===== TUTORIAL OVERLAY =====
       Static help content (no game state, no engine calls).
       Same floating-overlay pattern as the scene check: node on
       document.body, phase untouched, listeners removed on close,
       openable/closable repeatedly without leaks. */
    function openTutorialOverlay(): void {
        document.querySelector('.tutorial-overlay')?.remove();
        const overlay = document.createElement('div');
        overlay.className = 'tutorial-overlay';
        overlay.innerHTML = `
            <div class="tutorial-panel" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
                <button type="button" class="tutorial-close" data-close aria-label="Cerrar tutorial">✕</button>
                <h2 class="tutorial-title" id="tutorial-title">Cómo jugar</h2>
                <p class="tutorial-lede">Eres la persona investigadora. Arma la escena, razona y resuelve el caso.</p>
                <div class="tutorial-body">
                    <section class="tutorial-section" aria-label="Colocar elementos">
                        <h3><span aria-hidden="true">1 · </span>Colocar elementos</h3>
                        <p>Arrastra una tarjeta de la bandeja inferior hasta un espacio vacío del papiro. Si prefieres no arrastrar, toca la tarjeta y después toca el espacio vacío: el elemento se coloca igual.</p>
                    </section>
                    <section class="tutorial-section" aria-label="Quitar elementos">
                        <h3><span aria-hidden="true">2 · </span>Quitar elementos</h3>
                        <p>Cada espacio ocupado muestra un botón × en su esquina. Tócalo para devolver el elemento a la bandeja y liberar el espacio.</p>
                    </section>
                    <section class="tutorial-section" aria-label="Acciones">
                        <h3><span aria-hidden="true">3 · </span>Acciones: Entrar, Salir y Tomar</h3>
                        <p>Las acciones no se arrastran: al tocarlas se abre una lista con sus objetivos válidos (lugares u objetos). Al elegir uno, la acción y su objetivo se colocan en la escena.</p>
                    </section>
                    <section class="tutorial-section" aria-label="Comprobar escena">
                        <h3><span aria-hidden="true">4 · </span>Comprobar escena</h3>
                        <p>El botón COMPROBAR ESCENA revisa si lo que armaste tiene lo necesario para avanzar. Verás cada condición marcada con ✓ o ✗ y un conteo. Si algo falta, vuelve al papiro, ajusta y comprueba de nuevo.</p>
                    </section>
                    <section class="tutorial-section" aria-label="Razonamiento en cinco pasos">
                        <h3><span aria-hidden="true">5 · </span>Razonar en cinco pasos</h3>
                        <p>Con la escena válida, construye tu razonamiento paso a paso:</p>
                        <ul>
                            <li><strong>Conclusión:</strong> qué crees que ocurrió, en una frase. Por ejemplo: «Creo que alguien tomó el objeto del lugar».</li>
                            <li><strong>Pruebas:</strong> toca las frases que el juego dedujo de tu escena y que respaldan tu conclusión.</li>
                            <li><strong>Explicación:</strong> cómo esas pruebas llevan a tu conclusión.</li>
                            <li><strong>Certeza:</strong> qué tan seguro estás, de Cierto a Poco probable.</li>
                            <li><strong>Objeciones:</strong> marca o escribe lo que podría debilitar tu conclusión.</li>
                        </ul>
                        <p>Puedes ir ATRÁS y CONTINUAR sin perder lo escrito.</p>
                    </section>
                    <section class="tutorial-section" aria-label="Veredicto final">
                        <h3><span aria-hidden="true">6 · </span>Leer el veredicto</h3>
                        <p>Al final verás tu conclusión, tus pruebas, tu certeza y el RESULTADO: HISTORIA RESUELTA o HISTORIA NO RESUELTA, con una explicación breve y la lista de comprobaciones.</p>
                    </section>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const close = (): void => {
            document.removeEventListener('keydown', onKey);
            overlay.remove();
        };
        const onKey = (ev: KeyboardEvent): void => {
            if (ev.key === 'Escape') close();
        };
        document.addEventListener('keydown', onKey);
        overlay.addEventListener('pointerdown', (ev) => {
            if (ev.target === overlay) close();
        });
        overlay.querySelector('[data-close]')!.addEventListener('click', close);
        (overlay.querySelector('.tutorial-close') as HTMLElement).focus();
    }

    /* ===== REASONING STEPPER (Etapa B) =====
       The reasoning is experienced as a narrative sequence, one step at a
       time. State lives in closure variables so data survives step
       transitions. The engine is only invoked on submit, exactly as before. */
    const REASON_TOTAL_STEPS = 5;
    const REASON_QUESTIONS = [
        '¿Qué crees que ocurrió?',
        '¿Qué pruebas respaldan tu conclusión?',
        '¿Qué explicación conecta esas pruebas?',
        '¿Qué tan seguro estás?',
        '¿Hay algo que contradiga o limite tu conclusión?',
    ];
    const CERTAINTY_OPTIONS: { value: ToulminQualifier | null; label: string }[] = [
        { value: 'certain', label: 'Cierto' },
        { value: 'probable', label: 'Probable' },
        { value: 'possible', label: 'Posible' },
        { value: 'unlikely', label: 'Poco probable' },
        { value: null, label: 'Sin indicar' },
    ];

    let reasonStep = 1;
    let reasonFacts: Fact[] = [];
    let claimText = '';
    let dataIdx = new Set<number>();
    let warrantText = '';
    let qualifierSel: ToulminQualifier | null = null;
    let qualifierChosen = false;
    let rebuttalIdx = new Set<number>();
    let rebuttalText = '';

    function renderReasoning(): void {
        reasonFacts = deriveFacts(scene, story.relationships, story.rules);
        reasonStep = 1;
        claimText = '';
        dataIdx = new Set<number>();
        warrantText = '';
        qualifierSel = null;
        qualifierChosen = false;
        rebuttalIdx = new Set<number>();
        rebuttalText = '';

        const container = document.createElement('div');
        container.className = 'main';
        container.innerHTML = `
            <p class="reason-kicker">Construye tu razonamiento</p>
            <div class="reason-progress">
                <div class="reason-dots" id="reason-dots" aria-hidden="true"></div>
                <p class="reason-count" id="reason-count" role="status"></p>
            </div>
            <section class="papyrus reason-panel" aria-live="polite">
                <div class="reason-step" id="reason-step"></div>
            </section>
        `;
        app.appendChild(container);
        paintReasonStep();
    }

    function paintReasonStep(): void {
        const dots = document.getElementById('reason-dots');
        const count = document.getElementById('reason-count');
        const slot = document.getElementById('reason-step');
        if (!dots || !count || !slot) return;

        dots.innerHTML = '';
        for (let i = 1; i <= REASON_TOTAL_STEPS; i++) {
            const dot = document.createElement('span');
            dot.className = 'reason-dot' + (i < reasonStep ? ' reason-dot--done' : i === reasonStep ? ' reason-dot--current' : '');
            dots.appendChild(dot);
            if (i < REASON_TOTAL_STEPS) {
                const link = document.createElement('span');
                link.className = 'reason-link';
                dots.appendChild(link);
            }
        }
        count.textContent = `Paso ${reasonStep} de ${REASON_TOTAL_STEPS}`;

        slot.classList.remove('reason-step--enter');
        // Force reflow so the enter animation replays on every step.
        void slot.offsetWidth;
        slot.innerHTML = '';
        const painters = [paintClaimStep, paintDataStep, paintWarrantStep, paintCertaintyStep, paintRebuttalStep];
        painters[reasonStep - 1](slot);
        slot.classList.add('reason-step--enter');
        // Tutorial step 5 is informative per reasoning sub-step: the bubble
        // follows reasonStep without needing its own tutorialStep per step.
        if (isTutorialActive() && tutorialStep === 5 && phase === 'reasoning') {
            renderCoachmark();
        }
    }

    function harvestReasonStep(): void {
        const slot = document.getElementById('reason-step');
        if (!slot) return;
        const claim = slot.querySelector('#reason-claim') as HTMLTextAreaElement | null;
        if (claim) claimText = claim.value;
        const warrant = slot.querySelector('#reason-warrant') as HTMLTextAreaElement | null;
        if (warrant) warrantText = warrant.value;
        const rebuttal = slot.querySelector('#reason-rebuttal') as HTMLTextAreaElement | null;
        if (rebuttal) rebuttalText = rebuttal.value;
    }

    function reasonNav(slot: HTMLElement, opts: { back?: boolean; nextLabel?: string; nextDisabled?: boolean; onNext: () => void }): void {
        const nav = document.createElement('div');
        nav.className = 'reason-nav';
        if (opts.back) {
            const back = document.createElement('button');
            back.type = 'button';
            back.className = 'verify-back';
            back.textContent = 'ATRÁS';
            back.addEventListener('click', () => {
                harvestReasonStep();
                reasonStep = Math.max(1, reasonStep - 1);
                paintReasonStep();
            });
            nav.appendChild(back);
        }
        const next = document.createElement('button');
        next.type = 'button';
        next.className = 'check-results__btn reason-next';
        next.textContent = opts.nextLabel ?? 'CONTINUAR';
        next.disabled = opts.nextDisabled ?? false;
        next.addEventListener('click', opts.onNext);
        nav.appendChild(next);
        slot.appendChild(nav);
    }

    function paintClaimStep(slot: HTMLElement): void {
        slot.innerHTML = `
            <h3 class="reason-question">${REASON_QUESTIONS[0]}</h3>
            <textarea id="reason-claim" class="reasoning__textarea reason-field" rows="4" placeholder="Escribe tu conclusión en una frase…">${escapeHtml(claimText)}</textarea>
        `;
        const area = slot.querySelector('#reason-claim') as HTMLTextAreaElement;
        reasonNav(slot, {
            nextLabel: 'CONTINUAR',
            nextDisabled: area.value.trim() === '',
            onNext: () => {
                claimText = area.value.trim();
                if (!claimText) return;
                reasonStep = 2;
                paintReasonStep();
            },
        });
        const nextBtn = slot.querySelector('.reason-next') as HTMLButtonElement;
        area.addEventListener('input', () => {
            nextBtn.disabled = area.value.trim() === '';
        });
    }

    function paintFactChips(facts: Fact[], selected: Set<number>): string {
        if (facts.length === 0) {
            return '<p class="reason-hint">Aún no hay información suficiente en la escena.</p>';
        }
        return `<div class="proof-grid">${facts.map((fact, i) => `
            <button type="button" class="proof-chip${selected.has(i) ? ' proof-chip--selected' : ''}" data-fact="${i}" aria-pressed="${selected.has(i)}">
                <span class="proof-chip__tick" aria-hidden="true">✓</span>
                <span>${escapeHtml(fact.statement)}</span>
            </button>`).join('')}</div>`;
    }

    function wireFactChips(slot: HTMLElement, selected: Set<number>): void {
        slot.querySelectorAll('.proof-chip').forEach((chip) => {
            chip.addEventListener('click', () => {
                const i = parseInt((chip as HTMLElement).dataset.fact!, 10);
                if (selected.has(i)) {
                    selected.delete(i);
                } else {
                    selected.add(i);
                }
                const isSelected = selected.has(i);
                chip.classList.toggle('proof-chip--selected', isSelected);
                chip.setAttribute('aria-pressed', String(isSelected));
            });
        });
    }

    function paintDataStep(slot: HTMLElement): void {
        slot.innerHTML = `
            <h3 class="reason-question">${REASON_QUESTIONS[1]}</h3>
            <p class="reason-hint">Toca las evidencias encontradas durante la investigación.</p>
            ${paintFactChips(reasonFacts, dataIdx)}
        `;
        wireFactChips(slot, dataIdx);
        reasonNav(slot, {
            back: true,
            onNext: () => {
                reasonStep = 3;
                paintReasonStep();
            },
        });
    }

    function paintWarrantStep(slot: HTMLElement): void {
        slot.innerHTML = `
            <h3 class="reason-question">${REASON_QUESTIONS[2]}</h3>
            <textarea id="reason-warrant" class="reasoning__textarea reason-field" rows="4" placeholder="Explica cómo esas pruebas llevan a tu conclusión… (puedes dejarlo vacío)">${escapeHtml(warrantText)}</textarea>
        `;
        reasonNav(slot, {
            back: true,
            onNext: () => {
                harvestReasonStep();
                reasonStep = 4;
                paintReasonStep();
            },
        });
    }

    function paintCertaintyStep(slot: HTMLElement): void {
        slot.innerHTML = `
            <h3 class="reason-question">${REASON_QUESTIONS[3]}</h3>
            <p class="reason-hint">Elige el nivel que mejor represente tu seguridad.</p>
            <div class="certainty-scale" role="group" aria-label="Nivel de certeza">
                ${CERTAINTY_OPTIONS.map((option) => {
                    const key = option.value ?? 'null';
                    const pressed = qualifierChosen && qualifierSel === option.value;
                    return `
                    <button type="button" class="certainty-seal${pressed ? ' certainty-seal--selected' : ''}" data-q="${key}" aria-pressed="${pressed}">
                        <span class="certainty-seal__dot" aria-hidden="true"></span>
                        <span>${option.label}</span>
                    </button>`;
                }).join('')}
            </div>
        `;
        slot.querySelectorAll('.certainty-seal').forEach((seal) => {
            seal.addEventListener('click', () => {
                const key = (seal as HTMLElement).dataset.q;
                qualifierSel = key === 'null' ? null : (key as ToulminQualifier);
                qualifierChosen = true;
                slot.querySelectorAll('.certainty-seal').forEach((other) => {
                    const active = other === seal;
                    other.classList.toggle('certainty-seal--selected', active);
                    other.setAttribute('aria-pressed', String(active));
                });
            });
        });
        reasonNav(slot, {
            back: true,
            onNext: () => {
                reasonStep = 5;
                paintReasonStep();
            },
        });
    }

    function paintRebuttalStep(slot: HTMLElement): void {
        slot.innerHTML = `
            <h3 class="reason-question">${REASON_QUESTIONS[4]}</h3>
            <p class="reason-hint">Marca lo que debilite tu conclusión, o escríbelo con tus palabras.</p>
            ${paintFactChips(reasonFacts, rebuttalIdx)}
            <textarea id="reason-rebuttal" class="reasoning__textarea reason-field" rows="3" placeholder="Otra objeción con tus palabras… (puedes dejarlo vacío)">${escapeHtml(rebuttalText)}</textarea>
        `;
        wireFactChips(slot, rebuttalIdx);
        reasonNav(slot, {
            back: true,
            nextLabel: 'COMPROBAR RAZONAMIENTO',
            onNext: submitReasoning,
        });
    }

    function submitReasoning(): void {
        harvestReasonStep();
        const claim = claimText.trim();
        if (!claim) {
            reasonStep = 1;
            paintReasonStep();
            return;
        }
        const data = [...dataIdx].sort((a, b) => a - b).map((i) => reasonFacts[i]).filter((f) => f !== undefined);
        const warrant = warrantText.trim() ? { statement: warrantText.trim() } : null;
        const rebuttal = [...rebuttalIdx].sort((a, b) => a - b).map((i) => reasonFacts[i]).filter((f) => f !== undefined);
        if (rebuttalText.trim()) {
            rebuttal.push(new Fact(rebuttalText.trim(), []));
        }

        argument = new Argument(
            'ui-argument',
            { statement: claim },
            data,
            warrant,
            [],
            qualifierSel,
            rebuttal
        );

        reasoningEvaluation = evaluateReasoning(argument, reasonFacts);
        constraintChecks = checkSceneConstraints(scene, story.relationships, story.constraints, { reasoningCheck: reasoningEvaluation });
        goalResult = checkStoryGoal({
            story,
            scene,
            derivedFacts: reasonFacts,
            argument,
            reasoningCheck: reasoningEvaluation,
            constraintChecks,
        });

        if (isTutorialActive() && tutorialStep === 5) {
            tutorialStep = 6;
        }
        phase = 'result';
        render();
    }

    /* ===== RESULT / VERDICT PAGE (Etapa C) =====
       A single manuscript page. Every datum shown (claim, proofs,
       qualifier, verdict, message, checks) comes from the player's
       argument and the engine's goal evaluation. */
    function renderResult(): void {
        if (!goalResult || !argument) return;

        const resolved = goalResult.resolved;

        const container = document.createElement('div');
        container.className = 'main';
        container.innerHTML = `
            <section class="papyrus verdict-page">
                <div class="verdict-ornament" aria-hidden="true">✦</div>
                <h2 class="verdict-heading">CONCLUSIÓN</h2>
                <p class="verdict-claim">“${escapeHtml(argument.claim.statement)}”</p>
                <hr class="verdict-rule" />
                <h3 class="verdict-heading verdict-heading--small">PRUEBAS</h3>
                ${argument.data.length > 0
                    ? `<ul class="verdict-proofs">${argument.data.map((f) => `<li>${escapeHtml(f.statement)}</li>`).join('')}</ul>`
                    : '<p class="verdict-empty">Ninguna prueba seleccionada.</p>'}
                <hr class="verdict-rule" />
                <h3 class="verdict-heading verdict-heading--small">NIVEL DE CERTEZA</h3>
                <div class="verdict-dots" role="img" aria-label="Nivel de certeza: ${certaintyLabel(argument.qualifier)}">${certaintyDots(argument.qualifier)}</div>
                <p class="verdict-certainty-label">${certaintyLabel(argument.qualifier)}</p>
                <hr class="verdict-rule" />
                <h3 class="verdict-heading verdict-heading--small">RESULTADO</h3>
                <p class="verdict-outcome ${resolved ? 'verdict-outcome--resolved' : 'verdict-outcome--unresolved'}">${resolved ? 'HISTORIA RESUELTA' : 'HISTORIA NO RESUELTA'}</p>
                <p class="verdict-message">${escapeHtml(goalResult.message)}</p>
                <ul class="verdict-checks">
                    ${goalResult.checks.map((c) => `<li class="verdict-check ${c.ok ? 'verdict-check--ok' : 'verdict-check--fail'}"><span aria-hidden="true">${c.ok ? '✓' : '✗'}</span> ${escapeHtml(c.label)}</li>`).join('')}
                </ul>
                <button type="button" class="check-results__btn verdict-replay" id="result-restart-btn">JUGAR OTRA VEZ</button>
            </section>
        `;

        app.appendChild(container);

        document.getElementById('result-restart-btn')!.addEventListener('click', resetGame);
    }

    function certaintyDots(qualifier: ToulminQualifier | null): string {
        const filled = qualifier === 'certain' ? 4 : qualifier === 'probable' ? 3 : qualifier === 'possible' ? 2 : qualifier === 'unlikely' ? 1 : 0;
        let out = '';
        for (let i = 0; i < 4; i++) {
            out += `<span class="verdict-dot${i < filled ? ' verdict-dot--filled' : ''}" aria-hidden="true"></span>`;
        }
        return out;
    }

    function resetGame(): void {
        scene = new Scene();
        selectedElementId = null;
        if (isTutorialStory() && tutorialStep !== TUTORIAL_DONE) {
            tutorialStep = 0;
        }
        clearTutorialGraceTimer();
        removeCoachmarkNode();
        reasonStep = 1;
        reasonFacts = [];
        claimText = '';
        dataIdx = new Set<number>();
        warrantText = '';
        qualifierSel = null;
        qualifierChosen = false;
        rebuttalIdx = new Set<number>();
        rebuttalText = '';
        argument = null;
        constraintChecks = [];
        reasoningEvaluation = null;
        goalResult = null;
        phase = 'intro';
        render();
    }

    function certaintyLabel(qualifier: ToulminQualifier | null): string {
        const labels: Record<string, string> = {
            certain: 'Cierto',
            probable: 'Probable',
            possible: 'Posible',
            unlikely: 'Poco probable'
        };
        return qualifier === null ? 'Sin indicar' : labels[qualifier] ?? qualifier;
    }

    // Coachmark follows its target on scroll/resize (passive, UI only).
    // Attached once: repositionCoachmark() no-ops for real cases.
    if (!(window as unknown as { __coachmarkRepositionWired?: boolean }).__coachmarkRepositionWired) {
        (window as unknown as { __coachmarkRepositionWired?: boolean }).__coachmarkRepositionWired = true;
        window.addEventListener('resize', repositionCoachmark);
        window.addEventListener('scroll', repositionCoachmark, true);
    }

    // Fixed help button: lives on document.body (outside #app), so it is
    // visible in every phase without touching render()/phase.
    if (!document.querySelector('.help-fab')) {
        const helpBtn = document.createElement('button');
        helpBtn.type = 'button';
        helpBtn.className = 'help-fab';
        helpBtn.textContent = '?';
        helpBtn.setAttribute('aria-label', 'Abrir tutorial: cómo jugar');
        helpBtn.addEventListener('click', openTutorialOverlay);
        document.body.appendChild(helpBtn);
    }

    render();
}
