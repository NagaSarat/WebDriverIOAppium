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
npm install --save-dev @types/chai@^5.2.3 @types/jest@^30.0.0 @types/mocha@^10.0.10 @types/node@^24.10.1 @wdio/allure-reporter@^9.20.0 @wdio/appium-service@^8.38.0 @wdio/cli@^8.38.0 @wdio/globals@^8.38.0 @wdio/local-runner@^8.38.0 @wdio/mocha-framework@^8.38.0 @wdio/spec-reporter@^8.38.0 @wdio/types@^8.10.1 allure-commandline@^2.34.1 chai@^6.2.1 ts-node@^10.9.2 typescript@^5.9.3 webdriverio@^8.38.0
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

## 🧩 Starting Appium Server

To start the Appium server:
```bash
appium
```

Or, to specify a host and port:
```bash
appium --address 127.0.0.1 --port 4723
```

---

## 🧪 Running Test Cases

To run a specific test case (example: `login.spec.ts`):

```bash
npx wdio run ./wdio.conf.ts --spec ./test/specs/login.spec.ts

npx wdio run ./wdio.parallel.conf.ts

npx wdio run wdio.parallel.conf.ts --specMap="emulator-5556:login.spec.ts emulator-5554:log.spec.ts"

```

---

## To generate test.spec.ts, page.ts and locators automatically using MCP
Edit testcase.txt file with the test case name and run below command then files will be generated and placed in folder locations as per framework folder structure

```npm
npm run generate:test -- testcase.txt
```
or
```bash
ts-node ./scripts/generate-test.ts testcase.txt
```

---

## 📊 Generating & Viewing Allure Reports

After test execution, generate and open the Allure report using:

```bash
allure generate allure-results --clean && allure open allure-report
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