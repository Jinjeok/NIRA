import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'NIRA Docs',
  tagline: 'Discord Bot for useful daily tasks',
  favicon: 'img/favicon.ico',

  future: { v4: true },

  url: 'https://jinjeok.github.io',
  baseUrl: '/NIRA/',

  organizationName: 'Jinjeok',
  projectName: 'NIRA',

  trailingSlash: true,

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: { defaultLocale: 'en', locales: ['en'] },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/Jinjeok/NIRA/edit/main/docs/',
          routeBasePath: '/',
        },
        blog: false,
        theme: { customCss: './src/css/custom.css' },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/docusaurus-social-card.jpg',
    navbar: {
      title: 'NIRA Docs',
      logo: { alt: 'NIRA Logo', src: 'img/logo.svg' },
      items: [
        { type: 'docSidebar', sidebarId: 'tutorialSidebar', position: 'left', label: 'Docs' },
        { href: 'https://github.com/Jinjeok/NIRA', label: 'GitHub', position: 'right' },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        { title: 'Docs', items: [ { label: 'Intro', to: '/' } ] },
        { title: 'Community', items: [ { label: 'GitHub', href: 'https://github.com/Jinjeok/NIRA' } ] },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} NIRA`,
    },
    prism: { theme: prismThemes.github, darkTheme: prismThemes.dracula },
  } satisfies Preset.ThemeConfig,
};

export default config;
