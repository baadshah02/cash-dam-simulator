import { mount } from 'svelte';
import App from './App.svelte';
import { loadSavedTheme, applyTheme } from './lib/themes';

// Load and apply saved theme before mounting the app
const savedTheme = loadSavedTheme();
applyTheme(savedTheme);

const app = mount(App, {
  target: document.getElementById('app')!,
});

export default app;
