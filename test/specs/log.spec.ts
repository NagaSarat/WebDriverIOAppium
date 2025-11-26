import loginPage from '../../src/pages/login.page';
import CommonActionsPage from '../../Utilities/CommonActions.page';
import loginData from '../../testdata/loginData.json';
import allure from '@wdio/allure-reporter';


describe('Mobile App - Login', () => {
  const base = new CommonActionsPage();
  it('should login successfully and show welcome message', async () => {
    await base.waitUntilVisible("loginModule");
    allure.addStep('Login Module displayed');
    await loginPage.login(loginData.validUser.username, loginData.validUser.password);
    allure.addStep('Entered username & password');
    await base.isVisible("EmailError");
    allure.addStep('Email error message displayed');
    await base.isVisible("PasswordError");
    allure.addStep('Password error message displayed');
    await base.waitUntilVisible("loginButton");
    allure.addStep('Login Button displayed');
  });
});
