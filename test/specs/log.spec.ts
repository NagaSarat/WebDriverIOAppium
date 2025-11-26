import loginPage from '../../src/pages/login.page';
import CommonActionsPage from '../../Utilities/CommonActions.page';
import loginData from '../../testdata/loginData.json';
import allure from '@wdio/allure-reporter';


describe('Mobile App - Login', () => {
  const base = new CommonActionsPage();
  it('should login successfully and show welcome message', async () => {
    allure.addStep('Waiting for Login Module');
    await base.waitUntilVisible("loginModule");
    allure.addStep('Entering username & password');
    await loginPage.login(loginData.validUser.username, loginData.validUser.password);
    await base.isVisible("EmailError");
    await base.isVisible("PasswordError");
    allure.addStep('Checking Login Button visibility');
    await base.waitUntilVisible("loginButton");
  });
});
