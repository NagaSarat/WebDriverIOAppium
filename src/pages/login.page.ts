import BasePage from './base.page';

class LoginPage extends BasePage {
  // Example XPath locators
  usernameInput = "//android.widget.EditText[@content-desc='input-email']";
  passwordInput = "//android.widget.EditText[@content-desc='input-password']";
  loginModule = "//android.widget.TextView[@text='Login']";
  loginButton = "//android.view.ViewGroup[@content-desc='button-LOGIN']/android.view.ViewGroup";
  EmailError = "//android.widget.TextView[@text='Please enter a valid email address']";
  PasswordError = "//android.widget.TextView[@text='Please enter at least 8 characters']";

  
  async login(username: string, password: string) {
    await this.click(this.loginModule);
    await this.sendKeys(this.usernameInput, username);
    await this.sendKeys(this.passwordInput, password);
    await this.click(this.loginButton);
    
  }

  async getEmailErrorMessage() {
    return this.getText(this.EmailError);
  }
}

export default new LoginPage();
