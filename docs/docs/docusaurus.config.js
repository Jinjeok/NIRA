// docs/docusaurus.config.js
/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'My Awesome Docs', // 문서 사이트 제목
  tagline: 'Dinosaurs are cool', // 태그라인
  favicon: 'img/favicon.ico', // 파비콘 경로

  // GitHub Pages 배포를 위한 설정
  url: 'https://jinjeok.github.io', // 중요: 실제 GitHub 사용자 이름으로 변경
  baseUrl: '/NIRA/', // 중요: 실제 GitHub 저장소 이름으로 변경 (예: '/docs/')
                                     // 만약 `https://<username>.github.io/` 루트에 배포한다면 baseUrl: '/'

  organizationName: 'jinjeok', // 중요: 실제 GitHub 사용자 이름
  projectName: 'NIRA', // 중요: 실제 GitHub 저장소 이름 (보통 baseUrl의 폴더명과 동일)

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  trailingSlash: false, // GitHub Pages는 보통 trailing slash를 원하지 않음

  // 국제화 설정 (필요 없다면 이 부분은 생략 가능)
  i18n: {
    defaultLocale: 'ko',
    locales: ['ko'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          // GitHub에서 편집하기 버튼 링크 (선택 사항)
          // editUrl:
          //   'https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPOSITORY_NAME/tree/main/',
        },
        blog: {
          showReadingTime: true,
          // editUrl:
          //   'https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPOSITORY_NAME/tree/main/',
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      // Navbar, Footer 등 테마 관련 설정
      navbar: {
        title: 'My Docs',
        logo: {
          alt: 'My Docs Logo',
          src: 'img/logo.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar', // sidebars.js에서 정의한 사이드바 ID
            position: 'left',
            label: '문서',
          },
          {to: '/blog', label: '블로그', position: 'left'},
          {
            href: 'https://github.com/jinjeok/NIRA',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          // 푸터 링크들
        ],
        copyright: `Copyright © ${new Date().getFullYear()} My Project, Inc. Built with Docusaurus.`,
      },
      // prism: {
      //   theme: prismThemes.github,
      //   darkTheme: prismThemes.dracula,
      // },
    }),
};

module.exports = config;
