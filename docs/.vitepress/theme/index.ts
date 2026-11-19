import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme-without-fonts';

// Self-hosted fonts: the site loads nothing from other origins
import '@fontsource/work-sans/300.css';
import '@fontsource/work-sans/400.css';
import '@fontsource/work-sans/600.css';
import './tokens.css';
import './style.css';

import ReportHome from './components/ReportHome.vue';

export default {
  ...DefaultTheme,
  enhanceApp(ctx) {
    // Keep the default theme's global components (such as <Badge>)
    DefaultTheme.enhanceApp?.(ctx);
    ctx.app.component('ReportHome', ReportHome);
  }
} satisfies Theme;
