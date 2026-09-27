# <img src="./images/icon.png" width="30px" /> ThreadLens: AI Thread Dump Analysis

A Visual Studio Code extension to easily analyze Java thread dumps, detect deadlocks, and get AI-powered insights directly inside VS Code.

Effortlessly load, parse, and explore Java thread dumps, track deadlocks, and troubleshoot performance bottlenecks with the help of AI!

<table align="center">
  <tr>
    <td align="center" style="padding: 4px 10px;">
      <a href="https://github.com/en-rypted/threadlens" target="_blank" style="text-decoration: none;">
        <img src="https://raw.githubusercontent.com/en-rypted/jar-explorer/dev/media/github-black.png" width="20px" height="20px" style="border-radius: 50%; background: white;"><br>
        <b>GitHub</b>
      </a>
    </td>
    <td align="center" style="padding: 4px 10px;"></td>
    <td align="center" style="padding: 4px 10px;">
      <a href="https://www.linkedin.com/in/shivwakchaure" target="_blank" style="text-decoration: none;">
        <img src="https://raw.githubusercontent.com/en-rypted/jar-explorer/dev/media/linkedin.png" width="18px" height="18px"><br>
        <b>LinkedIn</b>
      </a>
    </td>
    <td align="center" style="padding: 4px 10px;"></td>
    <td align="center" style="padding: 4px 10px;">
      <a href="https://marketplace.visualstudio.com/items?itemName=shivwakchaure.threadlens" target="_blank" style="text-decoration: none;">
        🧩<br>
        <b>VS Code</b>
      </a>
    </td>
  </tr>
</table>

---

## ✨ Features

- 📁 **Tree View** for loaded thread dumps, organizing multiple captures in one place.
- 🚦 **Deadlock Detection:** Automatically scans and detects Java-level deadlocks.
- 🤖 **AI-Powered Analysis:** Use an OpenAI API key (or VS Code LM integration) to get intelligent insights on your thread dumps.
- 🗜️ **ZIP Archive Support:** Easily load zipped thread dumps directly without manual extraction.
- 🧹 Clean and **modern native interface** for browsing and troubleshooting threads.
- ❌ **Remove Dump** option to quickly clear out analyzed logs.
- 🧭 **Dedicated Activity Bar icon** for quick access to the ThreadLens explorer.

---

## 🧪 How to Use This Extension

Follow these steps to explore and analyze Java thread dumps right inside VS Code:

### 1️⃣ Open a Thread Dump

- You can use the **Load Files / ZIP** command.
- Or simply open a `.tdump`, `.threaddump`, or `.log` file.
- The parsed thread dump will appear in the **ThreadLens** sidebar!

### 2️⃣ Analyze with AI

- Trigger the **Analyze Thread Dump** command.
- If you have configured an OpenAI API key, ThreadLens will use AI to provide intelligent insights into blocked threads or bottlenecks!

---

## 📁 Supported File Types

| File Type | Description                                                                 |
|-----------|-----------------------------------------------------------------------------|
| `.tdump`  | Standard Thread Dump extension                                              |
| `.threaddump` | Alternative Thread Dump extension                                       |
| `.log`    | Generic log files containing thread dump outputs                            |
| `.zip`    | Zipped thread dump archives                                                 |

---

## ⚙️ Extension Settings

This extension contributes the following settings:

| Setting | Description |
|--------|-------------|
| `threadlens.openaiApiKey`  | Optional: OpenAI API Key for AI Analysis (if you do not have Copilot or an alternative VS Code LM installed). |

You can add this in your `settings.json`:

```json
{
  "threadlens.openaiApiKey": "sk-your-api-key-here"
}
```

---

## 📝 Release Notes

### 📦 v0.0.2

- 📦 Massively reduced extension bundle size (from 23MB down to ~280KB) by optimizing `.vscodeignore`.
- 🛠️ Fixed internal compatibility with newer VS Code APIs.

---

### 📦 v0.0.1

- Initial release of ThreadLens!
- Basic thread dump parsing, Tree View UI, deadlock detection, and AI analysis.

---

## 🙌 Stay Connected

If you find this extension helpful, consider supporting it:

<table>
  <tr>
    <td style="vertical-align: middle; padding: 4px;">
      <img src="https://raw.githubusercontent.com/en-rypted/jar-explorer/dev/media/github-black.png" width="20px" height="20px" style="background:white; border-radius:50%;">
    </td>
    <td style="vertical-align: middle; padding: 4px;">
      ⭐️ <b>Star</b> and <b>Follow</b> the project on
      <a href="https://github.com/en-rypted/threadlens" target="_blank">GitHub</a>
    </td>
  </tr>
  <tr>
    <td style="vertical-align: middle; padding: 4px;">
      <img src="https://raw.githubusercontent.com/en-rypted/jar-explorer/dev/media/linkedin.png" width="18px" height="18px">
    </td>
    <td style="vertical-align: middle; padding: 4px;">
      <b>Follow me on LinkedIn</b>:
      <a href="https://www.linkedin.com/in/shivwakchaure" target="_blank">linkedin.com/in/shivwakchaure</a>
    </td>
  </tr>
</table>

> Your feedback, stars, and shares mean a lot! 💙
