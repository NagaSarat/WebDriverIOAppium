# 🚀 WebDriverIO Appium Automation Framework

A powerful **Mobile Automation Testing Framework** built using **WebdriverIO**, **Appium**, **TypeScript**, and **Allure Reports**.  
Supports both **Android** and **iOS** testing with simple setup and reporting integration.

---

## 🧰 Prerequisites

Before setting up the framework, make sure the following are installed:

- [Node.js (Latest LTS)](https://nodejs.org/)
- Android SDK (for Android automation)
- Xcode (for iOS automation)
- Appium & Drivers (see setup under Appium Installation & Configuration section)

---

## ⚙️ Project Setup

After cloning this repository, install the required dependencies:

```bash
npm install
```

---

## 🤖 Appium Installation & Configuration

If Appium is **not installed**, follow these steps:

### 1️⃣ Install Node.js  
Download and install Node.js from:  
🔗 [https://nodejs.org/](https://nodejs.org/)

### 2️⃣ Install Appium  
Install Appium globally:
```bash
npm install -g appium
```
Verify installation:
```bash
appium -v
```

### 3️⃣ Install Drivers

#### Android:
```bash
appium driver install uiautomator2
```

#### iOS:
```bash
appium driver install xcuitest
```

Check installed drivers:
```bash
appium driver list
```

### 4️⃣ (Optional) Verify Environment with Appium Doctor  
This helps ensure all SDKs and tools are correctly set up:
```bash
npm install -g appium-doctor
appium-doctor --android
```

---

## 🧪 Running Test Cases

###  ▶️ Run a specific test case
```bash
npx wdio run ./wdio.conf.ts --spec ./test/specs/login.spec.ts
```

### ▶️ Run all test cases sequentially (single device)
```bash
npx wdio run ./wdio.conf.ts
```

### ▶️ Run all test cases in parallel
```bash
npx wdio run ./wdio.parallel.conf.ts
```

### ▶️ Run test cases in parallel with specific test distribution per device
```bash
npx wdio run wdio.parallel.conf.ts --specMap="emulator-5556:login.spec.ts emulator-5554:log.spec.ts"
```

## To generate test.spec.ts, page.ts and locators automatically using MCP
Edit testcase.txt file with the file names and test case and run below command then files will be generated and placed in folder locations as per framework folder structure

add api key
```
setx OPENAI_API_KEY "your-api-key-here"
```
```npm
npm run generate:test -- testcase.txt
```

---

## 📊 Generating & Viewing Allure Reports

After test execution, generate and open the Allure report using:

```bash
allure serve allure-results
```

---

## 🧾 Summary

This framework provides:

- ✅ WebdriverIO + Appium Integration  
- ✅ TypeScript for strongly-typed automation  
- ✅ Allure Reporting for detailed test insights  
- ✅ Support for both Android & iOS platforms  
- ✅ Integrated with MCP and OpenAI LLM
- ✅ Easy scalability and maintainability  

---

## 💡 Tips

- Use `appium-doctor` frequently to check setup health.
- Always clean old reports before generating new ones.
- You can configure parallel execution and cloud device testing (e.g., BrowserStack, SauceLabs).

##
- You can change golbal timeout in wdio.conf.ts at 'waitforTimeout: <milliseconds>'