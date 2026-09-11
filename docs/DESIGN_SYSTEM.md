# PiliRun Design System

## Purpose

A quiet adventure camp with one clear invitation to play. Original Canvas illustrations share the game's visual language, so the menu and the actual game feel connected without loading large bitmap backgrounds.

## Tokens

| Token     | Value     | Use                                             |
| --------- | --------- | ----------------------------------------------- |
| Pine      | `#183F35` | Primary controls, identity, dark surfaces       |
| Canvas    | `#F6F7F2` | Application background                          |
| Surface   | `#FFFFFF` | Cards and forms                                 |
| Ink       | `#243F35` | Headings and body text                          |
| Muted ink | `#60705A` | Supporting copy with contrast on light surfaces |
| Lime      | `#D8F36A` | Main play action and progress                   |
| Coral     | `#F18C73` | Supporting illustration accents                 |
| Divider   | `#E4E8DF` | Separators and structural boundaries            |

Typography uses the platform's Arial/Helvetica sans-serif stack, with no font network dependency. Body: 14 px; screen headings: 28–39 px; adventure title: 43–57 px; section headings: 21–27 px. Small supporting labels are raised for legibility; labels must not be the sole source of essential information.

Spacing steps: 4, 8, 12, 16, 20, 24, 32 and 40 px. Card radii: 14–20 px. Input/control radius: 8–12 px. Shadows are sparse and soft; borders define the primary surfaces. Blur is reserved for modal/pause backgrounds and the mobile navigation bar.

## Components and states

- Primary button: pine/white; the main play action uses lime/pine. Disabled controls expose disabled semantics. Visible focus uses a 3 px outline.
- Navigation: icon + text, selected tint and edge indicator. Mobile places six destinations in a fixed bottom bar. Icon-only controls receive accessible names.
- World card: original illustration, name, difficulty and distance. Selection has both a checkmark label and border.
- Forms: persistent labels, visible validation, no placeholder-only fields. Save acknowledgement follows actual storage completion.
- Pixel canvas: pointer capture for drawing, limited undo history, palette selection semantics and an optional keyboard grid.
- Game: keyboard mappings, large touch buttons, visible HUD, pause on loss of visibility and explicit result screen.
- Empty states: explain what belongs in the area and where to begin. Statistics are calculated from real runs, never fabricated.

## Responsive behavior

Desktop: 232 px sidebar and generous content width. Tablet: icon rail. Mobile below 760 px: bottom navigation, stacked hero and companion, horizontally scrollable world cards, stacked editor panels and large touch controls. No page-level horizontal overflow is expected at 390 px.

## Motion and accessibility

Short hover transitions reinforce clickability. No continuous decorative CSS animation besides loading. Reduced-motion CSS follows the OS; the app setting also disables game background parallax. Keep high-contrast text separate from decorative color. Automated Axe checks and browser screenshots supplement, but do not replace, manual keyboard and screen-reader testing.
