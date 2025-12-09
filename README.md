# 🚀 WebdriverIO + Appium Mobile Automation Framework

A powerful **mobile automation testing framework** built using:

- **WebdriverIO**
- **Appium**
- **TypeScript**
- **Mocha**
- **Allure Reports**

Supports both **Android** and **iOS** testing with simple setup, rich reporting, modular architecture, and optional test generation using **MCP + OpenAI**.

---

## 🧰 Prerequisites

Before setting up this framework, ensure the following tools are installed:

- [Node.js (Latest LTS)](https://nodejs.org/)
- Android SDK (required for Android automation)
- Xcode (required for iOS automation — macOS only)
- Appium and UIAutomator2 and XCUITest drivers
- Java

✅ Ensure the following environment variables are configured:

- `JAVA_HOME`
- `ANDROID_HOME`
- `ANDROID_SDK_ROOT`
- `PATH` includes platform-tools, emulator & tools

---

## ⚙️ Project Setup

Clone repository and install dependencies:

```bash
npm install
```

---

## 🤖 Appium Installation & Configuration

### 1️⃣ Install Node.js
Download Node.js from:
https://nodejs.org/

### 2️⃣ Install Appium
```bash
npm install -g appium
```

Verify installation:
```bash
appium -v
```

### 3️⃣ Install Appium Drivers

#### Android:
```bash
appium driver install uiautomator2
```

#### iOS:
```bash
appium driver install xcuitest
```

Check drivers:
```bash
appium driver list
```

### 4️⃣ Validate Environment (Recommended)
```bash
npm install -g appium-doctor

appium-doctor --android   # For Android
appium-doctor --ios       # For iOS (macOS only)
```

---
### ■ For iOS sample app

Clone the official Appium iOS TestApp repository
```bash
git clone https://github.com/appium/ios-test-app.git
```
Build the .app for the Simulator, run below three commands
```bash
cd ios-test-app
```
```bash
mkdir -p build   
```
```bash
xcodebuild -scheme TestApp -sdk iphonesimulator -configuration Debug -derivedDataPath build
```
Your .app will be created here: ios-test-app/build/Build/Products/Debug-iphonesimulator/TestApp.app (paste TestApp.app in apps/ios folder in framework, now the app will be installed automatically)
---
### ■ For using appium inspector in Mac for iOS app locators

launch inspector in url: https://inspector.appiumpro.com/

run below command in terminal
```bash
npx appium --address 127.0.0.1 --port 4723 --base-path /wd/hub --allow-cors
```
---

## 📱 Selecting Platform (Android / iOS)

Run test with platform selection:

```bash
PLATFORM=android npx wdio run ./wdio.conf.ts
```
```bash
PLATFORM=ios npx wdio run ./wdio.conf.ts
```

If no platform is provided, **Android** is used by default.

---

## 🧪 Running Test Cases

### ▶️ Run a specific test file
for android run below command
```bash
PLATFORM=android npx wdio run ./wdio.conf.ts --spec ./test/specs/login.spec.ts
```
for ios run below command
```bash
PLATFORM=ios npx wdio run ./wdio.conf.ts --spec ./test/specs/login.spec.ts
```

### ▶️ Run full test suite
```bash
npx wdio run ./wdio.conf.ts
```

### ▶️ Parallel execution
```bash
npx wdio run ./wdio.parallel.conf.ts
```

### ▶️ Distribute test files across devices
```bash
npx wdio run wdio.parallel.conf.ts --specMap="emulator-5556:login.spec.ts emulator-5554:home.spec.ts"
```

---

## 🧠 Auto-Generate Tests, Pages & Locators with MCP + OpenAI

This framework supports automated file generation using LLMs.

### 1️⃣ Set your OpenAI API key

- Creat .env file in project root folder and add OPENAI_API_KEY=<your-api-key> in it

### 2️⃣ Update `testcase.txt`
Provide:
- Test case title
- Spec filename
- Page object filename
- Locator filename
- Preconditions
- Steps
- Expected result

### 3️⃣ Generate files
```bash
npm run generate:test -- testcase.txt
```

✅ Files will auto-generate and be placed correctly following POM structure.

---

## 📊 Generating & Viewing Allure Reports

After test execution:

```bash
allure serve allure-results
```

or

```bash
allure generate allure-results --clean
allure open
```

---

## 🖼️ Step-Level Screenshot Control

This framework allows configurable screenshot behavior:

### Enable screenshots globally
```bash
SCREENSHOT_STEPS=true npx wdio run ./wdio.conf.ts
```

### Disable screenshots
```bash
SCREENSHOT_STEPS=false npx wdio run ./wdio.conf.ts
```

### Override in test code
```ts
await base.addStep('Login successful', true);
```

Screenshots attach to the same Allure step.

---

## ⏱️ Timeout Configuration

Modify global element wait timeout in `wdio.conf.ts`:

```ts
waitforTimeout: 60000, // 60 seconds
```

---

## ✅ Framework Highlights

- ✅ WebdriverIO + Appium + TypeScript
- ✅ Cross-platform (Android + iOS)
- ✅ Page Object Model structure
- ✅ Allure reporting with step screenshots
- ✅ Run sequentially or in parallel
- ✅ Built-in test file generator via MCP + OpenAI
- ✅ Screenshot toggle via environment variable
- ✅ Clean & scalable folder structure

---

## 💡 Recommendations

- Always run `appium-doctor` after SDK upgrades
- Delete old allure-results before new runs for cleaner reporting
- Maintain separate configs for CI, staging & prod
- Use cloud device providers (BrowserStack, pCloudy, SauceLabs) for scaling

---

## 🚦 CI/CD Integration (Jenkins & GitHub Actions)

### ✅ Jenkins Pipeline Example
```groovy
pipeline {
  agent any

  stages {
    stage('Checkout') {
      steps {
        git 'https://github.com/your-org/your-repo.git'
      }
    }

    stage('Install Dependencies') {
      steps {
        sh 'npm install'
      }
    }

    stage('Run Tests') {
      steps {
        sh 'SCREENSHOT_STEPS=true npx wdio run ./wdio.conf.ts'
      }
    }

    stage('Generate Allure Report') {
      steps {
        sh 'allure generate allure-results --clean'
      }
    }

    stage('Publish Report') {
      steps {
        allure includeProperties: false, jdk: '', results: [[path: 'allure-results']]
      }
    }
  }
}
```

### ✅ GitHub Actions Workflow Example
```yaml
name: Mobile Automation CI

on:
  push:
    branches: [ "main" ]
  pull_request:
    branches: [ "main" ]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Repo
        uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install Dependencies
        run: npm install

      - name: Run Tests
        run: SCREENSHOT_STEPS=true npx wdio run ./wdio.conf.ts

      - name: Upload Allure Results
        uses: actions/upload-artifact@v3
        with:
          name: allure-results
          path: allure-results
```

---

## 📁 Folder Structure
```
📦 mobile-automation-framework
│
├── apps/                        # APK/IPA files
├── src/
│   ├── pages/                   # Page Object files
│   ├── locators/                # Central JSON locator files
│   └── utilities/               # Helper utilities & common actions
│
├── test/
│   └── specs/                   # Test scripts
│   └── testdata/                # Test data
│
├── scripts/                     # LLM test generation/misc tools
├── allure-results/              # Results from test execution
├── allure-report/               # Generated allure report
├── wdio.conf.ts                 # Main WDIO configuration
├── wdio.parallel.conf.ts        # Parallel execution config
├── testcase.txt                 # Test generation input
└── README.md
```

---

## 🏗️ Framework Architecture
```
        ┌──────────────────────┐
        │      Test Specs      │
        │   (Mocha + WDIO)     │
        └──────────┬───────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │   Page Objects (POM) │
        │  Actions + Elements  │
        └──────────┬───────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │   WebdriverIO APIs   │
        └──────────┬───────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │       Appium         │
        │   (Android / iOS )   │
        └──────────┬───────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │     Real Device /    │
        │   Emulator / Cloud   │
        └──────────────────────┘
```

---

## 🏷️ Technology Badges

![Node](https://img.shields.io/badge/Node.js-18+-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)
![WebdriverIO](https://img.shields.io/badge/WebdriverIO-v9-red)
![Appium](https://img.shields.io/badge/AppiumServer-v2-purple)
![Allure](https://img.shields.io/badge/AllureReport-v9-orange)

---

## 🤝 Contribution Guidelines

✅ Fork the repository

✅ Create a feature branch
```bash
git checkout -b feature/your-feature-name
```

✅ Commit with clear message
```bash
git commit -m "Added login page automation"
```

✅ Push and create pull request
```bash
git push origin feature/your-feature-name
```

✅ Ensure PR includes:
- Meaningful title & description
- Test coverage where applicable
- Linting + formatting compliance

---


## 🏁 Conclusion

This framework enables fast, maintainable, scalable, and AI-assisted mobile test automation with WebdriverIO & Appium.

Feel free to fork, enhance, and contribute! 💙

---

📩 For questions, enhancements, or feature requests — open an issue!

