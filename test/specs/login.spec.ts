import loginPage from '../../src/pages/login.page';
import loginData from '../../test/testdata/loginData.json';

describe('Mobile App - Login Test', () => {
  it('should login successfully and show welcome message', async () => {
    await loginPage.login(loginData.validUser.username, loginData.validUser.password);
    await loginPage.validateEmailError();
  });
});