---
description: How to compile LaTeX documents in the Perqed workspace
---

# LaTeX Compilation in Perqed

If you need to compile a `.tex` file into a PDF, **DO NOT use `pdflatex`, `xelatex`, or `lualatex`.**

The Perqed environment uses **Tectonic** exclusively.
Tectonic is a modern, single-binary LaTeX engine that automatically downloads any missing math packages or dependencies on the fly, eliminating the need for a bloated TeXLive installation.

## Usage

To compile a LaTeX document, simply run:
```bash
tectonic <filename>.tex
```

This will automatically generate `<filename>.pdf` in the same directory.
There is no need for `-interaction=nonstopmode` or multiple compilation passes for standard references, as Tectonic handles the build lifecycle internally.
