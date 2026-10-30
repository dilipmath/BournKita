"""The emergency list on paper: an A4 PDF, in German or English, made with WeasyPrint."""

from datetime import datetime
from html import escape
from typing import Literal

from weasyprint import HTML

from kita.alerts import Alert
from kita.clock import KITA_TIME_ZONE
from kita.emergency_list import Caller, EmergencyList, GroupOnList, PresentChild

Language = Literal["de", "en"]

# The words on the list, as the app says them (see the frontend's i18n.ts).
_WORDS: dict[Language, dict[str, str]] = {
    "en": {
        "title": "Emergency list",
        "wholeKita": "Whole Kita",
        "noGroup": "No Group",
        "printed": "Printed {day}, {time}",
        "oneHere": "1 Child here",
        "manyHere": "{count} Children here",
        "hereSince": "Here since {time}",
        "child": "Child",
        "alerts": "Allergies and medical conditions",
        "callers": "Parents and emergency contacts",
        "parent": "Parent",
        "nobodyHere": "No Children are checked in right now.",
        "confidential": "Confidential: contains health data. Destroy after use.",
        "page": "Page",
        "of": "of",
    },
    "de": {
        "title": "Notfallliste",
        "wholeKita": "Ganze Kita",
        "noGroup": "Keine Gruppe",
        "printed": "Gedruckt {day}, {time} Uhr",
        "oneHere": "1 Kind da",
        "manyHere": "{count} Kinder da",
        "hereSince": "Da seit {time}",
        "child": "Kind",
        "alerts": "Allergien und Erkrankungen",
        "callers": "Eltern und Notfallkontakte",
        "parent": "Elternteil",
        "nobodyHere": "Gerade ist kein Kind eingecheckt.",
        "confidential": "Vertraulich: enthält Gesundheitsdaten. Nach Gebrauch vernichten.",
        "page": "Seite",
        "of": "von",
    },
}

_WEEKDAYS: dict[Language, list[str]] = {
    "en": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    "de": ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"],
}
_MONTHS: dict[Language, list[str]] = {
    "en": ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    "de": ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
}

_STYLE = """
@page {
    size: A4;
    margin: 14mm 12mm 16mm;
    @bottom-left { content: "%(confidential)s"; font-size: 8pt; color: #555; }
    @bottom-right {
        content: "%(page)s " counter(page) " %(of)s " counter(pages); font-size: 8pt; color: #555;
    }
}
html { font-family: "DejaVu Sans", sans-serif; font-size: 10pt; color: #000; }
h1 { font-size: 17pt; margin: 0 0 2mm; }
h2 { font-size: 13pt; margin: 6mm 0 2mm; break-after: avoid; }
p { margin: 0 0 2mm; }
table { width: 100%%; border-collapse: collapse; }
thead { display: table-header-group; }
th { text-align: left; font-size: 9pt; border-bottom: 1.5pt solid #000; padding: 1mm 1.5mm; }
td { vertical-align: top; border-bottom: 0.5pt solid #888; padding: 1.5mm; }
tr { break-inside: avoid; }
td.tick { width: 6mm; }
th.child { width: 28%%; }
th.alerts { width: 32%%; }
.phone { white-space: nowrap; font-weight: bold; }
td.tick::before { content: ""; display: block; width: 4mm; height: 4mm; border: 1pt solid #000; }
.name { font-weight: bold; }
.since { font-size: 8.5pt; }
td div + div { margin-top: 1mm; }
"""


def _day(at: datetime, language: Language) -> str:
    weekday, month = _WEEKDAYS[language][at.weekday()], _MONTHS[language][at.month - 1]
    if language == "de":
        return f"{weekday}, {at.day}. {month} {at.year}"
    return f"{weekday}, {at.day} {month} {at.year}"


def _time(at: datetime) -> str:
    return at.astimezone(KITA_TIME_ZONE).strftime("%H:%M")


def _how_many(count: int, words: dict[str, str]) -> str:
    return words["oneHere"] if count == 1 else words["manyHere"].format(count=count)


def _alert(alert: Alert) -> str:
    text = f"{alert.name}: {alert.note}" if alert.note else alert.name
    return f"<div>{escape(text)}</div>"


def _caller(caller: Caller, words: dict[str, str]) -> str:
    relationship = words["parent"] if caller.kind == "parent" else caller.relationship
    who = f"{caller.name} ({relationship})" if relationship else caller.name
    return f"<div>{escape(who)} <span class=\"phone\">{escape(caller.phone)}</span></div>"


def _row(child: PresentChild, words: dict[str, str]) -> str:
    name = f"{child.first_name} {child.last_name}"
    since = words["hereSince"].format(time=_time(child.checked_in_at))
    alerts = "".join(_alert(alert) for alert in child.alerts) or "–"
    callers = "".join(_caller(caller, words) for caller in child.callers) or "–"
    return (
        '<tr><td class="tick"></td>'
        f'<td><div class="name">{escape(name)}</div><div class="since">{since}</div></td>'
        f"<td>{alerts}</td><td>{callers}</td></tr>"
    )


def _table(group: GroupOnList, words: dict[str, str]) -> str:
    if not group.children:
        return f"<p>{words['nobodyHere']}</p>"
    rows = "".join(_row(child, words) for child in group.children)
    return (
        "<table><thead><tr><th></th>"
        f"<th class=\"child\">{words['child']}</th><th class=\"alerts\">{words['alerts']}</th>"
        f"<th>{words['callers']}</th>"
        f"</tr></thead><tbody>{rows}</tbody></table>"
    )


def _html(emergency_list: EmergencyList, language: Language) -> str:
    words = _WORDS[language]
    whose = words["wholeKita"] if emergency_list.group is None else emergency_list.group.name
    made_at = emergency_list.made_at.astimezone(KITA_TIME_ZONE)
    printed = words["printed"].format(day=_day(made_at, language), time=_time(made_at))
    total = len(emergency_list.child_ids)
    parts = [
        f"<h1>{words['title']}: {escape(whose)}</h1>",
        f"<p>{printed} · <b>{_how_many(total, words)}</b></p>",
    ]
    if emergency_list.group is not None:
        parts.append(_table(emergency_list.groups[0], words))
    else:
        for each in emergency_list.groups:
            group = words["noGroup"] if each.group is None else each.group.name
            count = _how_many(len(each.children), words)
            parts.append(f"<h2>{escape(group)} · {count}</h2>")
            parts.append(_table(each, words))
    style = _STYLE % {key: words[key] for key in ("confidential", "page", "of")}
    return (
        f'<!DOCTYPE html><html lang="{language}"><head><meta charset="utf-8">'
        f"<title>{words['title']}</title><style>{style}</style></head>"
        f"<body>{''.join(parts)}</body></html>"
    )


def emergency_list_pdf(emergency_list: EmergencyList, language: Language) -> bytes:
    pdf: bytes = HTML(string=_html(emergency_list, language)).write_pdf()
    return pdf
