import loginPage from '../../src/pages/login.page';
import CommonActionsPage from '../../Utilities/CommonActions.page';
import loginData from '../../testdata/loginData.json';
import allure from '@wdio/allure-reporter';

describe('Mobile App - Login Test', () => {
  const base = new CommonActionsPage();

  it('should login successfully and show welcome message', async () => {
    allure.addStep('Waiting for Login Module');
    await base.waitUntilVisible("loginModule");
    await loginPage.login(loginData.validUser.username, loginData.validUser.password);
    allure.addStep('Entered username & password');
    allure.addStep('Validating error message');
    await base.isVisible("EmailError");    
  });
});
