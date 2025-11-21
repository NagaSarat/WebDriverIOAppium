import loginPage from '../../src/pages/login.page';
import CommonActionsPage from '../../Utilities/CommonActions.page';
import loginData from '../../testdata/loginData.json';

describe('Mobile App - Login', () => {
  const base = new CommonActionsPage();

  it('should login successfully and show welcome message', async () => {
    await base.waitUntilVisible("loginButton", 20000);
    await loginPage.login(loginData.validUser.username, loginData.validUser.password);
    await base.isVisible("EmailError", 15000);
    await base.isVisible("PasswordError", 15000);
    await base.takeScreenshot('after');
  });
});
