`Archivo.woff2` is Archivo (OFL, see `OFL.txt`) cut down to what the UI uses: weight 400–700, normal width, Latin plus punctuation, € and arrows. Characters outside that fall back to system-ui. Regenerate from the full variable font (github.com/Omnibus-Type/Archivo) with fonttools:

```bash
fonttools varLib.instancer Archivo.ttf wght=400:700 wdth=100 -o inst.ttf
pyftsubset inst.ttf --unicodes="U+0020-007E,U+00A0-017F,U+2000-206F,U+20AC,U+2190-2193,U+2212" --layout-features='*' --flavor=woff2 --output-file=Archivo.woff2
```
