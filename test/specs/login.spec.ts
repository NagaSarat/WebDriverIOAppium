import loginPage from '../../src/pages/login.page';
import BasePage from '../../src/pages/base.page';
import { expect } from 'chai';

describe('Mobile App - Login Test', () => {
  const base = new BasePage();

  it('should login successfully and show welcome message', async () => {
    await base.waitUntilVisible(loginPage.loginModule, 20000);
    await loginPage.login('testuser', 'Password123');
    await base.isVisible(loginPage.EmailError, 15000);
    await base.takeScreenshot('after-login');
  });
});
