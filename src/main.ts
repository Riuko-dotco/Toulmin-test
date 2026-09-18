import { mountMysteryUI } from './ui/mystery';

const app = document.querySelector<HTMLElement>("#app");

if (!app) {
    throw new Error("App root not found");
}

mountMysteryUI(app);
