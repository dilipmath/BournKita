# Style guide

The rules the app's screens follow (`frontend/src/index.css`), measured. Where the app does not meet a rule yet, it says so.

## For whom

Staff with basic computer skills, on a tablet held in one hand, often in a hurry, sometimes with reading glasses. So: big, plain, forgiving.

## Rules

| Rule | Value in the app | Measured | Meets it? |
|---|---|---|:-:|
| **Text size** | Base 20px (body text), headings larger; nothing below 16px | Labels in the month calendar and some notes are 16px (0.8rem) | ✓ |
| | | **Event chips in the month calendar on a phone: 14px** (0.7rem, screens up to 700px wide) | ✗ |
| **Touch targets** | Every button, link-button and field at least 48 × 48px (above WCAG 2.5.8's 24px and Apple's 44px) | Buttons and fields 48px; Check in and Check out 64px; rows in the Children list 56px | ✓ |
| | Checkboxes | The box itself is 28 × 28px; the whole row with its label is 48px and can be tapped | ✓ |
| | | **Event and Birthday chips in the month calendar: 32px tall** (week and agenda views are larger) | ✗ |
| **Text contrast** (WCAG 1.4.3, 4.5:1) | Text #1f2328 on #fdfbf7 | 15.3:1 (dark mode 14.7:1) | ✓ |
| | Green (accent) #2f6f4f on the background; light text on green buttons | 5.8:1 each (dark mode 8.6:1) | ✓ |
| | Red (Alerts, danger) #b42318 on the background | 6.4:1 (dark mode 7.7:1) | ✓ |
| **Outline contrast** (WCAG 1.4.11, 3:1 for what shows where a field or button is) | Border #8a8478 on the background and on cards (dark mode #7a808a) | 3.6:1 on the background, 3.7:1 on cards (dark mode 4.4:1 and 3.9:1) | ✓ |
| **Focus** | A clear outline around whatever has the keyboard focus | 3px outline in the accent colour | ✓ |
| **Icons with text** | Never an icon alone: Group icons stand next to the Group's name; Alerts show e.g. "⚠ Allergies: Peanuts" | **In the month calendar, a Group's Events show only its icon** (the name is there for screen readers only) | ✗ |
| **Group icons** | Each Group has an animal or plant icon, shown in the Group picker, the Today view and the Calendar | — | ✓ |
| **Colour never alone** | Status is also written: "Here since 08:12", "Absent: sick", "Gone home at 15:30" | — | ✓ |
| **Plain words** | The words of the glossary (Child, Group, Alert, Pick-up person …), in German and English | — | ✓ |
| **Second step before anything that loses data** | Deleting asks again; deleting for good says it cannot be undone | — | ✓ |
| **Dark mode** | Follows the device's setting | — | ✓ |

## Not met yet (to fix after the test, if it confirms them)

1. **Month calendar chips** (Events, Birthdays) are 32px tall, with 14px text on phones, and a Group's Events show only its icon. Bigger chips make the month grid much taller; the week and agenda views are the fallback. Check in the test whether staff manage.

## Words and layout

- One main action per card, in green; secondary actions as outlined buttons.
- Lists and cards in one column on a phone, more on a tablet.
- Dates written out ("Monday, 4 January"), times at the Kita's local time.
