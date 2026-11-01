import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { i18n } from '@/i18n';
import { AppPreferencesProvider } from '@/providers/AppPreferencesProvider';
import { MainLayout } from './MainLayout';

afterEach(cleanup);

it('links 狙击手 from the sidebar and the top bar to /sniper', async () => {
  await i18n.changeLanguage('zh-CN');
  render(
    <AppPreferencesProvider>
      <MemoryRouter>
        <MainLayout />
      </MemoryRouter>
    </AppPreferencesProvider>,
  );
  const links = screen.getAllByRole('link', { name: '狙击手' });
  expect(links.map((link) => link.getAttribute('href'))).toEqual(['/sniper', '/sniper']);
});
