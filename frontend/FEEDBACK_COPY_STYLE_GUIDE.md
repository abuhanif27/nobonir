# Feedback Copy Style Guide

Use this guide for all user-facing toast/alert feedback in the frontend.

## Source of Truth

- Use global feedback API from `useFeedback()` (`showSuccess`, `showError`).
- Avoid page-local alert/toast systems unless there is a clear UX need.
- Let `normalizeMessage` in `src/lib/feedback.tsx` handle punctuation.

## Tone

- Clear, direct, and action-focused.
- Friendly but concise.
- No blame language.

## Wording Rules

- Prefer **"log in"** (verb), not "login".
- Prefer **"Failed to ..."** for error fallbacks (instead of mixed "Unable to ...").
- Prefer specific domain nouns:
  - "product" for catalog actions
  - "wishlist item" for wishlist operations
  - "order" for order/payment actions
- Keep messages short and scannable.
- Avoid technical/internal terms unless necessary.

## Pattern Templates

### Success

- `"<Entity> created successfully"`
- `"<Entity> updated successfully"`
- `"<Entity> deleted successfully"`
- `"<Entity> moved to <destination> successfully"`

### Error

- `"Failed to <action> <entity>"`
- `"Please <required action>"`
- `"Please log in to <action>"`

## Current Examples (Preferred)

- `"Logged in successfully"`
- `"Account created successfully"`
- `"Product added to wishlist"`
- `"Wishlist item removed successfully"`
- `"Please log in to use coupons"`
- `"Failed to submit review"`
- `"Failed to apply coupon"`

## Review Checklist

Before adding/updating feedback copy:

- Is it shown via `showSuccess`/`showError`?
- Does wording match domain terms (`product`, `wishlist item`, `order`)?
- Is error fallback in `Failed to ...` style?
- Is "log in" used correctly?
- Is message short and user-actionable?
