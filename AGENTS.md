# MiniCut repository rules for AI agents

## Non-negotiable Windows packaging rule

MiniCut uses **portable-folder distribution only**.

Do not convert the Windows build to:
- NSIS/MSI/setup installers;
- a self-extracting or single-file portable EXE;
- a build that requires administrator installation.

The expected user experience is:

1. Download the GitHub Actions ZIP artifact.
2. Extract it completely.
3. Open the `MiniCut` folder.
4. Run `MiniCut.exe`.
5. Keep `MiniCut.exe`, `resources/`, `locales/`, DLL/runtime files, and other bundled files together.

Expected artifact layout:

```text
MiniCut-Portable-Windows-x64.zip
└── MiniCut/
    ├── MiniCut.exe
    ├── resources/
    ├── locales/
    ├── data/
    ├── BACA_SAYA.txt
    └── runtime / DLL / support files...
```

Use electron-builder directory output (`--dir`) for Windows. The CI workflow must smoke-test the executable **from the assembled portable folder** before publishing the artifact.

Portable writable state belongs under `MiniCut/data/` where feasible. The application must not depend on Program Files, registry-based installation, or an installer-created directory structure.

When updating MiniCut, preserve this packaging model unless the repository owner explicitly requests a different format.
