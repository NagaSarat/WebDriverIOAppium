import CommonActionsPage from '../utilities/CommonActions.page';
import loginpage from '../../src/object-repository/loginpage.json';

class LoginPage extends CommonActionsPage {

  async login(username: string, password: string) {
    await this.waitUntilVisible("loginModule");
    await this.click("loginModule");
    await this.setValue("usernameInput", username);
    await this.setValue("passwordInput", password);
    await this.click("loginButton");
  }

  async validateError(){
    await this.isVisible("EmailError")
  }
  
}
export default new LoginPage();
