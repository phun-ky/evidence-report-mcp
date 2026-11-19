import { defineConfig, type DefaultTheme } from 'vitepress';

import pkg from '../../package.json' with { type: 'json' };
import typedocSidebar from '../api/typedoc-sidebar.json' with { type: 'json' };

import darkTheme from './shiki/accessible-aa-dark-shiki.json' with { type: 'json' };
import lightTheme from './shiki/accessible-aa-light-shiki.json' with { type: 'json' };

const SITE = 'https://phun-ky.net/evidence-report-mcp/';
const DESCRIPTION =
  'An MCP server with one tool, verify. Agents call it before acting on something they did not make, and get back what was checked, where it came from, and what was not checked.';
const SOCIAL_ALT =
  'evidence-report-mcp: Unknown is not pass. The headline is cut by a line: checked above it, not checked below. An MCP server that tells agents what was checked, where it came from, and what was not.';

export default defineConfig({
  base: '/evidence-report-mcp/',
  lang: 'en-GB',
  title: 'evidence-report-mcp',
  description: DESCRIPTION,
  cleanUrls: true,
  lastUpdated: true,
  sitemap: { hostname: SITE },
  head: [
    // head links are not prefixed with base, so they carry it themselves
    [
      'link',
      {
        rel: 'icon',
        type: 'image/svg+xml',
        href: '/evidence-report-mcp/logo/favicon.svg'
      }
    ],
    [
      'link',
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        href: '/evidence-report-mcp/logo/favicon-32.png'
      }
    ],
    [
      'link',
      {
        rel: 'apple-touch-icon',
        href: '/evidence-report-mcp/logo/apple-touch-icon.png'
      }
    ],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'evidence-report-mcp' }],
    ['meta', { property: 'og:title', content: 'evidence-report-mcp' }],
    ['meta', { property: 'og:description', content: DESCRIPTION }],
    ['meta', { property: 'og:url', content: SITE }],
    ['meta', { property: 'og:locale', content: 'en_GB' }],
    ['meta', { property: 'og:image', content: `${SITE}logo/social@2x.png` }],
    ['meta', { property: 'og:image:width', content: '2400' }],
    ['meta', { property: 'og:image:height', content: '1260' }],
    ['meta', { property: 'og:image:alt', content: SOCIAL_ALT }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:image', content: `${SITE}logo/social@2x.png` }],
    ['meta', { name: 'twitter:image:alt', content: SOCIAL_ALT }]
  ],
  markdown: {
    theme: {
      light: lightTheme as never,
      dark: darkTheme as never
    }
  },
  themeConfig: {
    logo: {
      light: '/logo/mark.svg',
      dark: '/logo/mark-dark.svg',
      alt: ''
    },
    nav: [
      { text: 'Guide', link: '/guide/', activeMatch: '/guide/' },
      { text: 'API', link: '/api/', activeMatch: '/api/' },
      {
        text: pkg.version,
        items: [
          {
            text: 'Changelog',
            link: 'https://github.com/phun-ky/evidence-report-mcp/blob/main/CHANGELOG.md'
          },
          {
            text: 'npm',
            link: 'https://www.npmjs.com/package/evidence-report-mcp'
          },
          {
            text: 'Security policy',
            link: 'https://github.com/phun-ky/evidence-report-mcp/blob/main/SECURITY.md'
          },
          {
            text: 'Contributing',
            link: 'https://github.com/phun-ky/evidence-report-mcp/blob/main/CONTRIBUTING.md'
          },
          {
            text: 'Roadmap',
            link: 'https://github.com/phun-ky/evidence-report-mcp/blob/main/ROADMAP.md'
          }
        ]
      }
    ],
    socialLinks: [
      {
        icon: 'github',
        link: 'https://github.com/phun-ky/evidence-report-mcp',
        ariaLabel: 'evidence-report-mcp on GitHub'
      }
    ],
    search: { provider: 'local' },
    editLink: {
      pattern:
        'https://github.com/phun-ky/evidence-report-mcp/edit/main/docs/:path',
      text: 'Suggest changes to this page'
    },
    outline: { level: [2, 3] },
    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'Getting started', link: '/guide/' },
            { text: 'The evidence report', link: '/guide/report' },
            { text: 'Configuration', link: '/guide/configuration' }
          ]
        },
        {
          text: 'Checks',
          items: [
            { text: 'Packages', link: '/guide/checks/package' },
            { text: 'Datasets', link: '/guide/checks/dataset' },
            { text: 'Media files', link: '/guide/checks/file' },
            { text: 'Claims', link: '/guide/checks/claim' }
          ]
        }
      ],
      '/api/': [
        {
          text: 'API',
          link: '/api/',
          // Open groups: a collapsible group nests the caret button inside
          // the group's own button, which fails WCAG 4.1.2 (#24)
          items: (typedocSidebar as DefaultTheme.SidebarItem[]).map(
            (group) => ({ ...group, collapsed: undefined })
          )
        }
      ]
    },
    footer: {
      message:
        'Released under the <a href="https://github.com/phun-ky/evidence-report-mcp/blob/main/LICENSE">MIT licence</a>. Companion to the talk <a href="https://slides.com/phun-ky/invisible-data-building-trust-in-the-age-of-ai">Invisible Data: Building Trust in the Age of AI</a>.',
      copyright:
        'Copyright © 2026 <a href="https://phun-ky.net/">Alexander Vassbotn Røyne-Helgesen</a>'
    }
  }
});
