import loginPage from '../../src/pages/login.page';
import BasePage from '../../src/pages/base.page';
import loginpage from '../../object-repository/loginpage.json';

describe('Mobile App - Login', () => {
  const base = new BasePage();

  it('should login successfully and show welcome message', async () => {
    await base.waitUntilVisible(loginpage.loginButton, 20000);
    await loginPage.login('testuser', 'Password123');
    await base.isVisible(loginpage.EmailError, 15000);
    await base.isVisible(loginpage.PasswordError, 15000);
    await base.takeScreenshot('after-login');
  });
});
