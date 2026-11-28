---
name: changuito-ui
description: Designs or builds any new Changuito UI component using apps/branding. Use when adding a screen, modal, button, form, card, or empty state, or when the user asks for UI, UX, or a mock. Follow the brand manual, tokens, and the modal rules in changuito-design.
---

# Changuito UI

Read these before drawing or coding a new component:

- `apps/branding/manuals/manual-de-marca-changuito.md`
- `apps/branding/tokens/colors.json` and `apps/branding/tokens/css-variables.css`
- `apps/branding/README.md`
- `.agents/skills/changuito-design/SKILL.md` when the component is a modal or includes logout

Use the tokens already in `apps/web/app/globals.css`. Do not add a color.

## Brand

| Token | Hex | Use |
|---|---|---|
| `--chg-espresso` | `#2A1A14` | Text, frames |
| `--chg-sunflower` | `#F4B942` | The one primary CTA |
| `--chg-arcilla` | `#E07A5F` | Accent only. Logout stays espresso on arcilla |
| `--chg-offwhite` | `#FAFAF7` | Page background |

At most two brand colors plus neutral on one component. Primary button: sunflower fill, espresso text, pill radius. Secondary: `btn-ghost`. White text on arcilla fails contrast. Sunflower as small text on off-white fails contrast.

Type: Inter (Nunito only if Inter is missing). Weights Regular, Medium, SemiBold, Bold. Do not use Baloo or a display face for UI. The wordmark is the SVG/PNG in `apps/branding/logo/`, never retyped.

Mascot: reuse PNGs in `apps/branding/mascot/`. Do not generate a new one. Do not use `apps/branding/_discarded/`.

Shape: buttons are pills, cards radius 12–20px, soft shadow only. No glass, neon, or crypto grids.

## Product UX

- One primary action per view. Anything else is ghost or text.
- App copy is rioplatense voseo (`Pedí`, `Confirmá`). No “pana”, no lunfardo.
- In the app, payment words already used are fine: saldo, USDC, billetera, checkout. Do not say blockchain, on-chain, wallet, devnet, mainnet, or smart contract in the UI.
- Say what happened. Do not invent a percent, a time, or a fee.
- A wait shows a status line. A failure says what failed and what is safe.
- Inputs have visible labels, tied with `for`/`id`. Errors sit on the field.
- Touch targets are at least 44×44px. Focus is visible. Do not remove the outline without a replacement.
- Modals: use `components/Modal.tsx`. One close control, the X in `modal-head` (`aria-label` Cerrar / Close). Backdrop and Escape close. No second “Cerrar” button. A success “Listo” is the completion action, not a second close label.
- Prefer `data-testid` on actions the tests hit.

## Check before finishing

- Espresso on off-white and espresso on sunflower.
- Keyboard: reach every control, see focus, leave with Escape.
- 390px and 1440px. Nothing clipped, no horizontal scroll.
- Copy fits the existing `ui-copy` / checkout copy voice.
