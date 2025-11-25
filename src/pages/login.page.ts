import CommonActionsPage from '../../Utilities/CommonActions.page';


class LoginPage extends CommonActionsPage {

  async login(username: string, password: string) {
     await this.click("loginModule");
    await this.setValue("usernameInput", username);
    await this.setValue("passwordInput", password);
    await this.click("loginButton");
  } 
}
export default new LoginPage();
