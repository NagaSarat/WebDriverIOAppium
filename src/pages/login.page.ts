import BasePage from './base.page';
import loginpage from '../../object-repository/loginpage.json';

class LoginPage extends BasePage {

  
  async login(username: string, password: string) {
    await this.click(loginpage.loginModule);
    await this.sendKeys(loginpage.usernameInput, username);
    await this.sendKeys(loginpage.passwordInput, password);
    await this.click(loginpage.loginButton);
    
  }

  async getEmailErrorMessage() {
    return this.getText(loginpage.EmailError);
  }
}

export default new LoginPage();
