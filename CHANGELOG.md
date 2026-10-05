# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Nothing yet.

## [1.0.0] - 2026-10-05

First release.

### Added

- **Option 1: Hide the specifics.** Keeps the current myUNT design but covers personal values with a solid block. Hover to read a value, click to keep it visible. Labels and links such as *Pay now* and *Edit profile* stay usable. Each group can be switched off individually, plus a text-pattern safety net for when UNT renames a class.
- **Option 2: Classic layout.** The old myUNT: the light background and one rounded box per section, carrying only an icon and a name.
- **Remove the UNT background photo**
- **Off**, which leaves the page exactly as UNT publishes it.
- Settings page, toolbar popup, and settings that apply without a reload.
- Support for Chrome/Chromium, Firefox, and Safari.
- A test suite that runs the real content script against a saved copy of the homepage, a layout measurement that catches clipped boxes, and GitHub Actions workflows that build the packages when a release is published.

[Unreleased]: https://github.com/KaushikDuddala/classic-unt/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/KaushikDuddala/classic-unt/releases/tag/v1.0.0
