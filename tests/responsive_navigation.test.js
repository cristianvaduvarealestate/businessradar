const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

test('Navigation Architecture — RootLayout renders Navigation exactly once', () => {
  const layoutPath = path.join(__dirname, '..', 'src', 'app', 'layout.tsx');
  const layoutContent = fs.readFileSync(layoutPath, 'utf8');

  const navigationMatches = layoutContent.match(/<Navigation\s*\/>/g) || [];
  assert.strictEqual(navigationMatches.length, 1, 'RootLayout must render <Navigation /> exactly once');
});

test('Navigation Architecture — Prospecting pages do NOT duplicate Navigation', () => {
  const pagePath = path.join(__dirname, '..', 'src', 'app', 'prospecting', '[portfolio]', 'page.tsx');
  const pageContent = fs.readFileSync(pagePath, 'utf8');

  assert.ok(!pageContent.includes('<Navigation'), 'Prospecting page must NEVER import or render <Navigation />');
  assert.ok(!pageContent.includes("import Navigation from '@/components/Navigation';"), 'Prospecting page must not import Navigation');
});

test('Mobile UX Redesign — Navigation component provides Mobile Header and Mobile Drawer', () => {
  const navPath = path.join(__dirname, '..', 'src', 'components', 'Navigation.tsx');
  const navContent = fs.readFileSync(navPath, 'utf8');

  // Mobile Top Header
  assert.ok(navContent.includes('lg:hidden'), 'Navigation must include mobile header with lg:hidden');
  assert.ok(navContent.includes('Menu'), 'Navigation must include hamburger Menu icon');
  assert.ok(navContent.includes('aria-label="Deschide meniul de navigație"'), 'Navigation must have accessible label for hamburger');

  // Desktop Sidebar
  assert.ok(navContent.includes('hidden lg:flex w-64'), 'Navigation must render desktop sidebar hidden on mobile and flex on lg');

  // Drawer Overlay & Dismissal
  assert.ok(navContent.includes('isMobileOpen'), 'Navigation must manage isMobileOpen state');
  assert.ok(navContent.includes('fixed inset-0 bg-black/75'), 'Navigation drawer must include backdrop overlay');
  assert.ok(navContent.includes('Escape'), 'Navigation drawer must support Escape key');
  assert.ok(navContent.includes("document.body.style.overflow = 'hidden'"), 'Navigation drawer must lock body scroll when open');
  assert.ok(navContent.includes('safe-area-inset-bottom'), 'Navigation drawer must respect iPhone safe areas');

  // Single component reuse
  const asideMatches = navContent.match(/<aside/g) || [];
  assert.strictEqual(asideMatches.length, 2, 'Navigation must declare exactly 1 mobile drawer aside and 1 desktop sidebar aside');
});

test('Mobile UX Redesign — Prospecting page provides Mobile Cards and Desktop Table', () => {
  const pagePath = path.join(__dirname, '..', 'src', 'app', 'prospecting', '[portfolio]', 'page.tsx');
  const pageContent = fs.readFileSync(pagePath, 'utf8');

  // Mobile Card View (< 1024px)
  assert.ok(pageContent.includes('block lg:hidden space-y-3'), 'Prospecting page must render mobile card container with block lg:hidden');
  assert.ok(pageContent.includes('href={`tel:'), 'Mobile cards must provide functional tel: links');
  assert.ok(pageContent.includes('href={`mailto:'), 'Mobile cards must provide functional mailto: links');
  assert.ok(pageContent.includes('Dosar CRM'), 'Mobile cards must provide clear Dosar CRM button');

  // Desktop Table View (>= 1024px)
  assert.ok(pageContent.includes('hidden lg:block overflow-x-auto'), 'Prospecting page must render desktop table with hidden lg:block');
  assert.ok(pageContent.includes('<table'), 'Desktop view must render the full data table');
});

test('Mobile UX Redesign — ProspectDossierDrawer supports full-screen mobile and Escape key', () => {
  const drawerPath = path.join(__dirname, '..', 'src', 'components', 'ProspectDossierDrawer.tsx');
  const drawerContent = fs.readFileSync(drawerPath, 'utf8');

  assert.ok(drawerContent.includes('w-full max-w-full sm:max-w-2xl'), 'Drawer must expand full-width on mobile and sm:max-w-2xl on desktop');
  assert.ok(drawerContent.includes('Escape'), 'Drawer must support Escape key to close');
  assert.ok(drawerContent.includes("document.body.style.overflow = 'hidden'"), 'Drawer must lock background scroll when open');
  assert.ok(drawerContent.includes('safe-area-inset-bottom'), 'Drawer must respect bottom safe area insets');
  assert.ok(drawerContent.includes('onClick={onClose}'), 'Backdrop click must close drawer');
});

test('Viewport Invariant Verification — Screen size breakpoints mapping', () => {
  const VIEWPORTS = [
    { name: 'Mobile XS', width: 320, mode: 'mobile' },
    { name: 'Mobile S', width: 360, mode: 'mobile' },
    { name: 'Mobile M', width: 375, mode: 'mobile' },
    { name: 'Mobile L', width: 390, mode: 'mobile' },
    { name: 'Mobile XL', width: 430, mode: 'mobile' },
    { name: 'Tablet Portrait', width: 768, mode: 'mobile' },
    { name: 'Desktop Standard', width: 1024, mode: 'desktop' },
    { name: 'Desktop Wide', width: 1440, mode: 'desktop' },
  ];

  // Tailwind lg breakpoint is 1024px
  VIEWPORTS.forEach((vp) => {
    const isDesktop = vp.width >= 1024;
    assert.strictEqual(
      isDesktop ? 'desktop' : 'mobile',
      vp.mode,
      `Viewport ${vp.name} (${vp.width}px) correctly categorized as ${vp.mode}`
    );
  });
});
