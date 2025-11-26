import loginPage from '../../src/pages/login.page';
import CommonActionsPage from '../../Utilities/CommonActions.page';
import loginData from '../../testdata/loginData.json';
import allure from '@wdio/allure-reporter';


describe('Mobile App - Login', () => {
  const base = new CommonActionsPage();
  it('should login successfully and show welcome message', async () => {
    await base.waitUntilVisible("loginModule");
    await base.addStep('Login Module displayed',true);
    await loginPage.login(loginData.validUser.username, loginData.validUser.password);
    await base.addStep('Entered username & password',true);
    await base.isVisible("EmailError");
    await base.addStep('Email error message displayed',true);
    await base.isVisible("PasswordError");
    await base.addStep('Password error message displayed',true);
    await base.waitUntilVisible("loginButton");
    await base.addStep('Login Button displayed',true);
  });
});
