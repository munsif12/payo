# Bundled institution / biller logos

Drop a PNG here to override whatever `logoUrl` the backend sends for an
institution, wallet or biller — useful when a provider's hosted mark is
missing, low-resolution, or wrong.

## Naming

    assets/logos/<code>.png

`<code>` is the institution / biller **code** the backend sends
(`InstitutionDto.code`, e.g. `hbl`, `easypaisa`, `kelectric`), lowercased,
with no spaces. The lookup in `src/ui/logoOverrides.ts` lowercases and trims
whatever it is given, so `HBL` and ` hbl ` both find `hbl.png`.

## Registering one

React Native's bundler cannot build a `require()` path at runtime, so every
override has to be listed statically. After adding the file, add its line to
`LOGO_OVERRIDES` in `src/ui/logoOverrides.ts`:

```ts
export const LOGO_OVERRIDES: LogoOverrides = {
  hbl: require('../../assets/logos/hbl.png'),
};
```

## Sizing

`InstitutionLogo` renders at 24 / 32 / 40 pt. Ship a square PNG at 3× the
largest size you use (120×120) with a transparent background; the component
clips it to a circle or a rounded square.
